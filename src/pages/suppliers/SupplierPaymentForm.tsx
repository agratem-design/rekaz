import { EntryCard as Section, EntryLayout } from '@/components/EntryWorkspace'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { PartyPicker, financeKeys } from '@/components/pickers'
import { Button, EmptyState, Field, Input, KeyValue, Money, Select, Textarea } from '@/components/ui'
import { formatDate, formatMoney, todayISO } from '@/lib/format'
import { options, paymentMethodLabels } from '@/lib/labels'
import { newKey } from '@/lib/queries'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { PrintOptions } from '../receipts/ReceiptForm'
import { purchaseKindLabels, usePurchases } from '../purchases/purchaseData'

// سداد مورد: لفاتورة محددة، أو على الحساب بتوزيع صريح على الفواتير، والجزء غير الموزع يبقى مقدماً ظاهراً للمورد
export function SupplierPaymentForm({ open, onClose, supplierId, purchaseId }: { open: boolean; onClose: () => void; supplierId?: string; purchaseId?: string }) {
  const qc = useQueryClient()
  const [supplier, setSupplier] = useState(supplierId ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<Enums<'payment_method'>>('cash')
  const [treasury, setTreasury] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [alloc, setAlloc] = useState<Record<string, string>>({})
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  const purchases = usePurchases({ supplierId: supplier || undefined })
  const open_ = (purchases.data ?? []).filter((p) => p.status === 'posted' && p.kind !== 'return' && p.remaining > 0).sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))

  useEffect(() => {
    if (!open) return
    setSupplier(supplierId ?? '')
    setAmount('')
    setDate(todayISO())
    setMethod('cash')
    setTreasury('')
    setReference('')
    setNotes('')
    setAlloc({})
    setKey(newKey())
    setDirty(false)
    setErrors({})
  }, [open, supplierId])

  // فاتورة محددة مسبقاً: نملأ المبلغ بالمتبقي عليها
  useEffect(() => {
    if (!open || !purchaseId || !purchases.data) return
    const p = purchases.data.find((x) => x.id === purchaseId)
    if (p && !alloc[p.id]) {
      setAlloc({ [p.id]: String(p.remaining) })
      setAmount(String(p.remaining))
    }
  }, [open, purchaseId, purchases.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const touch = () => setDirty(true)
  const allocated = Object.values(alloc).reduce((a, v) => a + (Number(v) || 0), 0)
  const amt = Number(amount) || 0
  const advance = Math.round((amt - allocated) * 1000) / 1000
  const projectTypes = new Set(open_.filter((p) => Number(alloc[p.id]) > 0 && p.projects).map((p) => p.projects!.project_type))
  const domain = projectTypes.size === 1 ? [...projectTypes][0] : null

  const autoAllocate = () => {
    let left = amt
    const next: Record<string, string> = {}
    for (const p of open_) {
      if (left <= 0) break
      const a = Math.min(left, p.remaining)
      next[p.id] = String(Math.round(a * 1000) / 1000)
      left -= a
    }
    setAlloc(next)
    touch()
  }

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!supplier) e.supplier = 'اختر المورد'
    if (!(amt > 0)) e.amount = 'أدخل مبلغ الدفعة'
    if (!treasury) e.treasury = 'اختر الخزينة المخصوم منها'
    if (allocated > amt + 0.0005) e.alloc = 'مجموع التوزيع أكبر من مبلغ الدفعة'
    for (const p of open_) if ((Number(alloc[p.id]) || 0) > p.remaining + 0.0005) e.alloc = `التوزيع على فاتورة يتجاوز المتبقي عليها (${formatMoney(p.remaining)})`
    if (projectTypes.size > 1) e.alloc = 'لا تجمع في دفعة واحدة فواتير مشاريع مقاولات وتشطيبات؛ كل قطاع من خزائنه'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('pay_supplier', {
      p_key: key,
      p_supplier_id: supplier,
      p_treasury_id: treasury,
      p_amount: amt,
      p_date: date,
      p_allocations: Object.entries(alloc)
        .filter(([, v]) => Number(v) > 0)
        .map(([purchase_id, v]) => ({ purchase_id, amount: Number(v) })),
      p_method: method,
      p_reference: (reference.trim() || null) as string,
      p_notes: (notes.trim() || null) as string,
    })
    setBusy(false)
    if (error) return toast.error(errorMessage(error)) // المفتاح يبقى؛ إعادة المحاولة لا تكرر الدفعة
    toast.success(advance > 0 ? `تم تسجيل الدفعة، وبقي ${formatMoney(advance)} د.ل مقدماً للمورد` : 'تم تسجيل الدفعة')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    setPrintId(data as string)
    onClose()
  }

  return (
    <>
      <SidePanel
        workspace
        open={open}
        size="lg"
        title="سداد دفعة للمورد"
        description="تخفض مستحق المورد وتخصم من الخزينة. لا تغيّر تكلفة أي مشروع."
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              تسجيل الدفعة
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <EntryLayout summary={<div className="space-y-3">
          <KeyValue label="مبلغ الدفعة"><Money value={amt} /></KeyValue>
          <KeyValue label="الموزع على الفواتير"><Money value={allocated} /></KeyValue>
          <KeyValue label="يبقى مقدماً للمورد"><Money value={Math.max(advance, 0)} /></KeyValue>
        </div>}>
        <Section title="الدفعة">
          <PartyPicker table="suppliers" value={supplier} onChange={(id) => (setSupplier(id), setAlloc({}), touch())} error={errors.supplier} disabled={Boolean(supplierId)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مبلغ الدفعة (د.ل)" required error={errors.amount}>
              <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" className="h-11 text-lg font-semibold" value={amount} onChange={(e) => (setAmount(e.target.value), touch())} />
            </Field>
            <Field label="تاريخ الدفع" required>
              <Input type="date" value={date} onChange={(e) => (setDate(e.target.value), touch())} />
            </Field>
            <Field label="طريقة الدفع">
              <Select value={method} onChange={(e) => (setMethod(e.target.value as typeof method), touch())}>
                {options(paymentMethodLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المرجع">
              <Input value={reference} onChange={(e) => (setReference(e.target.value), touch())} placeholder="رقم الصك أو الحوالة" />
            </Field>
          </div>
          <TreasuryPicker label="الخزينة المخصوم منها" value={treasury} onChange={(id) => (setTreasury(id), touch())} domain={domain} required error={errors.treasury} />
        </Section>

        <Section title="التوزيع على الفواتير المفتوحة">
          {!supplier ? (
            <p className="text-sm text-muted">اختر المورد لعرض فواتيره غير المسددة.</p>
          ) : !open_.length ? (
            <EmptyState title="لا توجد فواتير مفتوحة لهذا المورد">المبلغ كاملاً يُسجَّل دفعة مقدمة تظهر في رصيد المورد حتى توزَّع لاحقاً.</EmptyState>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">وزّع المبلغ صراحة. ما لا يُوزَّع يبقى مقدماً ظاهراً للمورد.</p>
                <Button variant="ghost" size="sm" disabled={!(amt > 0)} onClick={autoAllocate}>
                  <Wand2 className="size-3.5" />
                  توزيع تلقائي (الأقدم أولاً)
                </Button>
              </div>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {open_.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {p.invoice_no ? `#${p.invoice_no} · ` : ''}
                        {p.description ?? purchaseKindLabels[p.kind]}
                      </div>
                      <div className="text-xs text-muted">
                        <span className="num">{formatDate(p.invoice_date)}</span>
                        {p.projects?.name ? ` · ${p.projects.name}` : ' · عامة'} · المتبقي <Money value={p.remaining} />
                      </div>
                    </div>
                    <Input
                      type="number"
                      dir="ltr"
                      step="0.001"
                      min={0}
                      max={p.remaining}
                      className="h-8 w-32"
                      aria-label={`توزيع على ${p.invoice_no ?? p.description ?? 'الفاتورة'}`}
                      value={alloc[p.id] ?? ''}
                      onChange={(e) => (setAlloc({ ...alloc, [p.id]: e.target.value }), touch())}
                    />
                  </li>
                ))}
              </ul>
              {errors.alloc && <p className="text-xs text-red-600">{errors.alloc}</p>}
            </>
          )}
          <div className="rounded-lg bg-surface-2 px-4 py-2">
            <KeyValue label="مبلغ الدفعة">
              <Money value={amt} />
            </KeyValue>
            <KeyValue label="الموزع على الفواتير">
              <Money value={allocated} />
            </KeyValue>
            <KeyValue label="يبقى مقدماً للمورد">
              <Money value={Math.max(advance, 0)} className="font-semibold" />
            </KeyValue>
          </div>
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => (setNotes(e.target.value), touch())} />
          </Field>
        </Section>
        </EntryLayout>
      </SidePanel>
      {printId && <PrintOptions kind="supplier-payment" id={printId} title="تم تسجيل الدفعة" message="هل تريد طباعة سند الصرف الآن؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
