import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { AmountCell, ReverseButton, useRpc } from '@/components/pickers'
import { Button, EmptyState, Money } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { rateUnitLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { useTechnicianWork, type WorkRow } from './techData'

export function WorkTable({ technicianId, projectId, onNew }: { technicianId?: string; projectId?: string; onNew?: () => void }) {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const { data, isLoading, error, refetch } = useTechnicianWork({ technicianId, projectId })
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_technician_work', { p_work_id: a.id, p_reason: a.reason }), { success: 'تم إلغاء سجل الإنجاز' })
  const total = (data ?? []).filter((w) => w.status === 'posted').reduce((a, w) => a + Number(w.amount), 0)
  return (
    <DataTable
      rows={data}
      getKey={(w) => w.id}
      loading={isLoading}
      error={error ? errorMessage(error) : null}
      onRetry={() => refetch()}
      rowClassName={(w) => w.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
      toolbar={
        <div className="flex w-full items-center justify-between text-sm">
          <span className="font-medium">سجل الإنجاز</span>
          <span className="text-muted">
            مجموع المستحق <Money value={total} className="font-semibold text-ink" />
          </span>
        </div>
      }
      empty={<EmptyState icon={Hammer} title="لا توجد أعمال مسجلة" action={onNew && <Button onClick={onNew}>تسجيل إنجاز</Button>} />}
      columns={[
        { key: 'date', label: 'التاريخ', render: (w) => <span className="num text-muted">{formatDate(w.work_date)}</span> },
        ...(!technicianId ? [{ key: 'tech', label: 'الفني', render: (w: WorkRow) => <Link className="font-medium hover:underline" to={`/technicians/${w.technician_id}`}>{w.technicians?.name}</Link> }] : []),
        ...(!projectId ? [{ key: 'project', label: 'المشروع', render: (w: WorkRow) => <Link className="hover:underline" to={`/projects/${w.project_id}`}>{w.projects?.name}</Link> }] : []),
        {
          key: 'desc',
          label: 'العمل',
          render: (w) => (
            <div>
              <div>{w.description ?? w.project_items?.name ?? '—'}</div>
              <div className="text-xs text-muted">{[w.project_phases?.name, w.description ? w.project_items?.name : null].filter(Boolean).join(' · ')}</div>
            </div>
          ),
        },
        {
          key: 'qty',
          label: 'الكمية × السعر',
          hideBelow: 'sm',
          render: (w) => (
            <span className="num text-xs text-muted">
              {formatMoney(w.quantity)} {rateUnitLabels[w.rate_unit]} × {formatMoney(w.rate)}
            </span>
          ),
        },
        { key: 'amount', label: 'المستحق', align: 'end', render: (w) => <AmountCell value={w.amount} reversed={w.status === 'reversed'} /> },
      ]}
      rowActions={
        finance
          ? (w) => (w.status === 'posted' ? <ReverseButton title="إلغاء سجل الإنجاز؟" message="يُخصم من مستحق الفني ومن تكلفة المشروع." onReverse={(reason) => reverse.mutate({ id: w.id, reason })} /> : null)
          : undefined
      }
    />
  )
}
