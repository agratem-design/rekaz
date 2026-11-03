import { useAutomaticDraft } from '@/lib/formDrafts'
import { EntryCard as Section, EntryDetails, EntryLayout } from '@/components/EntryWorkspace'
import { AttachmentField } from '@/components/AttachmentField'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { PartyPicker, ProjectRefPicker, financeKeys } from '@/components/pickers'
import { Button, Field, FilterChips, Input, KeyValue, Money, Select, Textarea, cn } from '@/components/ui'
import { formatMoney, todayISO } from '@/lib/format'
import { options, paymentMethodLabels } from '@/lib/labels'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { PrintOptions } from '../receipts/ReceiptForm'
import { purchaseKindLabels, usePurchases, type PurchaseLine, type PurchaseRow } from './purchaseData'

type Kind = Enums<'purchase_kind'>
type Line = { name: string; quantity: string; unit: string; unit_price: string }
type Form = {
  supplier_id: string
  kind: Kind
  returns_purchase_id: string
  description: string
  invoice_no: string
  date: string
  project_id: string
  phase_id: string
  item_id: string
  mode: 'total' | 'lines'
  total: string
  lines: Line[]
  pay: 'none' | 'now'
  pay_amount: string
  method: Enums<'payment_method'>
  treasury_id: string
  reference: string
  attachment_path: string
  notes: string
}

const units = ['قطعة', 'متر', 'متر مربع', 'متر مكعب', 'كيلو', 'طن', 'لتر', 'كيس', 'كرتون', 'علبة']
const emptyLine = (): Line => ({ name: '', quantity: '1', unit: 'قطعة', unit_price: '' })

const blank = (p: { phaseId?: string; projectId?: string; supplierId?: string; kind?: Kind; returnOf?: PurchaseRow | null }): Form => ({
  supplier_id: p.returnOf?.supplier_id ?? p.supplierId ?? '',
  kind: p.returnOf ? 'return' : (p.kind ?? 'material'),
  returns_purchase_id: p.returnOf?.id ?? '',
  description: p.returnOf ? `مرتجع من فاتورة ${p.returnOf.invoice_no ?? ''}`.trim() : '',
  invoice_no: '',
  date: todayISO(),
  project_id: p.returnOf ? (p.returnOf.project_id ?? '') : (p.projectId ?? ''),
  phase_id: p.returnOf?.phase_id ?? (p.phaseId === 'unassigned' ? '' : p.phaseId ?? ''),
  item_id: p.returnOf?.project_item_id ?? '',
  mode: 'total',
  total: '',
  lines: [emptyLine()],
  pay: 'none',
  pay_amount: '',
  method: 'cash',
  treasury_id: '',
  reference: '',
  attachment_path: '',
  notes: '',
})

