import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Package, PackagePlus, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { ask } from '@/components/dialog'
import { Badge, Button, EmptyState, FilterChips, Money, ProgressBar, StatCard } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import { usePhases, useUnits, type ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { ItemForm, type Item } from './ItemForm'
import { ImportCatalogModal, MovePhaseModal, StaffingPanel } from './ItemDialogs'

export function ItemsTab({ project }: { project: ProjectDetail }) {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const qc = useQueryClient()
  const phases = usePhases(project.id)
  const units = useUnits()
  const items = useQuery({
    queryKey: ['project_items', project.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_items').select('*').eq('project_id', project.id).order('order_index').order('created_at')
      if (error) throw error
      return data
    },
  })
  const staffing = useQuery({
    queryKey: ['project_item_staffing', project.id, (items.data ?? []).length],
    enabled: Boolean(items.data?.length),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_item_staffing').select('*').in('project_item_id', items.data!.map((i) => i.id))
      if (error) throw error
      return data
    },
  })

  const [phase, setPhase] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [moving, setMoving] = useState<string[] | null>(null)
  const [staffFor, setStaffFor] = useState<Item | null>(null)

  const unitSym = useMemo(() => new Map((units.data ?? []).map((u) => [u.id, u.symbol])), [units.data])
  const phaseName = useMemo(() => new Map((phases.data ?? []).map((p) => [p.id, p])), [phases.data])
  const missingByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of staffing.data ?? []) m.set(s.project_item_id!, (m.get(s.project_item_id!) ?? 0) + Number(s.missing_count))
    return m
  }, [staffing.data])

  const all = items.data ?? []
  const shown = all.filter((i) => phase === 'all' || (phase === 'none' ? !i.phase_id : i.phase_id === phase))
  const total = shown.reduce((a, i) => a + Number(i.total_price), 0)
  const earned = shown.reduce((a, i) => a + (Number(i.total_price) * Number(i.progress)) / 100, 0)
  const nextOrder = all.reduce((m, i) => Math.max(m, i.order_index), 0) + 1

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const failed: string[] = []
      for (const id of ids) {
        const { error } = await supabase.rpc('delete_project_item', { p_item_id: id })
        if (error) failed.push(`${all.find((i) => i.id === id)?.name}: ${errorMessage(error)}`)
      }
      return { ok: ids.length - failed.length, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) toast.success(`تم حذف ${ok} بند`)
      for (const f of failed) toast.error(f)
      setSelected(new Set())
      for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing']) qc.invalidateQueries({ queryKey: [k] })
    },
  })

  const confirmDelete = async (ids: string[]) => {
    const names = ids.map((id) => all.find((i) => i.id === id)?.name).filter(Boolean)
    const ok = await ask({
      title: ids.length > 1 ? `حذف ${ids.length} بنود؟` : `حذف البند «${names[0]}»؟`,
      message: 'يُحذف البند مع تعيينات فنييه في عملية واحدة. يُرفض الحذف إذا كان عليه أعمال أو مشتريات أو مصروفات أو مرتبطاً بعقد.',
      confirmLabel: 'حذف',
    })
    if (ok) del.mutate(ids)
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allChecked = shown.length > 0 && shown.every((i) => selected.has(i.id))

  const phaseOpts = [
    { value: 'all', label: 'كل البنود', count: all.length },
    ...(phases.data ?? []).map((p) => ({ value: p.id, label: p.name, count: all.filter((i) => i.phase_id === p.id).length })),
    ...(all.some((i) => !i.phase_id) ? [{ value: 'none', label: 'بلا مرحلة', count: all.filter((i) => !i.phase_id).length }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={Package} label="عدد البنود" value={<span className="num">{shown.length}</span>} />
        <StatCard icon={Package} label="قيمة البنود" value={<Money value={total} />} tone="blue" />
        <StatCard icon={Package} label="القيمة المكتسبة" value={<Money value={earned} />} hint={total ? `${((earned / total) * 100).toFixed(1)}% من القيمة` : undefined} tone="sand" />
        <StatCard icon={Package} label="ميزانية المشروع" value={project.budget ? <Money value={project.budget} /> : <span className="text-base text-faint">بلا ميزانية</span>} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips value={phase} onChange={(v) => (setPhase(v), setSelected(new Set()))} options={phaseOpts} />
        {canWrite && (
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <PackagePlus className="size-4" />
              استيراد من البنود العامة
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              بند جديد
            </Button>
          </div>
        )}
      </div>

      {selected.size > 0 && canWrite && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-accent-soft px-4 py-2 text-sm dark:border-brand-800">
          <span>
            تم تحديد <span className="num font-semibold">{selected.size}</span> بند
          </span>
          <Button size="sm" variant="secondary" onClick={() => setMoving([...selected])}>
            <ArrowRightLeft className="size-3.5" />
            نقل المحدد
          </Button>
          <Button size="sm" variant="secondary" className="text-red-600" onClick={() => confirmDelete([...selected])}>
            <Trash2 className="size-3.5" />
            حذف المحدد
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            إلغاء التحديد
          </Button>
        </div>
      )}

      <DataTable
        rows={shown}
        getKey={(i) => i.id}
        loading={items.isLoading}
        error={items.error ? errorMessage(items.error) : null}
        onRetry={() => items.refetch()}
        onRowClick={canWrite ? (i) => setEditing(i) : undefined}
        rowClassName={(i) => selected.has(i.id) && 'bg-accent-soft/50'}
        empty={
          <EmptyState
            icon={Package}
            title={phase === 'all' ? 'لم تُدرج بنود مقايسة بعد' : 'لا توجد بنود في هذه المرحلة'}
            action={
              canWrite && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setImporting(true)}>
                    استيراد من البنود العامة
                  </Button>
                  <Button onClick={() => setEditing('new')}>بند جديد</Button>
                </div>
              )
            }
          >
            أضف البنود بالكمية والسعر، أو استورد عدة بنود عامة دفعة واحدة.
          </EmptyState>
        }
        columns={[
          ...(canWrite
            ? [
                {
                  key: 'sel',
                  label: <input type="checkbox" aria-label="تحديد الكل" className="size-4 accent-brand-600" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(shown.map((i) => i.id)))} />,
                  className: 'w-10',
                  render: (i: Item) => <input type="checkbox" aria-label={`تحديد ${i.name}`} className="size-4 accent-brand-600" checked={selected.has(i.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(i.id)} />,
                },
              ]
            : []),
          {
            key: 'name',
            label: 'البند',
            render: (i) => (
              <div>
                <div className="font-medium">{i.name}</div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                  {i.phase_id && <span>{phaseName.get(i.phase_id)?.name}</span>}
                  {(missingByItem.get(i.id) ?? 0) > 0 && <Badge tone="amber">فنيون ناقصون {missingByItem.get(i.id)}</Badge>}
                </div>
              </div>
            ),
          },
          { key: 'qty', label: 'الكمية', align: 'end', render: (i) => <span className="num whitespace-nowrap">{formatMoney(i.quantity)} <span className="text-xs text-muted">{unitSym.get(i.unit_id ?? '') ?? ''}</span></span> },
          { key: 'price', label: 'سعر الوحدة', align: 'end', hideBelow: 'sm', render: (i) => <Money value={i.unit_price} /> },
          { key: 'total', label: 'الإجمالي', align: 'end', render: (i) => <Money value={i.total_price} className="font-semibold" /> },
          {
            key: 'progress',
            label: 'الإنجاز',
            hideBelow: 'md',
            render: (i) => (
              <div className="flex min-w-24 items-center gap-2">
                <ProgressBar value={Number(i.progress)} tone="green" />
                <span className="num w-9 text-xs text-muted">{Number(i.progress).toFixed(0)}%</span>
              </div>
            ),
          },
        ]}
        footer={
          shown.length > 0 && (
            <tr>
              <td colSpan={canWrite ? 4 : 3} className="px-4 py-2.5 text-sm">
                إجمالي البنود ({shown.length})
              </td>
              <td className="px-4 py-2.5 text-left">
                <Money value={total} />
              </td>
              <td className="hidden md:table-cell" colSpan={canWrite ? 2 : 1} />
            </tr>
          )
        }
        rowActions={(i) => (
          <>
            <Button variant="ghost" size="icon" className="size-8" aria-label="الفنيون" title="الفنيون" onClick={() => setStaffFor(i)}>
              <Users className="size-4" />
            </Button>
            {canWrite && (
              <>
                <Button variant="ghost" size="icon" className="size-8" aria-label="تعديل" title="تعديل" onClick={() => setEditing(i)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label="نقل إلى مرحلة" title="نقل إلى مرحلة" onClick={() => setMoving([i.id])}>
                  <ArrowRightLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 hover:text-red-600" aria-label="حذف" title="حذف" onClick={() => confirmDelete([i.id])}>
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </>
        )}
      />

      <ItemForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        projectId={project.id}
        item={editing === 'new' ? null : editing}
        defaultPhase={phase !== 'all' && phase !== 'none' ? phase : undefined}
        nextOrder={nextOrder}
      />
      {importing && <ImportCatalogModal projectId={project.id} nextOrder={nextOrder} defaultPhase={phase !== 'all' && phase !== 'none' ? phase : undefined} onClose={() => setImporting(false)} />}
      {moving && <MovePhaseModal projectId={project.id} itemIds={moving} onClose={() => setMoving(null)} onDone={() => setSelected(new Set())} />}
      <StaffingPanel item={staffFor} siblings={all} onClose={() => setStaffFor(null)} />
    </div>
  )
}
