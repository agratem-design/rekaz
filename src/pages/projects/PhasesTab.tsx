import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'

import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ask } from '@/components/dialog'
import { Badge, Button, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { options, phaseStatusLabels, phaseStatusTone } from '@/lib/labels'
import { usePhases, type ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase, type Enums, type Tables } from '@/lib/supabase'

type Phase = Tables<'project_phases'>
type Form = { name: string; status: Enums<'phase_status'>; start_date: string; end_date: string; order_index: string; description: string }

export function PhasesTab({ project }: { project: ProjectDetail }) {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const canDelete = hasRole('admin', 'engineer')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const openPhaseItems = (phaseId: string) => navigate(`/projects/${project.id}/${project.project_type === 'contracting' ? 'items' : 'purchases'}?phase=${phaseId}`)
  const phases = usePhases(project.id)
  const [editing, setEditing] = useState<Phase | 'new' | null>(null)
  const [form, setForm] = useState<Form>({ name: '', status: 'planned', start_date: '', end_date: '', order_index: '', description: '' })
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const open = (ph: Phase | 'new') => {
    setEditing(ph)
    setDirty(false)
    setErrors({})
    setForm(
      ph === 'new'
        ? { name: '', status: 'planned', start_date: '', end_date: '', order_index: String((phases.data?.length ?? 0) + 1), description: '' }
        : { name: ph.name, status: ph.status, start_date: ph.start_date ?? '', end_date: ph.end_date ?? '', order_index: String(ph.order_index), description: ph.description ?? '' },
    )
  }
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: form.name.trim(),
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        order_index: Number(form.order_index) || 0,
        description: form.description.trim() || null,
      }
      const { error } =
        editing === 'new'
          ? await supabase.from('project_phases').insert({ ...row, project_id: project.id })
          : await supabase.from('project_phases').update(row).eq('id', (editing as Phase).id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? 'تمت إضافة المرحلة' : 'تم حفظ المرحلة')
      qc.invalidateQueries({ queryKey: ['project_phases', project.id] })
      setEditing(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_phases').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حذف المرحلة')
      qc.invalidateQueries({ queryKey: ['project_phases', project.id] })
      qc.invalidateQueries({ queryKey: ['project_items', project.id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'اسم المرحلة مطلوب'
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'تاريخ الانتهاء قبل تاريخ البدء'
    setErrors(e)
    if (!Object.keys(e).length) save.mutate()
  }

  const addButton = canWrite && (
    <Button onClick={() => open('new')}>
      <Plus className="size-4" />
      إضافة مرحلة
    </Button>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">مراحل المشروع</h2>
          <p className="text-xs text-muted">اختر المرحلة أولاً، ثم أدر بنودها وفريق العمل وتكاليف التنفيذ.</p>
        </div>
        {addButton}
      </div>
      {phases.isLoading ? <Skeleton className="h-64 rounded-2xl" /> : phases.error ? <ErrorState message={errorMessage(phases.error)} onRetry={() => phases.refetch()} /> : !phases.data?.length ? <EmptyState icon={Layers} title="ابدأ بإضافة أول مرحلة" action={addButton}>قسّم المشروع إلى مراحل، ثم افتح المرحلة لإدارة بنودها وعمالها وتكاليفها.</EmptyState> : <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {phases.data.map((ph, index) => <article key={ph.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-200 hover:border-sand-400 hover:shadow-md">
          <button type="button" onClick={() => openPhaseItems(ph.id)} className="w-full cursor-pointer p-5 text-right transition-all duration-200 hover:bg-accent-soft/40">
            <div className="mb-6 flex items-center justify-between"><span className="num font-display text-3xl text-sand-600 dark:text-sand-300">{String(index + 1).padStart(2, '0')}</span><Badge tone={phaseStatusTone[ph.status]} dot>{phaseStatusLabels[ph.status]}</Badge></div>
            <p className="num text-xs text-muted">{ph.reference_number}</p><h3 className="mt-2 text-xl font-semibold">{ph.name}</h3>
            <p className="mt-2 min-h-10 text-sm leading-6 text-muted">{ph.description || 'البنود والعمال والمشتريات والمصروفات في مكان واحد.'}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted"><CalendarDays className="size-4" />{formatDate(ph.start_date)} — {formatDate(ph.end_date)}</div>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm font-semibold text-accent">فتح المرحلة<ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /></div>
          </button>
          {canWrite && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-4 py-2"><Button variant="ghost" size="sm" onClick={() => open(ph)}><Pencil className="size-3.5" />تعديل المرحلة</Button>{canDelete && <Button variant="ghost" size="icon" aria-label={`حذف ${ph.name}`} onClick={async () => { if (await ask({ title: `حذف المرحلة «${ph.name}»؟`, message: 'تبقى بنودها بلا مرحلة. تُرفض العملية إذا كانت عليها عمليات مالية.', confirmLabel: 'حذف' })) remove.mutate(ph.id) }}><Trash2 className="size-4" /></Button>}</div>}
        </article>)}
      </div>}
      <div className="mt-5 rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">عمليات سابقة بلا مرحلة؟ <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${project.id}/${project.project_type === 'contracting' ? 'items' : 'purchases'}?phase=unassigned`)}>عرض العناصر غير المصنفة</Button></div>

      <SidePanel
        open={editing !== null}
        title={editing === 'new' ? 'إضافة مرحلة' : 'تعديل مرحلة'}
        description={editing && editing !== 'new' ? `الرقم المرجعي ${editing.reference_number}` : 'يُولَّد الرقم المرجعي تلقائياً عند الحفظ'}
        dirty={dirty}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button loading={save.isPending} onClick={submit}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && setEditing(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="اسم المرحلة" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثال: الهيكل الخرساني" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الحالة">
              <Select value={form.status} onChange={(e) => set({ status: e.target.value as Form['status'] })}>
                {options(phaseStatusLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الترتيب">
              <Input type="number" dir="ltr" min={0} value={form.order_index} onChange={(e) => set({ order_index: e.target.value })} />
            </Field>
            <Field label="تاريخ البدء" hint="سنة البدء تحدد الرقم المرجعي">
              <Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
            </Field>
            <Field label="تاريخ الانتهاء" error={errors.end_date}>
              <Input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
            </Field>
          </div>
          <Field label="الوصف">
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <button type="submit" hidden />
        </form>
      </SidePanel>
    </div>
  )
}
