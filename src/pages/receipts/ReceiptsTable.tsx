import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Printer, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable, RecordCount } from '@/components/DataTable'
import { askReason } from '@/components/dialog'
import { Badge, Button, EmptyState, FilterChips, Money, SearchInput, Select } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { paymentMethodLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { invalidateFinance } from './ReceiptForm'

export function useReceipts(filter: { clientId?: string; projectId?: string }) {
  return useQuery({
    queryKey: ['client_receipts', filter.clientId ?? null, filter.projectId ?? null],
    queryFn: async () => {
      let q = supabase.from('client_receipts').select('*, clients(name), projects(name, project_type), treasuries(name)').order('receipt_date', { ascending: false }).order('receipt_no', { ascending: false })
      if (filter.clientId) q = q.eq('client_id', filter.clientId)
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}
export type ReceiptRow = NonNullable<ReturnType<typeof useReceipts>['data']>[number]

type Status = 'all' | 'posted' | 'reversed'

// سجل المقبوضات: بحث وفلاتر، طباعة، وإلغاء بقيد عكسي مع سبب (لا حذف ولا تعديل)
export function ReceiptsTable({ clientId, projectId, onNew, showFilters = true }: { clientId?: string; projectId?: string; onNew?: () => void; showFilters?: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useReceipts({ clientId, projectId })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('posted')
  const [treasury, setTreasury] = useState('')
  const [project, setProject] = useState('')

  const reverse = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reverse_client_receipt', { p_receipt_id: id, p_reason: reason, p_date: todayISO() })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم إلغاء الإيصال بقيد عكسي')
      invalidateFinance(qc)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const all = data ?? []
  const q = search.trim()
  const shown = all.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (!treasury || r.treasury_id === treasury) &&
      (!project || (project === 'none' ? !r.project_id : r.project_id === project)) &&
      (!q || (r.clients?.name ?? '').includes(q) || (r.projects?.name ?? '').includes(q) || String(r.receipt_no) === q || String(r.amount).includes(q) || (r.reference ?? '').includes(q)),
  )
  const total = shown.filter((r) => r.status === 'posted').reduce((a, r) => a + Number(r.amount), 0)
  const treasuries = [...new Map(all.map((r) => [r.treasury_id, r.treasuries?.name ?? ''])).entries()]
  const projects = [...new Map(all.filter((r) => r.project_id).map((r) => [r.project_id!, r.projects?.name ?? ''])).entries()]

  return (
    <DataTable
      rows={shown}
      getKey={(r) => r.id}
      loading={isLoading}
      error={error ? errorMessage(error) : null}
      onRetry={() => refetch()}
      rowClassName={(r) => r.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
      toolbar={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالزبون، المشروع، الرقم أو المبلغ…" />
          {showFilters && (
            <>
              {!projectId && projects.length > 0 && (
                <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-auto max-w-48" aria-label="المشروع">
                  <option value="">كل المشاريع</option>
                  <option value="none">بلا مشروع (رصيد دائن)</option>
                  {projects.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
              {treasuries.length > 1 && (
                <Select value={treasury} onChange={(e) => setTreasury(e.target.value)} className="w-auto max-w-48" aria-label="الخزينة">
                  <option value="">كل الخزائن</option>
                  {treasuries.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}
          <FilterChips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'posted', label: 'سارية', count: all.filter((r) => r.status === 'posted').length },
              { value: 'reversed', label: 'ملغاة', count: all.filter((r) => r.status === 'reversed').length },
              { value: 'all', label: 'الكل', count: all.length },
            ]}
          />
          <div className="ms-auto flex items-center gap-3 text-xs text-muted">
            <span>
              الإجمالي <Money value={total} className="font-semibold text-ink" />
            </span>
            <RecordCount shown={shown.length} total={all.length} />
          </div>
        </>
      }
      empty={
        <EmptyState icon={Banknote} title={q || status !== 'posted' ? 'لا توجد إيصالات مطابقة' : 'لا توجد إيصالات بعد'} action={onNew && !q && <Button onClick={onNew}>إيصال قبض جديد</Button>}>
          {!q && status === 'posted' && 'سجّل أول دفعة مستلمة من الزبون.'}
        </EmptyState>
      }
      columns={[
        { key: 'no', label: 'رقم', render: (r) => <span className="num font-medium">#{r.receipt_no}</span> },
        { key: 'date', label: 'التاريخ', render: (r) => <span className="num whitespace-nowrap text-muted">{formatDate(r.receipt_date)}</span> },
        ...(!clientId ? [{ key: 'client', label: 'الزبون', render: (r: ReceiptRow) => <Link to={`/clients/${r.client_id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.clients?.name}</Link> }] : []),
        ...(!projectId
          ? [
              {
                key: 'project',
                label: 'المشروع',
                render: (r: ReceiptRow) =>
                  r.project_id ? (
                    <Link to={`/projects/${r.project_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.projects?.name}
                    </Link>
                  ) : (
                    <Badge tone="sand">رصيد دائن</Badge>
                  ),
              },
            ]
          : []),
        { key: 'treasury', label: 'الخزينة', hideBelow: 'md', render: (r) => <span className="text-muted">{r.treasuries?.name}</span> },
        { key: 'method', label: 'الطريقة', hideBelow: 'lg', render: (r) => paymentMethodLabels[r.method] },
        {
          key: 'amount',
          label: 'المبلغ',
          align: 'end',
          render: (r) => (
            <span className="inline-flex flex-col items-end">
              <Money value={r.amount} className="font-semibold" />
              {r.status === 'reversed' && (
                <Badge tone="red">ملغى</Badge>
              )}
            </span>
          ),
        },
      ]}
      rowActions={(r) => (
        <>
          <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة الإيصال" title="طباعة الإيصال" onClick={() => openPrint('receipt', r.id)}>
            <Printer className="size-4" />
          </Button>
          {r.status === 'posted' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-red-600"
              aria-label="إلغاء الإيصال"
              title="إلغاء الإيصال"
              onClick={async () => {
                const reason = await askReason({
                  title: `إلغاء الإيصال رقم ${r.receipt_no}؟`,
                  message: (
                    <>
                      يُسجَّل قيد عكسي بقيمة <Money value={r.amount} /> في «{r.treasuries?.name}» بتاريخ اليوم، ويبقى الإيصال ظاهراً كملغى. لا يمكن التراجع.
                    </>
                  ),
                  confirmLabel: 'إلغاء الإيصال',
                })
                if (reason) reverse.mutate({ id: r.id, reason })
              }}
            >
              <Undo2 className="size-4" />
            </Button>
          )}
        </>
      )}
    />
  )
}
