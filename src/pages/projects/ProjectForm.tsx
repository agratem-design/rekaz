import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ClientPicker } from '@/components/ClientPicker'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { Button, Field, Input, Section, Select, Textarea } from '@/components/ui'
import { useEngineers } from '@/lib/queries'
import { budgetTypeLabels, options, projectStatusLabels, projectTypeLabels, supervisionModeLabels } from '@/lib/labels'
import { errorMessage, supabase, type Enums, type Tables } from '@/lib/supabase'

type Project = Tables<'projects'>
type Form = {
  name: string
  project_type: Enums<'project_type'>
  client_id: string
  status: Enums<'project_status'>
  location: string
  description: string
  start_date: string
  end_date: string
  budget: string
  budget_type: Enums<'budget_type'> | ''
  finishing_percentage: string
  supervising_engineer_id: string
  supervision_mode: Enums<'supervision_mode'>
  supervision_value: string
  default_treasury_id: string
  notes: string
}

const fromProject = (p: Project): Form => ({
  name: p.name,
  project_type: p.project_type,
  client_id: p.client_id,
  status: p.status,
  location: p.location ?? '',
  description: p.description ?? '',
  start_date: p.start_date ?? '',
  end_date: p.end_date ?? '',
  budget: p.budget?.toString() ?? '',
  budget_type: p.budget_type ?? '',
  finishing_percentage: p.finishing_percentage?.toString() ?? '',
  supervising_engineer_id: p.supervising_engineer_id ?? '',
  supervision_mode: p.supervision_mode,
  supervision_value: p.supervision_value?.toString() ?? '',
  default_treasury_id: p.default_treasury_id ?? '',
  notes: p.notes ?? '',
})

const blank = (type: Enums<'project_type'>, clientId = ''): Form => ({
  name: '',
  project_type: type,
  client_id: clientId,
  status: 'active',
  location: '',
  description: '',
  start_date: '',
  end_date: '',
  budget: '',
  budget_type: '',
  finishing_percentage: type === 'finishing' ? '10' : '',
  supervising_engineer_id: '',
  supervision_mode: 'none',
  supervision_value: '',
  default_treasury_id: '',
  notes: '',
})

