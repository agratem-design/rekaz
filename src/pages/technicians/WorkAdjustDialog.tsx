import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/dialog'
import { financeKeys, useTechnicians } from '@/components/pickers'
import { Button, Field, Input, KeyValue, Money, Select, Textarea } from '@/components/ui'
import { rateUnitLabels } from '@/lib/labels'
import { newKey } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import type { WorkRow } from './techData'

type Part = { id: string; technician_id: string; quantity: string; rate: string }

// زيادة العمل أو إنقاصه أو تقسيمه بين فنيين: السجل الأصلي يبقى ملغى بسبب، وتُنشأ مكانه الأجزاء الجديدة
export function WorkAdjustDialog({ work, onClose }: { work: WorkRow; onClose: () => void }) {
  const qc = useQueryClient()
  const techs = useTechnicians()
  const [parts, setParts] = useState<Part[]>([{ id: newKey(), technician_id: work.technician_id, quantity: String(work.quantity), rate: String(work.rate) }])
  const [reason, setReason] = useState('')
  const [key] = useState(newKey)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const before = Number(work.amount)
  const after = Math.round(parts.reduce((a, p) => a + (Number(p.quantity) || 0) * (Number(p.rate) || 0), 0) * 1000) / 1000
  const change = (id: string, patch: Partial<Part>) => setParts((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const submit = async () => {
    if (!reason.trim()) return setError('اكتب سبب التعديل')
    if (parts.some((p) => !p.technician_id || !(Number(p.quantity) > 0) || p.rate === '' || Number(p.rate) < 0)) return setError('أكمل الفني والكمية والسعر في كل سطر')
    if (new Set(parts.map((p) => p.technician_id)).size !== parts.length) return setError('الفني مكرر؛ اجمع كميته في سطر واحد')
    setError('')
    setBusy(true)
    const { error: e } = await supabase.rpc('rework_technician_work', {
      p_key: key,
      p_work_id: work.id,
      p_reason: reason.trim(),
      p_parts: parts.map((p) => ({ technician_id: p.technician_id, quantity: Number(p.quantity), rate: Number(p.rate) })),
    })
    setBusy(false)
    if (e) return setError(errorMessage(e))
    toast.success(parts.length > 1 ? 'تم تقسيم العمل بين الفنيين' : 'تم تعديل العمل')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    onClose()
  }
  return (
    <Modal
      title="تعديل أو تقسيم العمل"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button loading={busy} onClick={submit}>
            حفظ التعديل
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm leading-7 text-muted">
          {work.description ?? work.project_items?.name ?? 'عمل'} · {work.projects?.name} · {rateUnitLabels[work.rate_unit]}. يبقى السجل الأصلي ملغى في الأرشيف، والمدفوع للفني لا يتغير.
        </p>
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={p.id} className="grid min-w-0 grid-cols-2 items-end gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_auto]">
              <Field className="col-span-2 sm:col-span-1" label={i ? 'الفني الآخر' : 'الفني'}>
                <Select value={p.technician_id} aria-label={`الفني ${i + 1}`} onChange={(e) => change(p.id, { technician_id: e.target.value })}>
                  <option value="">— اختر —</option>
                  {(techs.data ?? []).filter((t) => t.is_active || t.id === p.technician_id).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="الكمية">
                <Input type="number" dir="ltr" step="0.001" min={0} aria-label={`كمية الفني ${i + 1}`} value={p.quantity} onChange={(e) => change(p.id, { quantity: e.target.value })} />
              </Field>
              <Field label="السعر">
                <Input type="number" dir="ltr" step="0.001" min={0} aria-label={`سعر الفني ${i + 1}`} value={p.rate} onChange={(e) => change(p.id, { rate: e.target.value })} />
              </Field>
              <Field label="المستحق">
                <Money value={(Number(p.quantity) || 0) * (Number(p.rate) || 0)} className="block py-2 font-semibold" />
              </Field>
              <Button variant="ghost" size="icon" className="hover:text-red-600" aria-label={`حذف السطر ${i + 1}`} disabled={parts.length === 1} onClick={() => setParts((all) => all.filter((x) => x.id !== p.id))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setParts((all) => [...all, { id: newKey(), technician_id: '', quantity: '', rate: String(work.rate) }])}>
            <Plus className="size-3.5" />
            إضافة فني آخر
          </Button>
        </div>
        <div className="rounded-lg bg-surface-2 px-4 py-2">
          <KeyValue label="قبل التعديل"><Money value={before} /></KeyValue>
          <KeyValue label="بعد التعديل"><Money value={after} className="font-semibold" /></KeyValue>
          <KeyValue label="الفرق"><Money value={Math.round((after - before) * 1000) / 1000} signed /></KeyValue>
        </div>
        <Field label="سبب التعديل" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: جاء فني ثانٍ وأكمل باقي العمل" />
        </Field>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
