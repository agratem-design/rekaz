import { EntryCard, EntryDetails, EntryLayout, EntryCard as Section } from '@/components/EntryWorkspace'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { PartyPicker, ProjectRefPicker, financeKeys, useTechnicians } from '@/components/pickers'
import { Button, Field, Input, KeyValue, Money, Select, Textarea } from '@/components/ui'
import { formatMoney, todayISO } from '@/lib/format'
import { options, paymentMethodLabels, rateUnitLabels } from '@/lib/labels'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { PrintOptions } from '../receipts/ReceiptForm'
import { useTechnicianBalance } from './techData'

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
}

// ───────────── تسجيل عمل ومستحق (مستحق، بلا حركة خزينة) ─────────────
export function WorkForm({ phaseId, open, onClose, technicianId, projectId, itemId }: { phaseId?: string; open: boolean; onClose: () => void; technicianId?: string; projectId?: string; itemId?: string }) {
  const qc = useQueryClient()
  const techs = useTechnicians()
  const blank = () => ({
    technician_id: technicianId ?? '',
    project_id: projectId ?? '',
    phase_id: phaseId === 'unassigned' ? '' : phaseId ?? '',
    item_id: itemId ?? '',
    date: todayISO(),
    rate_unit: '' as Enums<'rate_unit'> | '',
    quantity: '',
    rate: '',
    description: '',
  })
  const [f, setF] = useState(blank)
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [rateHint, setRateHint] = useState('')

  useEffect(() => {
    if (!open) return
    setF(blank())
    setKey(newKey())
    setDirty(false)
    setErrors({})
    setRateHint('')
  }, [open, technicianId, projectId, itemId]) // eslint-disable-line react-hooks/exhaustive-deps

  // السعر الافتراضي: من تعيين الفني على البند، وإلا من السعر الافتراضي للفني
  const assignment = useQuery({
    queryKey: ['assignment', f.item_id, f.technician_id],
    enabled: Boolean(f.item_id && f.technician_id),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_item_assignments').select('*').eq('project_item_id', f.item_id).eq('technician_id', f.technician_id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  useEffect(() => {
    if (!open || !f.technician_id) return
    const a = assignment.data
    const t = (techs.data ?? []).find((x) => x.id === f.technician_id)
    if (a && a.agreed_rate !== null) {
      setF((p) => ({ ...p, rate: String(a.agreed_rate), rate_unit: a.rate_unit ?? p.rate_unit }))
      setRateHint('السعر من تعيين الفني على هذا البند')
    } else if (t?.default_rate) {
      setF((p) => ({ ...p, rate: p.rate || String(t.default_rate), rate_unit: p.rate_unit || (t.default_rate_unit ?? '') }))
      setRateHint('السعر الافتراضي للفني')
    }
  }, [assignment.data, f.technician_id, techs.data, open])

  const set = (patch: Partial<typeof f>) => {
    setF((p) => ({ ...p, ...patch }))
    setDirty(true)
    setErrors({})
  }
  const amount = Math.round((Number(f.quantity) || 0) * (Number(f.rate) || 0) * 1000) / 1000

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.technician_id) e.technician = 'اختر الفني'
    if (!f.project_id) e.project = 'المشروع مطلوب'
    if (!f.rate_unit) e.rate_unit = 'اختر طريقة الحساب'
    if (!(Number(f.quantity) > 0)) e.quantity = 'أدخل الكمية المنجزة'
    if (f.rate === '' || Number(f.rate) < 0) e.rate = 'أدخل السعر'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { error } = await supabase.rpc('record_technician_work', {
      p_key: key,
      p_technician_id: f.technician_id,
      p_project_id: f.project_id,
      p_date: f.date,
      p_rate_unit: f.rate_unit as Enums<'rate_unit'>,
      p_quantity: Number(f.quantity),
      p_rate: Number(f.rate),
      p_phase_id: (f.phase_id || null) as string,
      p_item_id: (f.item_id || null) as string,
      p_description: (f.description.trim() || null) as string,
    })
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    toast.success(`تم تسجيل المستحق: ${formatMoney(amount)} د.ل مستحقة للفني`)
    refresh(qc)
    onClose()
  }

  return (
    <SidePanel
        workspace
      open={open}
      size="lg"
      title="تسجيل عمل ومستحق"
      description="سجل الأعمال والمستحقات هو مصدر مستحق الفني ويدخل تكلفة المشروع. لا تتحرك أي خزينة."
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <Button loading={busy} onClick={submit}>
            حفظ العمل والمستحق
          </Button>
          <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
            إلغاء
          </Button>
        </>
      }
    >
      <EntryLayout summary={<div className="space-y-3">
        <p className="font-semibold">{(techs.data ?? []).find((t) => t.id === f.technician_id)?.name ?? 'اختر الفني'}</p>
        <KeyValue label="الكمية المنجزة">{Number(f.quantity) || 0}</KeyValue>
        <KeyValue label="السعر"><Money value={Number(f.rate) || 0} /></KeyValue>
        <div className="border-t border-line pt-4"><span className="text-sm text-muted">المستحق للفني</span><Money value={amount} className="mt-2 block text-2xl font-semibold" /></div>
        <p className="text-xs leading-6 text-muted">تسجيل المستحق لا يصرف مبلغًا من الخزينة. السداد له عملية مستقلة.</p>
      </div>}>
      <Section title="الفني والعمل">
        <PartyPicker table="technicians" value={f.technician_id} onChange={(id) => set({ technician_id: id, rate: '', rate_unit: '' })} error={errors.technician} disabled={Boolean(technicianId)} />
        <ProjectRefPicker projectId={f.project_id} phaseId={f.phase_id} itemId={f.item_id} optionalProject={false} fixedProject={Boolean(projectId)} error={errors.project} onChange={(v) => set({ project_id: v.projectId, phase_id: v.phaseId, item_id: v.itemId })} />
        <Field label="وصف العمل">
          <Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="مثال: تركيب بلاط الدور الأول" />
        </Field>
      </Section>
      <Section title="الكمية والسعر">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="تاريخ العمل" required>
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="طريقة الحساب" required error={errors.rate_unit}>
            <Select value={f.rate_unit} onChange={(e) => set({ rate_unit: e.target.value as Enums<'rate_unit'> })}>
              <option value="">— اختر —</option>
              {options(rateUnitLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الكمية المنجزة" required error={errors.quantity} hint="أيام، ساعات، أمتار، قطع…">
            <Input type="number" dir="ltr" step="0.001" min={0} value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} />
          </Field>
          <Field label="السعر (د.ل)" required error={errors.rate} hint={rateHint}>
            <Input type="number" dir="ltr" step="0.001" min={0} value={f.rate} onChange={(e) => set({ rate: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-lg bg-surface-2 px-4 py-2">
          <KeyValue label="المستحق للفني">
            <Money value={amount} className="text-base font-semibold" />
          </KeyValue>
        </div>
      </Section>
      </EntryLayout>
    </SidePanel>
  )
}

// ───────────── صرف دفعة لفني / استلام مبلغ من فني ─────────────
export function TechCashForm({ open, onClose, technicianId, projectId, direction }: { open: boolean; onClose: () => void; technicianId?: string; projectId?: string; direction: 'pay' | 'receive' }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const blank = () => ({ technician_id: technicianId ?? '', project_id: projectId ?? '', amount: '', date: todayISO(), method: 'cash' as Enums<'payment_method'>, treasury_id: '', notes: '' })
  const [f, setF] = useState(blank)
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  const bal = useTechnicianBalance(f.technician_id || undefined)
  const due = Number(bal.data?.[0]?.balance_due ?? 0)
  const project = (projects.data ?? []).find((p) => p.id === f.project_id)
  const pay = direction === 'pay'

  useEffect(() => {
    if (!open) return
    setF(blank())
    setKey(newKey())
    setDirty(false)
    setErrors({})
  }, [open, technicianId, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<typeof f>) => {
    setF((p) => ({ ...p, ...patch }))
    setDirty(true)
    setErrors({})
  }

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.technician_id) e.technician = 'اختر الفني'
    if (!(Number(f.amount) > 0)) e.amount = 'أدخل المبلغ'
    if (!f.treasury_id) e.treasury = 'اختر الخزينة'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const res = pay
      ? await supabase.rpc('pay_technician', {
          p_key: key,
          p_technician_id: f.technician_id,
          p_treasury_id: f.treasury_id,
          p_amount: Number(f.amount),
          p_date: f.date,
          p_context_project_id: (f.project_id || null) as string,
          p_method: f.method,
          p_notes: (f.notes.trim() || null) as string,
        })
      : await supabase.rpc('receive_from_technician', {
          p_key: key,
          p_technician_id: f.technician_id,
          p_treasury_id: f.treasury_id,
          p_amount: Number(f.amount),
          p_date: f.date,
          p_method: f.method,
          p_notes: (f.notes.trim() || null) as string,
        })
    setBusy(false)
    if (res.error) return toast.error(errorMessage(res.error))
    toast.success(pay ? 'تم صرف الدفعة للفني' : 'تم استلام المبلغ من الفني')
    refresh(qc)
    setPrintId(res.data as string)
    onClose()
  }

  return (
    <>
      <SidePanel
        workspace
        open={open}
        title={pay ? 'صرف دفعة لفني' : 'استلام مبلغ من فني'}
        description={pay ? 'تخفض مستحق الفني وتخصم من الخزينة. المشروع سياق للعرض فقط.' : 'إرجاع زائد أو وديعة من الفني: تُضاف للخزينة وتزيد مستحقه'}
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              {pay ? 'صرف' : 'استلام'}
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <EntryLayout summary={<div className="space-y-3">
          <KeyValue label={due >= 0 ? 'المستحق للفني حالياً' : 'مقدم عند الفني'}><Money value={Math.abs(due)} /></KeyValue>
          <KeyValue label="قيمة الحركة"><Money value={Number(f.amount) || 0} /></KeyValue>
          <KeyValue label="الرصيد بعد الحركة"><Money value={pay ? due - (Number(f.amount) || 0) : due + (Number(f.amount) || 0)} /></KeyValue>
          <p className="text-xs leading-6 text-muted">الرصيد الموجب مستحق للفني، والسالب مبلغ مقدم عنده.</p>
        </div>}>
        <EntryCard title="الفني وبيانات الدفعة">
        <PartyPicker table="technicians" value={f.technician_id} onChange={(id) => set({ technician_id: id })} error={errors.technician} disabled={Boolean(technicianId)} />
        {f.technician_id && (
          <div className="rounded-lg bg-surface-2 px-4 py-2 text-sm">
            <KeyValue label={due >= 0 ? 'المستحق للفني حالياً' : 'مقدم عند الفني'}>
              <Money value={Math.abs(due)} className="font-semibold" />
            </KeyValue>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المبلغ (د.ل)" required error={errors.amount}>
            <Input type="number" dir="ltr" step="0.001" min={0} className="h-11 text-lg font-semibold" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
          <Field label="التاريخ" required>
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="طريقة الدفع">
            <Select value={f.method} onChange={(e) => set({ method: e.target.value as Enums<'payment_method'> })}>
              {options(paymentMethodLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {pay && (
            <Field label="المشروع (سياق للعرض)">
              <Select value={f.project_id} disabled={Boolean(projectId)} onChange={(e) => set({ project_id: e.target.value, treasury_id: '' })}>
                <option value="">— على حساب الفني العام —</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <TreasuryPicker label={pay ? 'الخزينة المخصوم منها' : 'الخزينة المستلمة'} value={f.treasury_id} onChange={(id) => set({ treasury_id: id })} domain={pay ? (project?.project_type ?? null) : null} required error={errors.treasury} />
        </EntryCard>
        <EntryDetails title="ملاحظات إضافية (اختياري)">
        <Field label="ملاحظات">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        </EntryDetails>
        </EntryLayout>
      </SidePanel>
      {printId && <PrintOptions kind={pay ? 'technician-payment' : 'technician-receipt'} id={printId} title={pay ? 'تم صرف الدفعة' : 'تم الاستلام'} message="هل تريد طباعة السند الآن؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
