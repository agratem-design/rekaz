import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, FolderInput, Printer, Split } from 'lucide-react'
import { AssignProjectDialog } from '@/components/AssignProjectDialog'
import { Modal } from '@/components/dialog'
import { DataTable } from '@/components/DataTable'
import { ReverseButton, useRpc } from '@/components/pickers'
import { Badge, Button, EmptyState, Field, Input, Money, Select } from '@/components/ui'
import { formatDate, formatMoney, todayISO } from '@/lib/format'
import { paymentMethodLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { usePurchases } from '../purchases/purchaseData'

export function useSupplierPayments(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier_payments', supplierId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('supplier_payments')
        .select('*, suppliers(name), treasuries(name), projects(name), supplier_payment_allocations(id, amount, status, purchase_id, purchases(invoice_no, description))')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (supplierId) q = q.eq('supplier_id', supplierId)
      const { data, error } = await q
      if (error) throw error
      return data.map((p) => {
        const allocated = p.supplier_payment_allocations.filter((a) => a.status === 'posted').reduce((s, a) => s + Number(a.amount), 0)
        return { ...p, allocated, unallocated: p.status === 'posted' ? Number(p.amount) - allocated : 0 }
      })
    },
  })
}
export type SupplierPaymentRow = NonNullable<ReturnType<typeof useSupplierPayments>['data']>[number]

export function SupplierPaymentsTable({ supplierId, onNew }: { supplierId?: string; onNew?: () => void }) {
  const { data, isLoading, error, refetch } = useSupplierPayments(supplierId)
  const [allocating, setAllocating] = useState<SupplierPaymentRow | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_supplier_payment', { p_payment_id: a.id, p_reason: a.reason, p_date: todayISO() }), {
    success: 'تم إلغاء الدفعة بقيد عكسي',
  })
  return (
    <>
      <DataTable
        rows={data}
        getKey={(p) => p.id}
        loading={isLoading}
        error={error ? errorMessage(error) : null}
        onRetry={() => refetch()}
        rowClassName={(p) => p.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
        empty={<EmptyState icon={Banknote} title="لا توجد سندات صرف" action={onNew && <Button onClick={onNew}>سداد دفعة للمورد</Button>} />}
        columns={[
          { key: 'date', label: 'التاريخ', render: (p) => <span className="num text-muted">{formatDate(p.payment_date)}</span> },
          ...(!supplierId ? [{ key: 'supplier', label: 'المورد', render: (p: SupplierPaymentRow) => p.suppliers?.name }] : []),
          {
            key: 'alloc',
            label: 'التوزيع',
            render: (p) => (
              <div className="space-y-0.5 text-xs">
                {p.projects?.name && <div className="font-medium">على مشروع {p.projects.name}</div>}
                {p.supplier_payment_allocations
                  .filter((a) => a.status === 'posted')
                  .map((a) => (
                    <div key={a.id}>
                      {a.purchases?.invoice_no ? `فاتورة #${a.purchases.invoice_no}` : (a.purchases?.description ?? 'فاتورة')}: <Money value={a.amount} />
                    </div>
                  ))}
                {p.unallocated > 0 && <Badge tone="sand">مقدم غير موزع {formatMoney(p.unallocated)}</Badge>}
                {!p.supplier_payment_allocations.length && p.status === 'posted' && p.unallocated <= 0 && <span className="text-muted">—</span>}
              </div>
            ),
          },
          { key: 'treasury', label: 'الخزينة', hideBelow: 'md', render: (p) => <span className="text-muted">{p.treasuries?.name}</span> },
          { key: 'method', label: 'الطريقة', hideBelow: 'lg', render: (p) => paymentMethodLabels[p.method] },
          { key: 'amount', label: 'المبلغ', align: 'end', render: (p) => <Money value={p.amount} className="font-semibold" /> },
        ]}
        rowActions={(p) => (
          <>
            <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة سند الصرف" title="طباعة سند الصرف" onClick={() => openPrint('supplier-payment', p.id)}>
              <Printer className="size-4" />
            </Button>
            {p.unallocated > 0 && (
              <Button variant="ghost" size="icon" className="size-8" aria-label="توزيع المقدم" title="توزيع المقدم على فاتورة" onClick={() => setAllocating(p)}>
                <Split className="size-4" />
              </Button>
            )}
            {p.status === 'posted' && p.unallocated > 0 && !p.project_id && (
              <Button variant="ghost" size="icon" className="size-8" aria-label="نقل الدفعة إلى مشروع" title="نقل الدفعة على الحساب إلى مشروع" onClick={() => setAssigning(p.id)}>
                <FolderInput className="size-4" />
              </Button>
            )}
            {p.status === 'posted' && (
              <ReverseButton title="إلغاء الدفعة؟" message="تُلغى الدفعة وتوزيعاتها وتعود قيمتها إلى الخزينة بقيد عكسي بتاريخ اليوم." onReverse={(reason) => reverse.mutate({ id: p.id, reason })} />
            )}
          </>
        )}
      />
      {allocating && <AllocateAdvance payment={allocating} onClose={() => setAllocating(null)} />}
      {assigning && <AssignProjectDialog kind="supplier" paymentId={assigning} onClose={() => setAssigning(null)} />}
    </>
  )
}

function AllocateAdvance({ payment, onClose }: { payment: SupplierPaymentRow; onClose: () => void }) {
  const purchases = usePurchases({ supplierId: payment.supplier_id })
  const open_ = (purchases.data ?? []).filter((p) => p.status === 'posted' && p.kind !== 'return' && p.remaining > 0)
  const [purchase, setPurchase] = useState('')
  const [amount, setAmount] = useState('')
  const target = open_.find((p) => p.id === purchase)
  const max = Math.min(payment.unallocated, target?.remaining ?? 0)
  const amt = Number(amount)
  const allocate = useRpc(() => supabase.rpc('allocate_supplier_advance', { p_payment_id: payment.id, p_purchase_id: purchase, p_amount: amt }), { success: 'تم توزيع المقدم على الفاتورة', onDone: onClose })
  return (
    <Modal
      title="توزيع المقدم على فاتورة"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={allocate.isPending} disabled={!target || !(amt > 0) || amt > max} onClick={() => allocate.mutate(undefined)}>
            توزيع
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">
          المقدم غير الموزع من هذه الدفعة <Money value={payment.unallocated} className="font-semibold text-ink" />. لا تتحرك أي خزينة.
        </p>
        <Field label="الفاتورة">
          <Select
            value={purchase}
            onChange={(e) => {
              setPurchase(e.target.value)
              const p = open_.find((x) => x.id === e.target.value)
              setAmount(String(Math.min(payment.unallocated, p?.remaining ?? 0)))
            }}
          >
            <option value="">— اختر الفاتورة —</option>
            {open_.map((p) => (
              <option key={p.id} value={p.id}>
                {p.invoice_no ? `#${p.invoice_no} — ` : ''}
                {p.description ?? 'فاتورة'} — متبقٍ {formatMoney(p.remaining)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المبلغ (د.ل)" hint={target ? `الحد الأعلى ${formatMoney(max)}` : undefined}>
          <Input type="number" dir="ltr" step="0.001" min={0} max={max} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