// فاتورة مورد بنفس خطوات النظام السابق: المورد ← بيانات الفاتورة ← القيمة (إجمالي أو تفصيل) ← السداد الآن أو ذمة
// الحفظ: record_purchase ثم (إن طُلب) pay_supplier موزعة على هذه الفاتورة. كل دالة بمفتاح ثابت.
export function PurchaseForm({ open, onClose, phaseId, projectId, supplierId, kind, returnOf }: { open: boolean; onClose: () => void; phaseId?: string; projectId?: string; supplierId?: string; kind?: Kind; returnOf?: PurchaseRow | null }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const [form, setForm] = useState<Form>(() => blank({ phaseId, projectId, supplierId, kind, returnOf }))
  const [keys, setKeys] = useState(() => ({ purchase: newKey(), payment: newKey() }))
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null) // فاتورة حُفظت وتعذّر سدادها
  const [printId, setPrintId] = useState<string | null>(null)
  const supplierPurchases = usePurchases({ supplierId: form.supplier_id || undefined })

  useEffect(() => {
    if (!open) return
    setForm(blank({ phaseId, projectId, supplierId, kind, returnOf }))
    setKeys({ purchase: newKey(), payment: newKey() })
    setDirty(false)
    setErrors({})
    setSavedId(null)
  }, [open, phaseId, projectId, supplierId, kind, returnOf])

  const project = (projects.data ?? []).find((p) => p.id === form.project_id)
  const isReturn = form.kind === 'return'
  const original = (supplierPurchases.data ?? []).find((p) => p.id === form.returns_purchase_id)
  const linesTotal = useMemo(() => form.lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0), [form.lines])
  const total = form.mode === 'lines' ? Math.round(linesTotal * 1000) / 1000 : Number(form.total) || 0

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
  }
  const setLine = (i: number, patch: Partial<Line>) => set({ lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  const refresh = () => {
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
  }

  const pay = async (purchaseId: string) => {
    const { error } = await supabase.rpc('pay_supplier', {
      p_key: keys.payment,
      p_supplier_id: form.supplier_id,
      p_treasury_id: form.treasury_id,
      p_amount: Number(form.pay_amount),
      p_date: form.date,
      p_allocations: [{ purchase_id: purchaseId, amount: Number(form.pay_amount) }],
      p_method: form.method,
      p_reference: (form.reference.trim() || null) as string,
      p_notes: `دفعة عند تسجيل الفاتورة ${form.invoice_no || ''}`.trim(),
    })
    return error
  }

  const submit = async () => {
    if (attachmentBusy) return toast.info('انتظر اكتمال رفع المرفق')
    if (busy) return
    const e: Record<string, string> = {}
    if (!form.supplier_id) e.supplier_id = 'اختر المورد'
    if (isReturn && !form.returns_purchase_id) e.returns_purchase_id = 'اختر الفاتورة الأصلية'
    if (!(total > 0)) e.total = 'أدخل قيمة الفاتورة'
    if (form.mode === 'lines' && form.lines.some((l) => !l.name.trim() || !Number.isFinite(Number(l.quantity)) || !(Number(l.quantity) > 0) || l.unit_price.trim() === '' || !Number.isFinite(Number(l.unit_price)) || Number(l.unit_price) < 0)) e.total = 'أكمل بيان وكمية وسعر كل سطر، أو احذف الأسطر الزائدة؛ لا يُحفظ سطر بلا بيان'
    if (isReturn && original && total > original.total_amount) e.total = `المرتجع أكبر من قيمة الفاتورة الأصلية (${formatMoney(original.total_amount)})`
    if (!form.date) e.date = 'التاريخ مطلوب'
    if (!isReturn && form.pay === 'now') {
      const amt = Number(form.pay_amount)
      if (!(amt > 0)) e.pay_amount = 'أدخل مبلغ الدفع'
      else if (amt > total) e.pay_amount = 'مبلغ الدفع أكبر من قيمة الفاتورة'
      if (!form.treasury_id) e.treasury_id = 'اختر الخزينة المخصوم منها'
    }
    setErrors(e)
    if (Object.keys(e).length) return

    setBusy(true)
    try {
      let id = savedId
      if (!id) {
        const lines: PurchaseLine[] =
          form.mode === 'lines'
            ? form.lines
                .filter((l) => l.name.trim())
                .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity), unit: l.unit, unit_price: Number(l.unit_price) || 0, total: Math.round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * 1000) / 1000 }))
            : []
        const { data, error } = await supabase.rpc('record_purchase', {
          p_key: keys.purchase,
          p_supplier_id: form.supplier_id,
          p_kind: form.kind,
          p_total: total,
          p_date: form.date,
          p_project_id: (form.project_id || null) as string,
          p_phase_id: (form.phase_id || null) as string,
          p_item_id: (form.item_id || null) as string,
          p_invoice_no: (form.invoice_no.trim() || null) as string,
          p_description: (form.description.trim() || null) as string,
          p_lines: lines,
          p_returns_purchase_id: (form.returns_purchase_id || null) as string,
          p_attachment_path: (form.attachment_path.trim() || null) as string,
          p_notes: (form.notes.trim() || null) as string,
        })
        if (error) throw error
        id = data as string
      }
      if (!isReturn && form.pay === 'now') {
        const err = await pay(id)
        if (err) {
          setSavedId(id)
          refresh()
          toast.error(`حُفظت الفاتورة كذمة غير مسددة، وتعذّر قيد الدفعة: ${errorMessage(err)}`)
          return
        }
      }
      toast.success(isReturn ? 'تم تسجيل المرتجع' : form.pay === 'now' ? 'تم قيد الفاتورة وسداد الدفعة' : 'تم قيد الفاتورة كذمة مستحقة للمورد')
      refresh()
      setPrintId(id)
      onClose()
    } catch (err) {
      toast.error(`${errorMessage(err)} — بياناتك ما زالت في النموذج`)
    } finally {
      setBusy(false)
    }
  }

  const returnable = (supplierPurchases.data ?? []).filter((p) => p.status === 'posted' && p.kind !== 'return')

  useAutomaticDraft(`purchase:${projectId??'general'}:${phaseId??''}:${supplierId??''}:${returnOf?.id??''}`, open, { form, keys, savedId }, dirty, (saved) => { setForm(saved.form); setKeys(saved.keys); setSavedId(saved.savedId); setDirty(true) })

  return (
    <>
      <SidePanel
        workspace
        open={open}
        size="xl"
        title={isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات'}
        description={isReturn ? 'يُطرح من مستحق المورد ومن تكلفة المشروع' : 'التزام على المشروع وذمة للمورد. السداد اختياري الآن أو لاحقاً'}
        dirty={dirty}
        onClose={() => { if (attachmentBusy || busy) { toast.info('انتظر اكتمال العملية'); return } onClose() }}
        footer={
          savedId ? (
            <>
              <Button loading={busy} disabled={attachmentBusy} onClick={submit}>
                إعادة محاولة تسجيل الدفعة فقط
              </Button>
              <Button variant="secondary" onClick={onClose}>
                إغلاق ومتابعة السداد لاحقاً
              </Button>
            </>
          ) : (
            <>
              <Button loading={busy} disabled={attachmentBusy} onClick={submit}>
                {isReturn ? 'حفظ المرتجع' : 'حفظ الفاتورة'}
              </Button>
              <Button variant="secondary" disabled={attachmentBusy || busy} onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
                إلغاء
              </Button>
            </>
          )
        }
      >
        {savedId && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            تم حفظ الفاتورة كالتزام غير مسدد، لكن تعذّر تسجيل الدفعة. أعد المحاولة أو أغلق وسدّدها لاحقاً من صفحة المورد.
          </div>
        )}
        <fieldset disabled={Boolean(savedId) || busy} className="min-w-0">
          <EntryLayout summary={<div className="space-y-3">
            <p className="font-semibold">{isReturn ? 'مرتجع مشتريات' : 'فاتورة المورد'}</p>
            <p className="text-sm text-muted">{project?.name ?? 'مشتريات عامة للشركة'}</p>
            <KeyValue label="قيمة الفاتورة"><Money value={total} /></KeyValue>
            {!isReturn && <><KeyValue label="المدفوع الآن"><Money value={form.pay === 'now' ? Number(form.pay_amount) || 0 : 0} /></KeyValue><KeyValue label="المتبقي للمورد"><Money value={total - (form.pay === 'now' ? Number(form.pay_amount) || 0 : 0)} /></KeyValue></>}
          </div>}>
          {!returnOf && (
            <FilterChips
              value={form.kind}
              onChange={(k) => set({ kind: k, returns_purchase_id: '', pay: 'none' })}
              options={[
                { value: 'material', label: `شراء ${purchaseKindLabels.material}` },
                { value: 'service', label: purchaseKindLabels.service },
                { value: 'return', label: purchaseKindLabels.return },
              ]}
            />
          )}
          <Section title="المورد">
            <PartyPicker table="suppliers" value={form.supplier_id} onChange={(id) => set({ supplier_id: id, returns_purchase_id: '' })} error={errors.supplier_id} disabled={Boolean(supplierId || returnOf)} />
            {isReturn && (
              <Field label="الفاتورة الأصلية" required error={errors.returns_purchase_id} hint="المرتجع يتبع مورد ومشروع الفاتورة الأصلية">
                <Select
                  value={form.returns_purchase_id}
                  disabled={!form.supplier_id || Boolean(returnOf)}
                  onChange={(e) => {
                    const o = returnable.find((p) => p.id === e.target.value)
                    set({ returns_purchase_id: e.target.value, project_id: o?.project_id ?? '', phase_id: o?.phase_id ?? '', item_id: o?.project_item_id ?? '' })
                  }}
                >
                  <option value="">— اختر الفاتورة —</option>
                  {returnable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.invoice_no ? `#${p.invoice_no} — ` : ''}
                      {p.description ?? purchaseKindLabels[p.kind]} — {formatMoney(p.total_amount)} د.ل
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </Section>

          <Section title="بيانات الفاتورة">
            <Field label="عنوان الفاتورة" hint="يظهر في الفاتورة المطبوعة">
              <Input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="مثال: مواد سباكة الدور الأرضي" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم الفاتورة (اختياري)">
                <Input dir="ltr" value={form.invoice_no} onChange={(e) => set({ invoice_no: e.target.value })} placeholder="INV-2026-001" />
              </Field>
              <Field label="تاريخ الفاتورة" required error={errors.date}>
                <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
            </div>
            <ProjectRefPicker
              projectId={form.project_id}
              phaseId={form.phase_id}
              itemId={form.item_id}
              fixedProject={Boolean(projectId) || isReturn}
              onChange={(v) => set({ project_id: v.projectId, phase_id: v.phaseId, item_id: v.itemId, treasury_id: '' })}
            />
            {!form.project_id && <p className="text-xs text-muted">بلا مشروع: مشتريات عامة للشركة لا تدخل تكلفة أي مشروع.</p>}
          </Section>

          <Section title={isReturn ? 'قيمة المرتجع' : 'قيمة المواد والمشتريات'}>
            <FilterChips
              value={form.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                { value: 'total', label: 'إجمالي مباشر' },
                { value: 'lines', label: 'تفصيل بنود الفاتورة' },
              ]}
            />
            {form.mode === 'total' ? (
              <Field label="إجمالي قيمة الفاتورة (د.ل)" required error={errors.total}>
                <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" className="h-11 text-lg font-semibold" value={form.total} onChange={(e) => set({ total: e.target.value })} />
              </Field>
            ) : (
              <div className="space-y-2">
                {form.lines.map((l, i) => (
                  <div key={i} className="grid min-w-0 grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_6.5rem_auto] rounded-xl border border-line bg-surface-2 p-3">
                    <Field className="col-span-2 sm:col-span-1" label="المادة">
                      <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="اسم المادة…" aria-label="اسم المادة" />
                    </Field>
                    <Field label="الكمية">
                      <Input type="number" dir="ltr" step="0.001" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="الكمية" />
                    </Field>
                    <Field label="الوحدة">
                      <Select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} aria-label="الوحدة">
                        {units.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="السعر">
                      <Input type="number" dir="ltr" step="0.001" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} aria-label="السعر" />
                    </Field>
                    <Button variant="ghost" size="icon" className="hover:text-red-600" aria-label="حذف السطر" disabled={form.lines.length === 1} onClick={() => set({ lines: form.lines.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button variant="secondary" size="sm" onClick={() => set({ lines: [...form.lines, emptyLine()] })}>
                    <Plus className="size-3.5" />
                    إضافة مادة أخرى
                  </Button>
                  <span className="text-sm">
                    الإجمالي المحسوب <Money value={linesTotal} className="font-semibold" />
                  </span>
                </div>
                {errors.total && <p className="text-xs text-red-600">{errors.total}</p>}
              </div>
            )}
          </Section>

          {!isReturn && (
            <Section title="حالة السداد">
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['none', 'غير مسدد (ذمة مورد)', 'تُسجَّل الفاتورة التزاماً على المشروع وذمة للمورد دون أي خصم من الخزينة'],
                    ['now', 'دفع مبلغ الآن', 'تُسجَّل دفعة من الخزينة وتُوزَّع على هذه الفاتورة'],
                  ] as const
                ).map(([v, t, d]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set({ pay: v, pay_amount: v === 'now' && !form.pay_amount ? String(total || '') : form.pay_amount })}
                    className={cn('rounded-lg border p-3 text-right text-sm transition', form.pay === v ? 'border-brand-500 bg-accent-soft ring-2 ring-brand-500/20' : 'border-line-strong hover:bg-surface-2')}
                  >
                    <div className="font-medium">{t}</div>
                    <div className="mt-0.5 text-xs text-muted">{d}</div>
                  </button>
                ))}
              </div>
              {form.pay === 'now' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="المبلغ المدفوع الآن (د.ل)" required error={errors.pay_amount}>
                      <Input type="number" dir="ltr" step="0.001" min={0} value={form.pay_amount} onChange={(e) => set({ pay_amount: e.target.value })} />
                    </Field>
                    <Field label="طريقة الدفع">
                      <Select value={form.method} onChange={(e) => set({ method: e.target.value as Form['method'] })}>
                        {options(paymentMethodLabels).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <TreasuryPicker label="الخزينة المخصوم منها" value={form.treasury_id} onChange={(id) => set({ treasury_id: id })} domain={project?.project_type ?? null} required error={errors.treasury_id} need={Number(form.pay_amount) || undefined} />
                  <Field label="المرجع (رقم الصك أو الحوالة)">
                    <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
                  </Field>
                </>
              )}
              <div className="rounded-lg bg-surface-2 px-4 py-2">
                <KeyValue label="قيمة الفاتورة">
                  <Money value={total} />
                </KeyValue>
                <KeyValue label="المدفوع الآن">
                  <Money value={form.pay === 'now' ? Number(form.pay_amount) || 0 : 0} />
                </KeyValue>
                <KeyValue label="المتبقي للمورد">
                  <Money value={total - (form.pay === 'now' ? Number(form.pay_amount) || 0 : 0)} className="font-semibold" />
                </KeyValue>
              </div>
            </Section>
          )}

          <EntryDetails title="المرفقات والملاحظات (اختياري)">
            <AttachmentField value={form.attachment_path} onChange={(attachment_path)=>set({attachment_path})} folder="ركاز/فواتير الموردين" onBusyChange={setAttachmentBusy} disabled={busy || Boolean(savedId)} />
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="أي تفاصيل أو ملاحظات حول هذه الفاتورة…" aria-label="ملاحظات" />
          </EntryDetails>
          </EntryLayout>
        </fieldset>
      </SidePanel>
      {printId && <PrintOptions kind="purchase" id={printId} title="تم حفظ الفاتورة" message="هل تريد طباعة الفاتورة الآن؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
