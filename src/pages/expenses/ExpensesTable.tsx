import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Paperclip, Printer, Wallet } from 'lucide-react'
import { DataTable, RecordCount } from '@/components/DataTable'
import { AmountCell, ReverseButton, useRpc } from '@/components/pickers'
import { Badge, Button, EmptyState, FilterChips, Money, SearchInput } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { useExpenses, type ExpenseRow } from './expenseData'

type Scope = 'all' | 'general' | 'projects'

export function ExpensesTable({ phaseId, projectId, custodyId, onNew, scopeFilter }: { phaseId?: string; projectId?: string; custodyId?: string; onNew?: () => void; scopeFilter?: boolean }) {
  const { data, isLoading, error, refetch } = useExpenses({ projectId, custodyId })
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [showReversed, setShowReversed] = useState(false)
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_expense', { p_expense_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء المصروف' })
  const all = (data ?? []).filter((r) => !phaseId || (phaseId === 'unassigned' ? !r.phase_id : r.phase_id === phaseId))
  const q = search.trim()
  const shown = all.filter(
    (e) =>
      (showReversed || e.status === 'posted') &&
      (scope === 'all' || (scope === 'general' ? !e.project_id : Boolean(e.project_id))) &&
      (!q || e.description.includes(q) || (e.expense_categories?.name ?? '').includes(q) || (e.projects?.name ?? '').includes(q)),
  )
  const total = shown.filter((e) => e.status === 'posted').reduce((a, e) => a + Number(e.amount), 0)
  return (
    <DataTable
      rows={shown}
      getKey={(e) => e.id}
      loading={isLoading}
      error={error ? errorMessage(error) : null}
      onRetry={() => refetch()}
      rowClassName={(e) => e.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
      toolbar={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالبيان، الفئة، المشروع…" />
          {scopeFilter && (
            <FilterChips
              value={scope}
              onChange={setScope}
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'general', label: 'عامة' },
                { value: 'projects', label: 'مشاريع' },
              ]}
            />
          )}
          <FilterChips
            value={showReversed ? 'yes' : 'no'}
            onChange={(v) => setShowReversed(v === 'yes')}
            options={[
              { value: 'no', label: 'السارية' },
              { value: 'yes', label: 'مع الملغاة' },
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
      empty={<EmptyState icon={Coins} title="لا توجد مصروفات" action={onNew && <Button onClick={onNew}>تسجيل مصروف</Button>} />}
      columns={[
        { key: 'date', label: 'التاريخ', render: (e) => <span className="num text-muted">{formatDate(e.expense_date)}</span> },
        {
          key: 'desc',
          label: 'البيان',
          render: (e) => (
            <div>
              <div className="font-medium">
                {e.description}
                {e.attachment_path && (
                  <a href={e.attachment_path} target="_blank" rel="noreferrer" className="ms-1 text-faint hover:text-ink" aria-label="عرض المرفق" onClick={(x) => x.stopPropagation()}>
                    <Paperclip className="inline size-3.5" />
                  </a>
                )}
              </div>
              {e.expense_categories && <div className="text-xs text-muted">{e.expense_categories.name}</div>}
            </div>
          ),
        },
        ...(!projectId
          ? [
              {
                key: 'project',
                label: 'المشروع',
                hideBelow: 'md' as const,
                render: (e: ExpenseRow) =>
                  e.project_id ? (
                    <Link to={`/projects/${e.project_id}/expenses`} className="hover:underline">
                      {e.projects?.name}
                    </Link>
                  ) : (
                    <Badge>عام</Badge>
                  ),
              },
            ]
          : [{ key: 'phase', label: 'المرحلة / البند', hideBelow: 'md' as const, render: (e: ExpenseRow) => <span className="text-xs text-muted">{[e.project_phases?.name, e.project_items?.name].filter(Boolean).join(' · ') || '—'}</span> }]),
        {
          key: 'source',
          label: 'المصدر',
          hideBelow: 'sm',
          render: (e) =>
            e.custody_id ? (
              <Badge tone="sand">
                <Wallet className="size-3" /> عهدة
              </Badge>
            ) : (
              <span className="text-muted">{e.treasuries?.name}</span>
            ),
        },
        { key: 'amount', label: 'المبلغ', align: 'end', render: (e) => <AmountCell value={e.amount} reversed={e.status === 'reversed'} /> },
      ]}
      rowActions={(e) => (
        <>
          <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة السند" title="طباعة سند الصرف" onClick={() => openPrint('expense', e.id)}>
            <Printer className="size-4" />
          </Button>
          {e.status === 'posted' && (
            <ReverseButton title="إلغاء المصروف؟" message={e.custody_id ? 'يعود المبلغ إلى رصيد العهدة.' : 'يعود المبلغ إلى الخزينة بقيد عكسي بتاريخ اليوم.'} onReverse={(reason) => reverse.mutate({ id: e.id, reason })} />
          )}
        </>
      )}
    />
  )
}
