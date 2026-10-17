import { useAutomaticDraft } from '@/lib/formDrafts'
import { AttachmentField } from '@/components/AttachmentField'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EntryCard, EntryDetails, EntryLayout } from '@/components/EntryWorkspace'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { ProjectRefPicker, financeKeys } from '@/components/pickers'
import { Button, Field, FilterChips, Input, KeyValue, Money, Select, Textarea } from '@/components/ui'
import { formatMoney, todayISO } from '@/lib/format'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { PrintOptions } from '../receipts/ReceiptForm'
import { useCustodies, useExpenseCategories } from './expenseData'

// مصروف من خزينة أو من عهدة. مصروف المشروع يدخل تكلفته، والعام لا يدخل أي مشروع.
export function ExpenseForm({ phaseId, open, onClose, projectId, custodyId }: { phaseId?: string; open: boolean; onClose: () => void; projectId?: string; custodyId?: string }) {
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
    phase_id: phaseId === 'unassigned' ? '' : phaseId ?? '',
    item_id: '',
    invoice_no: '',
    attachment_path: '',
    notes: '',
  })
  const descriptionRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [savedCount, setSavedCount] = useState(0)
  const [f, setF] = useState(blank)
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSavedCount(0)
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

  const submit = async (another = false) => {
    if (submitting.current) return
    if (attachmentBusy) return toast.info('انتظر اكتمال رفع المرفق')
    const e: Record<string, string> = {}
    if (!f.date || !Number.isFinite(Date.parse(f.date))) e.date = 'أدخل تاريخًا صحيحًا'
    if (!f.date || !Number.isFinite(Date.parse(f.date))) e.date = 'أدخل تاريخًا صحيحًا'
    if (!f.date || !Number.isFinite(Date.parse(f.date))) e.date = 'أدخل تاريخًا صحيحًا'
    if (!f.date || !Number.isFinite(Date.parse(f.date))) e.date = 'أدخل تاريخًا صحيحًا'
    if (!f.date || !Number.isFinite(Date.parse(f.date))) e.date = 'أدخل تاريخًا صحيحًا'
    if (!f.description.trim()) e.description = 'البيان مطلوب'
    const amt = Number(f.amount)
    if (!(amt > 0) || !Number.isFinite(amt)) e.amount = 'أدخل المبلغ'
    if (f.source === 'treasury' && !f.treasury_id) e.treasury = 'اختر الخزينة'
    if (f.source === 'custody') {
      if (!f.custody_id) e.custody = 'اختر العهدة'
      else if (custody && amt > custody.remaining) e.amount = `المتبقي في العهدة ${formatMoney(custody.remaining)} فقط`
    }
    setErrors(e)
    if (Object.keys(e).length) return
    submitting.current = true
    setBusy(true)
    try {
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
    if (error) throw error
    toast.success('تم تسجيل المصروف')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    if (another) {
      setF((previous) => ({ ...previous, description: '', amount: '', invoice_no: '', attachment_path: '', notes: '', item_id: '' }))
      setKey(newKey())
      setDirty(false)
      setErrors({})
      setSavedCount((count) => count + 1)
      requestAnimationFrame(() => descriptionRef.current?.focus())
    } else { setPrintId(data as string); onClose() }
    } catch (error) { toast.error(errorMessage(error)) }
    finally { submitting.current = false; setBusy(false) }
  }

  useAutomaticDraft(`expense:${projectId??'general'}:${phaseId??''}:${custodyId??''}`, open, { f, key }, dirty, (saved) => { setF(saved.f); setKey(saved.key); setDirty(true) })

  return (
    <>
      <SidePanel
        open={open}
        workspace
        title={f.project_id ? 'مصروف مباشر للمشروع' : 'مصروف عام'}
        description="أدخل البيان والمبلغ، اختر مصدر الصرف، ثم احفظ. التفاصيل الإضافية اختيارية."
        dirty={dirty}
        onClose={() => { if (attachmentBusy || busy) { toast.info('انتظر اكتمال العملية'); return } onClose() }}
        footer={
          <>
            <Button loading={busy} disabled={attachmentBusy} onClick={() => submit(false)}>
              حفظ المصروف
            </Button>
            <Button variant="secondary" disabled={attachmentBusy || busy} onClick={() => submit(true)}>حفظ وإضافة التالي</Button>
            {savedCount > 0 && <span role="status" className="text-sm text-muted">تم حفظ {savedCount} مصروفات في هذه الجلسة</span>}
            <Button variant="ghost" disabled={attachmentBusy || busy} onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <fieldset disabled={busy} className="min-w-0">
        <EntryLayout summary={<div className="space-y-3">
          <p className="break-words font-semibold">{f.description || 'مصروف جديد'}</p>
          <p className="text-sm text-muted">{project?.name ?? 'مصروف عام للشركة'}</p>
          <KeyValue label="مصدر الصرف">{f.source === 'custody' ? 'عهدة' : 'خزينة'}</KeyValue>
          <KeyValue label="التاريخ">{f.date}</KeyValue>
          <div className="border-t border-line pt-4"><span className="text-sm text-muted">قيمة المصروف</span><Money value={Number(f.amount) || 0} className="mt-2 block text-2xl font-semibold" /></div>
        </div>}>
        <EntryCard title="ما المصروف الذي دفعته؟" description="بيان واضح ومبلغ وتاريخ؛ هذا كل ما تحتاجه لوصف المصروف.">
          <Field label="البيان" required error={errors.description}>
            <Input ref={descriptionRef} className="h-12 text-base" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="مثال: وقود سيارة الموقع" />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field className="col-span-2 sm:col-span-1" label="المبلغ (د.ل)" required error={errors.amount}>
              <Input type="number" dir="ltr" step="0.001" min={0} className="font-semibold" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
            <Field label="التاريخ" required error={errors.date}>
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
        </EntryCard>
        <EntryDetails title="ربط المصروف بمشروع أو مرحلة أو بند">
          <ProjectRefPicker projectId={f.project_id} phaseId={f.phase_id} itemId={f.item_id} fixedProject={Boolean(projectId) || Boolean(custody?.project_id)} onChange={(v) => set({ project_id: v.projectId, phase_id: v.phaseId, item_id: v.itemId, treasury_id: '' })} />
          {!f.project_id && <p className="text-xs text-muted">بلا مشروع: مصروف عام للشركة لا يدخل تكلفة أي مشروع.</p>}
        </EntryDetails>
        <EntryCard title="من أين صُرف المبلغ؟">

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
        </EntryCard>

        <EntryDetails title="الفاتورة والمرفقات والملاحظات (اختياري)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الفاتورة">
              <Input dir="ltr" value={f.invoice_no} onChange={(e) => set({ invoice_no: e.target.value })} />
            </Field>
            <AttachmentField value={f.attachment_path} onChange={(attachment_path)=>set({attachment_path})} folder="ركاز/المصروفات" onBusyChange={setAttachmentBusy} disabled={busy} />
          </div>
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="ملاحظات" placeholder="ملاحظات" />
        </EntryDetails>
        </EntryLayout>
        </fieldset>
      </SidePanel>
      {printId && <PrintOptions kind="expense" id={printId} title="تم تسجيل المصروف" message="هل تريد طباعة سند صرف المصروف؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
