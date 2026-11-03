import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Hammer, Printer, Split } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { AmountCell, ReverseButton, useRpc } from '@/components/pickers'
import { Button, EmptyState, Money } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { rateUnitLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { useTechnicianWork, type WorkRow } from './techData'
import { WorkAdjustDialog } from './WorkAdjustDialog'

export function WorkTable({ phaseId, itemId, technicianId, projectId, onNew }: { phaseId?: string; itemId?: string; technicianId?: string; projectId?: string; onNew?: () => void }) {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const { data, isLoading, error, refetch } = useTechnicianWork({ technicianId, projectId })
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_technician_work', { p_work_id: a.id, p_reason: a.reason }), { success: 'تم إلغاء سجل الأعمال والمستحقات' })
  const shown = (data ?? []).filter((w) => (!phaseId || (phaseId === 'unassigned' ? !w.phase_id : w.phase_id === phaseId)) && (!itemId || w.project_item_id === itemId))
  const total = shown.filter((w) => w.status === 'posted').reduce((a, w) => a + Number(w.amount), 0)
  const [adjusting, setAdjusting] = useState<WorkRow | null>(null)
  return (
    <>
    <DataTable
      rows={shown}
      getKey={(w) => w.id}
      loading={isLoading}
      error={error ? errorMessage(error) : null}
      onRetry={() => refetch()}
      rowClassName={(w) => w.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">سجل الأعمال والمستحقات</span>
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-muted">
              مجموع المستحق <Money value={total} className="font-semibold text-ink" />
            </span>
            {technicianId && shown.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => openPrint('technician-invoice', technicianId, false, { ...(projectId ? { project: projectId } : {}), ...(phaseId ? { phase: phaseId } : {}), ...(itemId ? { item: itemId } : {}) })}>
                <Printer className="size-4" />
                طباعة فاتورة الأعمال المعروضة
              </Button>
            )}
          </span>
        </div>
      }
      empty={<EmptyState icon={Hammer} title="لا توجد أعمال مسجلة" action={onNew && <Button onClick={onNew}>تسجيل عمل ومستحق</Button>} />}
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
      rowActions={(w) => (
        <div className="flex items-center justify-end gap-1">
          {w.status === 'posted' && (
            <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة فاتورة هذا العمل" title="طباعة فاتورة هذا العمل" onClick={() => openPrint('technician-invoice', w.technician_id, false, { work: w.id })}>
              <Printer className="size-4" />
            </Button>
          )}
          {finance && w.status === 'posted' && (
            <Button variant="ghost" size="icon" className="size-8" aria-label="تعديل أو تقسيم العمل" title="زيادة أو إنقاص أو تقسيم بين فنيين" onClick={() => setAdjusting(w)}>
              <Split className="size-4" />
            </Button>
          )}
          {finance && w.status === 'posted' && <ReverseButton title="إلغاء سجل الأعمال والمستحقات؟" message="يُخصم من مستحق الفني ومن تكلفة المشروع." onReverse={(reason) => reverse.mutate({ id: w.id, reason })} />}
        </div>
      )}
    />
    {adjusting && <WorkAdjustDialog work={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  )
}
