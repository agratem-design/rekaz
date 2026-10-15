import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { ProjectRefPicker, financeKeys } from '@/components/pickers'
import { Button, Field, FilterChips, Input, KeyValue, Money, Section, Select, Textarea } from '@/components/ui'
import { formatMoney, todayISO } from '@/lib/format'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { PrintOptions } from '../receipts/ReceiptForm'
import { useCustodies, useExpenseCategories } from './expenseData'

// مصروف من خزينة أو من عهدة. مصروف المشروع يدخل تكلفته، والعام لا يدخل أي مشروع.
export function ExpenseForm({ open, onClose, projectId, custodyId }: { open: boolean; onClose: () => void; projectId?: string; custodyId?: string }) {
  const qc = useQueryClient()
  const cats = useExpenseCategories()
  const custodies = useCustodies()
  const projects = useProjectsFinancials()
  const blank = () => ({
    description: '',
    amount: '',
    date: todayISO(),
    category_id: '',
    source: (custodyId ? 'custody' : 'treasury') as 'treasury' | 'custody',
    treasury_id: '',
    custody_id: custodyId ?? '',
    project_id: projectId ?? '',
    phase_id: '',
    item_id: '',
    invoice_no: '',
    attachment_path: '',
    notes: '',
  })
  const [f, setF] = useState(blank)
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setF(blank())
    setKey(newKey())
    setDirty(false)
    setErrors({})
  }, [open, projectId, custodyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCustodies = (custodies.data ?? []).filter((c) => c.status === 'posted' && !c.is_closed && (c.remaining > 0 || c.id === f.custody_id))
  const custody = openCustodies.find((c) => c.id === f.custody_id)
  // عهدة المشروع لا تُصرف إلا على نفس المشروع
  useEffect(() => {
    if (custody?.project_id && f.project_id !== custody.project_id) setF((p) => ({ ...p, project_id: custody.project_id!, phase_id: '', item_id: '' }))
  }, [custody?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const project = (projects.data ?? []).find((p) => p.id === f.project_id)

  const set = (patch: Partial<typeof f>) => {
    setF((p) => ({ ...p, ...patch }))
    setDirty(true)
    setErrors({})
  }

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.description.trim()) e.description = 'البيان مطلوب'
    const amt = Number(f.amount)
    if (!(amt > 0)) e.amount = 'أدخل المبلغ'
    if (f.source === 'treasury' && !f.treasury_id) e.treasury = 'اختر الخزينة'
    if (f.source === 'custody') {
      if (!f.custody_id) e.custody = 'اختر العهدة'
      else if (custody && amt > custody.remaining) e.amount = `المتبقي في العهدة ${formatMoney(custody.remaining)} فقط`
    }
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('record_expense', {
      p_key: key,
      p_description: f.description.trim(),
      p_amount: amt,
      p_date: f.date,
      p_treasury_id: (f.source === 'treasury' ? f.treasury_id : null) as string,
      p_custody_id: (f.source === 'custody' ? f.custody_id : null) as string,
      p_project_id: (f.project_id || null) as string,
      p_phase_id: (f.phase_id || null) as string,
      p_item_id: (f.item_id || null) as string,
      p_category_id: (f.category_id || null) as string,
      p_invoice_no: (f.invoice_no.trim() || null) as string,
      p_attachment_path: (f.attachment_path.trim() || null) as string,
      p_notes: (f.notes.trim() || null) as string,
    })
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('تم تسجيل المصروف')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    setPrintId(data as string)
    onClose()
  }

  return (
    <>
      <SidePanel
        open={open}
        size="lg"
        title={f.project_id ? 'مصروف مباشر للمشروع' : 'مصروف عام'}
        description="نثريات، وقود، ضيافة، ومصروفات موقعية"
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              حفظ المصروف
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <Section title="المصروف">
          <Field label="البيان" required error={errors.description}>
            <Input value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="مثال: وقود سيارة الموقع" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="المبلغ (د.ل)" required error={errors.amount}>
              <Input type="number" dir="ltr" step="0.001" min={0} className="font-semibold" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
            <Field label="التاريخ" required>
              <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="الفئة">
              <Select value={f.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                <option value="">—</option>
                {(cats.data ?? [])
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <ProjectRefPicker projectId={f.project_id} phaseId={f.phase_id} itemId={f.item_id} fixedProject={Boolean(projectId) || Boolean(custody?.project_id)} onChange={(v) => set({ project_id: v.projectId, phase_id: v.phaseId, item_id: v.itemId, treasury_id: '' })} />
          {!f.project_id && <p className="text-xs text-muted">بلا مشروع: مصروف عام للشركة لا يدخل تكلفة أي مشروع.</p>}
        </Section>

        <Section title="مصدر الصرف">
          {!custodyId && (
            <FilterChips
              value={f.source}
              onChange={(s) => set({ source: s })}
              options={[
                { value: 'treasury', label: 'من خزينة' },
                { value: 'custody', label: 'من عهدة' },
              ]}
            />
          )}
          {f.source === 'treasury' ? (
            <TreasuryPicker label="الخزينة" value={f.treasury_id} onChange={(id) => set({ treasury_id: id })} domain={project?.project_type ?? null} required error={errors.treasury} />
          ) : (
            <>
              <Field label="العهدة" required error={errors.custody} hint="المصروف من العهدة لا يحرك أي خزينة؛ يخفض المتبقي في العهدة">
                <Select value={f.custody_id} disabled={Boolean(custodyId)} onChange={(e) => set({ custody_id: e.target.value })}>
                  <option value="">— اختر العهدة —</option>
                  {openCustodies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.holder}
                      {c.projects?.name ? ` — ${c.projects.name}` : ''} — متبقٍ {formatMoney(c.remaining)}
                    </option>
                  ))}
                </Select>
              </Field>
              {custody && (
                <div className="rounded-lg bg-surface-2 px-4 py-2">
                  <KeyValue label="المتبقي في العهدة">
                    <Money value={custody.remaining} />
                  </KeyValue>
                  <KeyValue label="بعد هذا المصروف">
                    <Money value={custody.remaining - (Number(f.amount) || 0)} className="font-semibold" />
                  </KeyValue>
                </div>
              )}
            </>
          )}
        </Section>

        <Section title="مرفق وملاحظات">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الفاتورة">
              <Input dir="ltr" value={f.invoice_no} onChange={(e) => set({ invoice_no: e.target.value })} />
            </Field>
            <Field label="رابط المرفق">
              <Input dir="ltr" value={f.attachment_path} onChange={(e) => set({ attachment_path: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="ملاحظات" placeholder="ملاحظات" />
        </Section>
      </SidePanel>
      {printId && <PrintOptions kind="expense" id={printId} title="تم تسجيل المصروف" message="هل تريد طباعة سند صرف المصروف؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
