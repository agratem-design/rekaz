import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hammer, Save, TrendingUp } from 'lucide-react'
import { WorkForm } from '../technicians/TechForms'
import { WorkTable } from '../technicians/WorkTable'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { Button, EmptyState, Input, Money, ProgressBar, StatCard } from '@/components/ui'
import type { ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'

// نسب الإنجاز: تحديث نسبة كل بند. القيمة المكتسبة = قيمة البند × النسبة (SPEC 4.4)
export function ProgressTab({ project }: { project: ProjectDetail }) {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const qc = useQueryClient()
  const items = useQuery({
    queryKey: ['project_items', project.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_items').select('*').eq('project_id', project.id).order('order_index').order('created_at')
      if (error) throw error
      return data
    },
  })
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [work, setWork] = useState(false)
  useEffect(() => setDraft({}), [items.data])

  const changed = Object.entries(draft).filter(([id, v]) => {
    const it = items.data?.find((i) => i.id === id)
    return it && v !== '' && Number(v) !== Number(it.progress)
  })
  const invalid = changed.some(([, v]) => Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)

  const save = useMutation({
    mutationFn: async () => {
      for (const [id, v] of changed) {
        const { error } = await supabase.from('project_items').update({ progress: Number(v) }).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(`تم تحديث ${changed.length} بند`)
      for (const k of ['project_items', 'project', 'project_financials']) qc.invalidateQueries({ queryKey: [k] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const all = items.data ?? []
  const value = (id: string, p: number) => (draft[id] !== undefined ? Number(draft[id]) || 0 : p)
  const total = all.reduce((a, i) => a + Number(i.total_price), 0)
  const earned = all.reduce((a, i) => a + (Number(i.total_price) * value(i.id, Number(i.progress))) / 100, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={TrendingUp} label="قيمة البنود" value={<Money value={total} />} />
        <StatCard icon={TrendingUp} label="القيمة المكتسبة" value={<Money value={earned} />} tone="blue" />
        <StatCard icon={TrendingUp} label="الإنجاز المالي" value={<span className="num">{total ? ((earned / total) * 100).toFixed(1) : '0'}%</span>} tone="sand" />
      </div>
      {canWrite && changed.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-sm dark:border-sand-700 dark:bg-sand-700/15">
          <span className="flex-1">{changed.length} تعديل لم يُحفظ</span>
          <Button size="sm" loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
            <Save className="size-3.5" />
            حفظ النسب
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft({})}>
            تراجع
          </Button>
        </div>
      )}
      <DataTable
        rows={all}
        getKey={(i) => i.id}
        loading={items.isLoading}
        error={items.error ? errorMessage(items.error) : null}
        empty={<EmptyState icon={TrendingUp} title="لا توجد بنود لقياس إنجازها" />}
        columns={[
          { key: 'name', label: 'البند', render: (i) => <span className="font-medium">{i.name}</span> },
          { key: 'total', label: 'قيمة البند', align: 'end', hideBelow: 'sm', render: (i) => <Money value={i.total_price} /> },
          {
            key: 'progress',
            label: 'نسبة الإنجاز',
            render: (i) => {
              const v = value(i.id, Number(i.progress))
              return (
                <div className="flex min-w-48 items-center gap-3">
                  <ProgressBar value={v} tone="green" />
                  {canWrite ? (
                    <Input
                      aria-label={`نسبة إنجاز ${i.name}`}
                      type="number"
                      dir="ltr"
                      min={0}
                      max={100}
                      className="h-8 w-20"
                      value={draft[i.id] ?? String(Number(i.progress))}
                      onChange={(e) => setDraft({ ...draft, [i.id]: e.target.value })}
                    />
                  ) : (
                    <span className="num text-sm">{v}%</span>
                  )}
                </div>
              )
            },
          },
          { key: 'earned', label: 'القيمة المكتسبة', align: 'end', render: (i) => <Money value={(Number(i.total_price) * value(i.id, Number(i.progress))) / 100} /> },
        ]}
      />
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="font-semibold">الفنيون والإنجاز</h3>
          <p className="text-xs text-muted">إنجاز الفنيين هو مصدر مستحقاتهم وتكلفة العمالة على البنود</p>
        </div>
        <Button variant="soft" onClick={() => setWork(true)}>
          <Hammer className="size-4" />
          تسجيل إنجاز فني
        </Button>
      </div>
      <WorkTable projectId={project.id} onNew={() => setWork(true)} />
      <WorkForm open={work} projectId={project.id} onClose={() => setWork(false)} />
    </div>
  )
}
