import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { AmountCell, ReverseButton, financeKeys, useRpc } from '@/components/pickers'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { Button, EmptyState, Field, Input, KeyValue, Money, Section, Select, Textarea } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { options, paymentMethodLabels } from '@/lib/labels'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { useSupplierProjects } from '../payments/settlementData'
import { PrintOptions } from '../receipts/ReceiptForm'

// المفتاح تحت دفعات المورد ليتحدث بعد كل عملية مالية
export function useSupplierRefunds(supplierId: string) {
  return useQuery({
    queryKey: ['supplier_payments', 'refunds', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_refunds').select('*, treasuries(name), projects(name)').eq('supplier_id', supplierId).order('refund_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function SupplierRefundsTable({ supplierId }: { supplierId: string }) {
  const { data, isLoading } = useSupplierRefunds(supplierId)
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_supplier_refund', { p_refund_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء الاستلام' })
  return (
    <DataTable
      rows={data}
      getKey={(r) => r.id}
      loading={isLoading}
      rowClassName={(r) => r.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
      empty={<EmptyState icon={ArrowDownToLine} title="لم يُستلم أي مبلغ من هذا المورد" />}
      columns={[
        { key: 'date', label: 'التاريخ', render: (r) => <span className="num text-muted">{formatDate(r.refund_date)}</span> },
        { key: 'project', label: 'المشروع', render: (r) => r.projects?.name ?? <span className="text-muted">على الحساب</span> },
        { key: 'treasury', label: 'الخزينة', hideBelow: 'md', render: (r) => r.treasuries?.name },
        { key: 'amount', label: 'المبلغ', align: 'end', render: (r) => <AmountCell value={r.amount} reversed={r.status === 'reversed'} /> },
      ]}
      rowActions={(r) => (
        <>
          <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة السند" title="طباعة السند" onClick={() => openPrint('supplier-refund', r.id)}>
            <Printer className="size-4" />
          </Button>
          {r.status === 'posted' && <ReverseButton title="إلغاء الاستلام؟" onReverse={(reason) => reverse.mutate({ id: r.id, reason })} />}
        </>
      )}
    />
  )
}

// استلام مبلغ من مورد: مرتجع على فاتورة مسددة أو دفعة زائدة. لا يتجاوز ما لنا عنده.
export function SupplierRefundForm({ open, onClose, supplierId }: { open: boolean; onClose: () => void; supplierId: string }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const balances = useSupplierProjects({ supplierId }, open)
  const [project, setProject] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<Enums<'payment_method'>>('cash')
  const [treasury, setTreasury] = useState('')
  const [notes, setNotes] = useState('')
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setProject('')
    setAmount('')
    setDate(todayISO())
    setTreasury('')
    setNotes('')
    setKey(newKey())
  }, [open])
  const rows = balances.data ?? []
  const credit = (id: string | null) => {
    const list = id ? rows.filter((r) => r.project_id === id) : rows
    return Math.max(-list.reduce((a, r) => a + Number(r.balance_due), 0), 0)
  }
  const available = credit(project || null)
  const withCredit = rows.filter((r) => r.project_id && Number(r.balance_due) < 0)
  const domain = (projects.data ?? []).find((p) => p.id === project)?.project_type ?? null
  const dirty = Boolean(amount || notes)
  const submit = async () => {
    const amt = Number(amount)
    if (!(amt > 0)) return toast.error('أدخل المبلغ')
    if (amt > available) return toast.error('المبلغ أكبر مما لنا عند المورد')
    if (!treasury) return toast.error('اختر الخزينة المستلمة')
    setBusy(true)
    const { data, error } = await supabase.rpc('receive_from_supplier', { p_key: key, p_supplier_id: supplierId, p_treasury_id: treasury, p_amount: amt, p_date: date, p_project_id: (project || null) as string, p_method: method, p_notes: (notes.trim() || null) as string })
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('تم استلام المبلغ من المورد')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    setPrintId(data as string)
    onClose()
  }
  return (
    <>
      <SidePanel
        open={open}
        title="استلام مبلغ من المورد"
        description="مرتجع على فاتورة مسددة أو دفعة زائدة: يدخل الخزينة ويقلّص ما لنا عند المورد."
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              استلام
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <Section title="المبلغ">
          <Field label="عن مشروع" hint="اتركه فارغاً إن كان الرصيد على حساب المورد العام">
            <Select value={project} onChange={(e) => (setProject(e.target.value), setTreasury(''))}>
              <option value="">— على حساب المورد —</option>
              {withCredit.map((r) => (
                <option key={r.project_id} value={r.project_id!}>
                  {(projects.data ?? []).find((p) => p.id === r.project_id)?.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-lg bg-surface-2 px-4 py-2">
            <KeyValue label="لنا عند المورد"><Money value={available} className="font-semibold" /></KeyValue>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المبلغ (د.ل)" required>
              <Input type="number" dir="ltr" step="0.001" min={0} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="التاريخ" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="طريقة الاستلام">
              <Select value={method} onChange={(e) => setMethod(e.target.value as Enums<'payment_method'>)}>
                {options(paymentMethodLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <TreasuryPicker label="الخزينة المستلمة" value={treasury} onChange={setTreasury} domain={domain} required />
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </Section>
      </SidePanel>
      {printId && <PrintOptions kind="supplier-refund" id={printId} title="تم الاستلام" message="هل تريد طباعة سند الاستلام؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
