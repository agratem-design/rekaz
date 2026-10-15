import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ClientPicker } from '@/components/ClientPicker'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { Modal } from '@/components/dialog'
import { Button, Field, Input, KeyValue, Money, Section, Select, Textarea } from '@/components/ui'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { todayISO, formatMoney } from '@/lib/format'
import { options, paymentMethodLabels, projectTypeLabels } from '@/lib/labels'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { openPrint } from '@/print/open'

type Form = {
  client_id: string
  project_id: string // '' = بلا مشروع (رصيد دائن)
  treasury_id: string
  amount: string
  date: string
  method: Enums<'payment_method'>
  reference: string
  notes: string
}

export function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['client_receipts', 'project', 'project_financials', 'dashboard', 'treasuries', 'client_balances', 'client', 'treasury_entries']) qc.invalidateQueries({ queryKey: [k] })
}

// تسجيل إيصال قبض: نفس خطوات النظام السابق (الزبون ← المشروع أو رصيد عام ← الخزينة ← المبلغ مع المتبقي الحي)
// الحفظ بدالة record_client_receipt وبمفتاح ثابت للنموذج يمنع التكرار عند إعادة المحاولة
export function ReceiptForm({ open, onClose, clientId, projectId }: { open: boolean; onClose: () => void; clientId?: string; projectId?: string }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const [form, setForm] = useState<Form>(() => blank(clientId, projectId))
  const [key, setKey] = useState(newKey)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<{ id: string; amount: number } | null>(null)

  useEffect(() => {
    if (open) {
      setForm(blank(clientId, projectId))
      setKey(newKey())
      setDirty(false)
      setErrors({})
    }
  }, [open, clientId, projectId])

  const clientProjects = useMemo(() => (projects.data ?? []).filter((p) => p.client_id === form.client_id), [projects.data, form.client_id])
  const project = clientProjects.find((p) => p.id === form.project_id)

  // ضبط الخزينة الافتراضية للمشروع عند اختياره
  useEffect(() => {
    if (project?.default_treasury_id && !form.treasury_id) setForm((f) => ({ ...f, treasury_id: project.default_treasury_id! }))
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('record_client_receipt', {
        p_key: key,
        p_client_id: form.client_id,
        p_project_id: (form.project_id || null) as string,
        p_treasury_id: form.treasury_id,
        p_amount: Number(form.amount),
        p_date: form.date,
        p_method: form.method,
        p_reference: (form.reference.trim() || null) as string,
        p_notes: (form.notes.trim() || null) as string,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      toast.success('تم تسجيل إيصال القبض وإضافته للخزينة')
      invalidateFinance(qc)
      setSaved({ id, amount: Number(form.amount) })
      onClose()
    },
    // المفتاح يبقى كما هو؛ إعادة المحاولة لا تكرر الإيصال
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.client_id) e.client_id = 'اختر الزبون'
    if (!form.treasury_id) e.treasury_id = 'اختر الخزينة والحساب المستلم'
    const amt = Number(form.amount)
    if (!form.amount || Number.isNaN(amt) || amt <= 0) e.amount = 'أدخل مبلغاً أكبر من صفر'
    if (!form.date) e.date = 'التاريخ مطلوب'
    setErrors(e)
    if (!Object.keys(e).length) save.mutate()
  }

  const remainingBefore = Number(project?.fin?.client_remaining ?? 0)
  const amount = Number(form.amount) || 0
  const after = remainingBefore - amount

  return (
    <>
      <SidePanel
        open={open}
        size="lg"
        title="إيصال قبض جديد"
        description="يُضاف المبلغ إلى الخزينة ويخفض المتبقي على الزبون"
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={save.isPending} onClick={submit}>
              تسجيل واستلام
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <form
          className="space-y-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Section title="الزبون والمشروع">
            <ClientPicker value={form.client_id} onChange={(id) => set({ client_id: id, project_id: '' })} error={errors.client_id} disabled={Boolean(clientId)} />
            <Field label="المشروع المستهدف" hint={!form.project_id ? 'بدون مشروع: يُحفظ المبلغ كاملاً رصيداً دائناً للزبون يُطبَّق لاحقاً على مشروع' : undefined}>
              <Select value={form.project_id} disabled={!form.client_id || Boolean(projectId)} onChange={(e) => set({ project_id: e.target.value, treasury_id: '' })}>
                <option value="">{form.client_id ? 'بدون مشروع محدد (رصيد دائن عام للزبون)' : 'اختر الزبون أولاً'}</option>
                {(['contracting', 'finishing'] as const).map((t) => {
                  const list = clientProjects.filter((p) => p.project_type === t)
                  if (!list.length) return null
                  return (
                    <optgroup key={t} label={`مشاريع ${projectTypeLabels[t]}`}>
                      {list.map((p) => {
                        const r = Number(p.fin?.client_remaining ?? 0)
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} — {r > 0 ? `متبقٍ ${formatMoney(r)}` : r < 0 ? `زيادة ${formatMoney(-r)}` : 'مسدد'}
                          </option>
                        )
                      })}
                    </optgroup>
                  )
                })}
              </Select>
            </Field>
            {project && (
              <div className="rounded-lg border border-line bg-surface-2 px-4 py-2">
                <KeyValue label="إجمالي مطالبات المشروع">
                  <Money value={project.fin?.client_obligation} />
                </KeyValue>
                <KeyValue label="المحصّل حتى الآن">
                  <Money value={project.fin?.collected} />
                </KeyValue>
                <KeyValue label={remainingBefore < 0 ? 'زيادة مدفوعة قبل الدفعة' : 'المتبقي قبل الدفعة'}>
                  <Money value={Math.abs(remainingBefore)} className={remainingBefore < 0 ? 'text-sand-600 dark:text-sand-300' : undefined} />
                </KeyValue>
              </div>
            )}
          </Section>

          <Section title="المبلغ والخزينة">
            <Field label="قيمة الدفعة المستلمة (د.ل)" required error={errors.amount}>
              <Input type="number" min={0} step="0.001" dir="ltr" inputMode="decimal" className="h-11 text-lg font-semibold" value={form.amount} onChange={(e) => set({ amount: e.target.value })} aria-invalid={Boolean(errors.amount)} />
            </Field>
            {project && amount > 0 && (
              <div className={after < 0 ? 'rounded-lg bg-sand-50 px-4 py-2.5 text-sm text-sand-700 dark:bg-sand-700/15 dark:text-sand-200' : 'rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-brand-700 dark:text-brand-200'}>
                {after > 0 ? (
                  <>
                    المتبقي بعد الدفعة: <Money value={after} className="font-semibold" />
                  </>
                ) : after === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> الدفعة تغطي المستحق تماماً
                  </span>
                ) : (
                  <>
                    ستُسجَّل زيادة مدفوعة على المشروع بقيمة <Money value={-after} className="font-semibold" /> ويمكن نقلها لاحقاً إلى الرصيد الدائن للزبون
                  </>
                )}
              </div>
            )}
            <TreasuryPicker label="الخزينة المودع بها" value={form.treasury_id} onChange={(id) => set({ treasury_id: id })} domain={project?.project_type ?? null} required error={errors.treasury_id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="تاريخ الاستلام" required error={errors.date}>
                <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
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
            <Field label="المرجع (اختياري)" hint="رقم الصك أو الحوالة. رقم الإيصال يُولَّد تلقائياً">
              <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} dir="auto" />
            </Field>
            <Field label="ملاحظات">
              <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="أي ملاحظات إضافية على الدفعة…" />
            </Field>
          </Section>
          <button type="submit" hidden />
        </form>
      </SidePanel>
      {saved && <PrintOptions kind="receipt" id={saved.id} title="تم تسجيل الإيصال" message={<>تم استلام <Money value={saved.amount} /> بنجاح. هل تريد طباعة سند القبض الآن؟</>} onClose={() => setSaved(null)} />}
    </>
  )
}

function blank(clientId?: string, projectId?: string): Form {
  return { client_id: clientId ?? '', project_id: projectId ?? '', treasury_id: '', amount: '', date: todayISO(), method: 'cash', reference: '', notes: '' }
}

// نافذة خيارات الطباعة بعد الحفظ مباشرة (كما في النظام السابق)
export function PrintOptions({ kind, id, title, message, onClose }: { kind: string; id: string; title: string; message: React.ReactNode; onClose: () => void }) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button
            onClick={() => {
              openPrint(kind, id, true)
              onClose()
            }}
          >
            <Printer className="size-4" />
            طباعة السند
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              openPrint(kind, id)
              onClose()
            }}
          >
            معاينة
          </Button>
          <Button variant="ghost" onClick={onClose}>
            لاحقاً
          </Button>
        </>
      }
    >
      <div className="flex gap-3 p-5 text-sm">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" />
        <div>{message}</div>
      </div>
    </Modal>
  )
}