// نموذج إنشاء/تعديل مشروع بنفس أقسام النظام السابق. بعد الإنشاء ينتقل مباشرة إلى لوحة المشروع.
export function ProjectForm({ open, onClose, project, type, clientId }: { open: boolean; onClose: () => void; project?: Project | null; type?: Enums<'project_type'>; clientId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const engineers = useEngineers()
  const [form, setForm] = useState<Form>(() => (project ? fromProject(project) : blank(type ?? 'contracting', clientId)))
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm(project ? fromProject(project) : blank(type ?? 'contracting', clientId))
      setDirty(false)
      setErrors({})
    }
  }, [open, project, type, clientId])

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
      const num = (v: string) => (v.trim() === '' ? null : Number(v))
      const row = {
        name: form.name.trim(),
        project_type: form.project_type,
        client_id: form.client_id,
        status: form.status,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: num(form.budget),
        budget_type: form.budget_type || null,
        finishing_percentage: form.project_type === 'finishing' ? num(form.finishing_percentage) : null,
        supervising_engineer_id: form.supervising_engineer_id || null,
        supervision_mode: form.supervision_mode,
        supervision_value: form.supervision_mode === 'none' ? null : num(form.supervision_value),
        default_treasury_id: form.default_treasury_id || null,
        notes: form.notes.trim() || null,
      }
      if (project) {
        const { error } = await supabase.from('projects').update(row).eq('id', project.id)
        if (error) throw error
        return project.id
      }
      const { data, error } = await supabase.from('projects').insert(row).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: (id) => {
      toast.success(project ? 'تم حفظ المشروع' : 'تم إنشاء المشروع')
      qc.invalidateQueries({ queryKey: ['project_financials'] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
      if (!project) navigate(`/projects/${id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'اسم المشروع مطلوب'
    if (!form.client_id) e.client_id = 'اختر الزبون'
    if (form.project_type === 'finishing') {
      const p = Number(form.finishing_percentage)
      if (form.finishing_percentage === '' || Number.isNaN(p) || p < 0 || p > 100) e.finishing_percentage = 'نسبة بين 0 و 100'
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'تاريخ الانتهاء قبل تاريخ البدء'
    if (form.supervision_mode !== 'none' && form.supervision_value === '') e.supervision_value = 'أدخل القيمة'
    if (form.budget !== '' && Number(form.budget) < 0) e.budget = 'قيمة غير صحيحة'
    setErrors(e)
    if (!Object.keys(e).length) save.mutate()
  }

  const isFinishing = form.project_type === 'finishing'
  return (
    <SidePanel
      open={open}
      size="lg"
      title={project ? 'إعدادات المشروع' : `مشروع ${projectTypeLabels[form.project_type]} جديد`}
      description={project ? project.name : 'بعد الحفظ تنتقل إلى لوحة المشروع لإكمال المراحل والبنود'}
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <Button loading={save.isPending} onClick={submit}>
            {project ? 'حفظ التعديلات' : 'إنشاء المشروع'}
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
        <Section title="المعلومات الأساسية">
          <Field label="اسم المشروع" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثال: فيلا سكنية — حي الأندلس" aria-invalid={Boolean(errors.name)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع المشروع" required hint={project ? 'لا يتغير بعد الإنشاء' : 'يحدد طريقة الحساب وقطاع الخزائن'}>
              <Select value={form.project_type} disabled={Boolean(project)} onChange={(e) => set({ project_type: e.target.value as Form['project_type'], default_treasury_id: '' })}>
                {options(projectTypeLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === 'contracting' ? 'مقاولات (سعر ثابت)' : 'تشطيبات (التكلفة + نسبة)'}
                  </option>
                ))}
              </Select>
            </Field>
            {isFinishing && (
              <Field label="نسبة إدارة الشركة %" required error={errors.finishing_percentage} hint="تُضاف على التكلفة المباشرة">
                <Input type="number" min={0} max={100} step="0.01" dir="ltr" inputMode="decimal" value={form.finishing_percentage} onChange={(e) => set({ finishing_percentage: e.target.value })} />
              </Field>
            )}
          </div>
          <ClientPicker value={form.client_id} onChange={(id) => set({ client_id: id })} error={errors.client_id} />
          <TreasuryPicker label="الخزينة الافتراضية" value={form.default_treasury_id} onChange={(id) => set({ default_treasury_id: id })} domain={form.project_type} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المهندس المشرف">
              <Select value={form.supervising_engineer_id} onChange={(e) => set({ supervising_engineer_id: e.target.value })}>
                <option value="">بلا</option>
                {(engineers.data ?? []).map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الموقع">
              <Input value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="مثال: زليتن - المركز" />
            </Field>
          </div>
          <Field label="وصف المشروع">
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="وصف مختصر للمشروع ونطاق العمل…" />
          </Field>
        </Section>

        <Section title="الحالة والتفاصيل">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="الحالة">
              <Select value={form.status} onChange={(e) => set({ status: e.target.value as Form['status'] })}>
                {options(projectStatusLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="تاريخ البدء">
              <Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
            </Field>
            <Field label="تاريخ الانتهاء" error={errors.end_date}>
              <Input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} aria-invalid={Boolean(errors.end_date)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع الميزانية">
              <Select value={form.budget_type} onChange={(e) => set({ budget_type: e.target.value as Form['budget_type'] })}>
                <option value="">غير محددة</option>
                {options(budgetTypeLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="قيمة الميزانية (د.ل)" error={errors.budget}>
              <Input type="number" min={0} step="0.001" dir="ltr" inputMode="decimal" value={form.budget} onChange={(e) => set({ budget: e.target.value })} disabled={!form.budget_type} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="أتعاب الإشراف">
              <Select value={form.supervision_mode} onChange={(e) => set({ supervision_mode: e.target.value as Form['supervision_mode'] })}>
                {options(supervisionModeLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.supervision_mode !== 'none' && (
              <Field label={form.supervision_mode === 'percentage' ? 'النسبة %' : 'المبلغ (د.ل)'} required error={errors.supervision_value}>
                <Input type="number" min={0} step="0.001" dir="ltr" inputMode="decimal" value={form.supervision_value} onChange={(e) => set({ supervision_value: e.target.value })} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="ملاحظات">
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="ملاحظات إضافية عن المشروع…" aria-label="ملاحظات" />
        </Section>
        <button type="submit" hidden />
      </form>
    </SidePanel>
  )
}
