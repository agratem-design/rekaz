import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ask } from '@/components/dialog'
import { Badge, Button, EmptyState, Field, Input, Select, Textarea } from '@/components/ui'
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">مراحل المشروع</h2>
          <p className="text-xs text-muted">لكل مرحلة رقم مرجعي سنوي يُولَّد تلقائياً (مثل 48/26)</p>
        </div>
        {addButton}
      </div>
      <DataTable
        rows={phases.data}
        getKey={(r) => r.id}
        loading={phases.isLoading}
        error={phases.error ? errorMessage(phases.error) : null}
        onRetry={() => phases.refetch()}
        onRowClick={canWrite ? (r) => open(r) : undefined}
        empty={
          <EmptyState icon={Layers} title="لا توجد مراحل مسجلة لهذا المشروع" action={addButton}>
            قسّم المشروع إلى مراحل تنفيذية لتتبع البنود والتكاليف لكل مرحلة.
          </EmptyState>
        }
        columns={[
          { key: 'ref', label: 'الرقم المرجعي', render: (r) => <span className="num font-medium text-brand-700 dark:text-brand-300">{r.reference_number}</span> },
          { key: 'name', label: 'المرحلة', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'status', label: 'الحالة', render: (r) => <Badge tone={phaseStatusTone[r.status]} dot>{phaseStatusLabels[r.status]}</Badge> },
          { key: 'start', label: 'البدء', hideBelow: 'sm', render: (r) => <span className="num text-muted">{formatDate(r.start_date)}</span> },
          { key: 'end', label: 'الانتهاء', hideBelow: 'md', render: (r) => <span className="num text-muted">{formatDate(r.end_date)}</span> },
          { key: 'desc', label: 'الوصف', hideBelow: 'lg', render: (r) => <span className="line-clamp-1 text-muted">{r.description ?? '—'}</span> },
        ]}
        rowActions={
          canWrite
            ? (r) => (
                <>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="تعديل" title="تعديل" onClick={() => open(r)}>
                    <Pencil className="size-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-red-600"
                      aria-label="حذف"
                      title="حذف"
                      onClick={async () => {
                        if (await ask({ title: `حذف المرحلة «${r.name}»؟`, message: 'تبقى بنودها في المشروع بلا مرحلة. تُرفض إذا كانت عليها عمليات مالية.', confirmLabel: 'حذف' })) remove.mutate(r.id)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

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
