import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, FileText, Layers, Package, PackagePlus, Pencil, Plus, Printer, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { ask } from '@/components/dialog'
import { Badge, Button, Card, EmptyState, ErrorState, Input, Money, NumberWithUnit, TableSkeleton, cn } from '@/components/ui'
import { phaseStatusLabels, phaseStatusTone } from '@/lib/labels'
import { usePhases, useUnits, type ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { ItemForm, type Item } from './ItemForm'
import { ImportCatalogModal, MovePhaseModal, StaffingPanel } from './ItemDialogs'
import { QuickAddRow } from './QuickAddRow'

// بنود المقاولات منظمة بالمراحل: لكل مرحلة فاتورة بنود مقاولات خاصة بها ومجموعها.
// الإضافة من داخل المرحلة تأخذ المرحلة تلقائياً، مع سطر إضافة سريعة بلوحة المفاتيح.
const ALL = 'all'
const NONE = 'none'

function readPhase(projectId: string) {
  try {
    return localStorage.getItem(`boq-phase-${projectId}`) ?? ''
  } catch {
    return ''
  }
}

export function ItemsTab({ project, phaseId }: { project: ProjectDetail; phaseId?: string }) {
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
      const { data, error } = await supabase.from('project_item_staffing').select('*').in('project_item_id', items.data!.filter((i) => !i.id.startsWith('temp-')).map((i) => i.id))
      if (error) throw error
      return data
    },
  })

  const [phase, setPhaseState] = useState(() => phaseId === 'unassigned' ? NONE : phaseId ?? readPhase(project.id))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [moving, setMoving] = useState<string[] | null>(null)
  const [staffFor, setStaffFor] = useState<Item | null>(null)

  const all = useMemo(() => items.data ?? [], [items.data])
  const phaseList = phases.data ?? []
  const hasUnphased = all.some((i) => !i.phase_id)

  // اختيار المرحلة: المحفوظة إن وُجدت، وإلا أول مرحلة، وإلا «كل المشروع»
  useEffect(() => {
    if (!phases.data || phaseId) return
    const valid = phase === ALL || (phase === NONE && hasUnphased) || phaseList.some((p) => p.id === phase)
    if (!valid) setPhaseState(phaseList[0]?.id ?? (hasUnphased ? NONE : ALL))
  }, [phases.data, hasUnphased]) // eslint-disable-line react-hooks/exhaustive-deps
  const setPhase = (v: string) => {
    setPhaseState(v)
    setSelected(new Set())
    try {
      localStorage.setItem(`boq-phase-${project.id}`, v)
    } catch {
      /* التخزين غير متاح */
    }
  }

  const unitSym = useMemo(() => new Map((units.data ?? []).map((u) => [u.id, u.symbol])), [units.data])
  const missingByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of staffing.data ?? []) m.set(s.project_item_id!, (m.get(s.project_item_id!) ?? 0) + Number(s.missing_count))
    return m
  }, [staffing.data])
  const inPhase = (pid: string) => all.filter((i) => (pid === NONE ? !i.phase_id : i.phase_id === pid))
  const sum = (xs: Item[]) => xs.reduce((a, i) => a + Number(i.total_price), 0)
  const nextOrder = all.reduce((m, i) => Math.max(m, i.order_index), 0) + 1
  const currentPhase = phaseList.find((p) => p.id === phase)
  const phaseIdForAdd = phase === ALL || phase === NONE ? null : phase

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

  // مرحلة جديدة من داخل التبويب
  const [newPhase, setNewPhase] = useState('')
  const addPhase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .insert({ project_id: project.id, name: newPhase.trim(), order_index: phaseList.length + 1 })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: async (id) => {
      setNewPhase('')
      await qc.invalidateQueries({ queryKey: ['project_phases', project.id] })
      setPhase(id)
      toast.success('تمت إضافة المرحلة')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (items.isLoading || phases.isLoading) return <Card className="p-0"><TableSkeleton /></Card>
  if (items.error) return <ErrorState message={errorMessage(items.error)} onRetry={() => items.refetch()} />

  const railItem = (key: string, label: React.ReactNode, sub: React.ReactNode, count: number, total: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setPhase(key)}
      aria-current={phase === key ? 'true' : undefined}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-right transition',
        phase === key ? 'border-brand-400 bg-accent-soft shadow-sm dark:border-sand-500' : 'border-transparent hover:border-line hover:bg-surface-2',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="num shrink-0 rounded-full bg-surface-2 px-1.5 text-[11px] text-muted ring-1 ring-line">{count}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{sub}</span>
        <Money value={total} className="text-ink" />
      </div>
    </button>
  )

  const shown = phase === ALL ? all : inPhase(phase)
  const allChecked = shown.length > 0 && shown.every((i) => selected.has(i.id))
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className={phaseId ? "space-y-4" : "grid gap-4 lg:grid-cols-[17rem_1fr]"}>
      {/* شريط المراحل */}
      <aside hidden={Boolean(phaseId)} className="space-y-1.5" aria-label="المراحل">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted">المراحل وفواتيرها</span>
          <Money value={sum(all)} className="text-xs font-semibold" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1.5 lg:overflow-visible [&>button]:min-w-48 lg:[&>button]:min-w-0">
          {phaseList.map((p) =>
            railItem(
              p.id,
              <>
                <span className="num text-xs text-brand-500 dark:text-sand-300">{p.reference_number}</span>
                <span className="mx-1 text-faint">·</span>
                {p.name}
              </>,
              <Badge tone={phaseStatusTone[p.status]}>{phaseStatusLabels[p.status]}</Badge>,
              inPhase(p.id).length,
              sum(inPhase(p.id)),
            ),
          )}
          {hasUnphased && railItem(NONE, 'بنود بلا مرحلة', 'المشروع الرئيسي', inPhase(NONE).length, sum(inPhase(NONE)))}
          {(phaseList.length > 0 || hasUnphased) && railItem(ALL, 'كل المشروع', 'مجمّعة حسب المرحلة', all.length, sum(all))}
        </div>
        {canWrite && (
          <form
            className="flex gap-1.5 pt-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (newPhase.trim()) addPhase.mutate()
            }}
          >
            <Input value={newPhase} onChange={(e) => setNewPhase(e.target.value)} placeholder="مرحلة جديدة…" aria-label="اسم المرحلة الجديدة" className="h-8 text-xs" />
            <Button type="submit" size="sm" variant="secondary" loading={addPhase.isPending} disabled={!newPhase.trim()} aria-label="إضافة مرحلة">
              <Plus className="size-3.5" />
            </Button>
          </form>
        )}
      </aside>

      <section className="min-w-0 space-y-3">
        {/* رأس فاتورة المرحلة */}
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/60 dark:text-sand-300">
            {phase === ALL ? <Layers className="size-5" /> : <FileText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">فاتورة بنود المقاولات</div>
            <h2 className="text-lg font-semibold">
              {phase === ALL ? 'كل المشروع' : phase === NONE ? 'بنود بلا مرحلة' : currentPhase ? `${currentPhase.name}` : '—'}
              {currentPhase?.reference_number && <span className="num ms-2 text-sm font-normal text-muted">رقم {currentPhase.reference_number}</span>}
            </h2>
          </div>
          <div className="flex gap-5 text-sm">
            <div>
              <div className="text-xs text-muted">الإجمالي</div>
              <Money value={sum(shown)} className="font-display text-lg font-semibold" />
            </div>

          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="secondary" size="sm" onClick={() => openPrint('boq', project.id, false, { phase })}>
              <Printer className="size-3.5" />
              طباعة الفاتورة
            </Button>
            {canWrite && phase !== ALL && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
                  <PackagePlus className="size-3.5" />
                  استيراد من البنود العامة
                </Button>
                <Button size="sm" onClick={() => setEditing('new')}>
                  <Plus className="size-3.5" />
                  بند بتفاصيل
                </Button>
              </>
            )}
          </div>
        </Card>

        {selected.size > 0 && canWrite && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-accent-soft px-4 py-2 text-sm dark:border-brand-800">
            <span>
              تم تحديد <span className="num font-semibold">{selected.size}</span> بند
            </span>
            <Button size="sm" variant="secondary" onClick={() => setMoving([...selected])}>
              <ArrowRightLeft className="size-3.5" />
              نقل إلى مرحلة
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

        {!phaseId && !phaseList.length && !all.length ? (
          <Card>
            <EmptyState icon={Layers} title="ابدأ بإضافة مرحلة" action={canWrite && <Button variant="secondary" onClick={() => setPhase(NONE)}>أو أضف بنوداً بلا مرحلة</Button>}>
              لكل مرحلة فاتورة بنود مقاولات خاصة بها. اكتب اسم المرحلة في «مرحلة جديدة» ثم أضف بنودها.
            </EmptyState>
          </Card>
        ) : phase === ALL ? (
          <div className="space-y-4">
            {[...phaseList.map((p) => ({ id: p.id, title: `${p.reference_number ?? ''} — ${p.name}` })), ...(hasUnphased ? [{ id: NONE, title: 'بنود بلا مرحلة' }] : [])].map((g) => {
              const rows = inPhase(g.id)
              if (!rows.length) return null
              return (
                <Card key={g.id} className="overflow-hidden p-0">
                  <button type="button" onClick={() => setPhase(g.id)} className="flex w-full items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:text-brand-700 dark:hover:text-sand-300">
                    <span>{g.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs font-normal text-muted">{rows.length} بند</span>
                      <Money value={sum(rows)} />
                    </span>
                  </button>
                  <ItemsTable rows={rows} unitSym={unitSym} missing={missingByItem} canWrite={false} onOpen={canWrite ? (i) => setEditing(i) : undefined} />
                </Card>
              )
            })}
            <Card className="flex items-center justify-between px-4 py-3 font-semibold">
              <span>إجمالي بنود المقاولات للمشروع</span>
              <Money value={sum(all)} className="font-display text-lg" />
            </Card>
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <ItemsTable
              rows={shown}
              unitSym={unitSym}
              missing={missingByItem}
              canWrite={canWrite}
              selected={selected}
              allChecked={allChecked}
              onToggle={toggle}
              onToggleAll={() => setSelected(allChecked ? new Set() : new Set(shown.map((i) => i.id)))}
              onOpen={canWrite ? (i) => setEditing(i) : undefined}
              actions={(i) => (
                <>
                  <Button variant="ghost" size="icon" className="h-8 px-2" aria-label="عمال البند ومستحقاتهم" title="عمال البند ومستحقاتهم" onClick={() => setStaffFor(i)}>
                    <Users className="size-4" /><span className="text-xs">العمال</span>
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
              quickAdd={canWrite && <QuickAddRow projectId={project.id} phaseId={phaseIdForAdd} nextOrder={nextOrder} />}
              total={sum(shown)}
            />
          </Card>
        )}
      </section>

      <ItemForm open={editing !== null} onClose={() => setEditing(null)} projectId={project.id} item={editing === 'new' ? null : editing} defaultPhase={phaseIdForAdd ?? undefined} nextOrder={nextOrder} />
      {importing && <ImportCatalogModal projectId={project.id} nextOrder={nextOrder} defaultPhase={phaseIdForAdd ?? undefined} onClose={() => setImporting(false)} />}
      {moving && <MovePhaseModal projectId={project.id} itemIds={moving} onClose={() => setMoving(null)} onDone={() => setSelected(new Set())} />}
      <StaffingPanel key={staffFor?.id} item={staffFor} siblings={all} onClose={() => setStaffFor(null)} />
    </div>
  )
}

function ItemsTable({
  rows,
  unitSym,
  missing,
  canWrite,
  selected,
  allChecked,
  onToggle,
  onToggleAll,
  onOpen,
  actions,
  quickAdd,
  total,
}: {
  rows: Item[]
  unitSym: Map<string, string>
  missing: Map<string, number>
  canWrite: boolean
  selected?: Set<string>
  allChecked?: boolean
  onToggle?: (id: string) => void
  onToggleAll?: () => void
  onOpen?: (i: Item) => void
  actions?: (i: Item) => React.ReactNode
  quickAdd?: React.ReactNode
  total?: number
}) {
  const th = 'border-b border-line bg-surface-2 px-3 py-2.5 text-xs font-semibold text-muted'
  return (
    <div>
      {quickAdd}
      <div className="overflow-x-auto"><table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {canWrite && (
              <th className={cn(th, 'w-10')}>
                <input type="checkbox" aria-label="تحديد الكل" className="size-4 accent-brand-600" checked={Boolean(allChecked)} onChange={onToggleAll} />
              </th>
            )}
            <th className={cn(th, 'w-10 text-center')}>م</th>
            <th className={cn(th, 'text-right')}>البند</th>
            <th className={cn(th, 'text-right')}>الكمية الأصلية</th>
            <th className={cn(th, 'text-center')}>معامل التكعيب</th>
            <th className={cn(th, 'text-right')}>الكمية النهائية</th>
            <th className={cn(th, 'text-left')}>سعر الوحدة</th>
            <th className={cn(th, 'text-left')}>الإجمالي</th>
            <th className={cn(th, 'w-px')} aria-label="إجراءات" />
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={canWrite ? 9 : 8} className="px-4 py-8 text-center text-sm text-muted">
                <Package className="mx-auto mb-2 size-6 text-faint" />
                لا توجد بنود بعد. {canWrite && 'اكتب البند في مساحة الإضافة أعلاه واضغط Enter.'}
              </td>
            </tr>
          )}
          {rows.map((i, n) => (
            <tr key={i.id} onClick={onOpen && !i.id.startsWith('temp-') ? () => onOpen(i) : undefined} className={cn('group hover:bg-surface-2', onOpen && 'cursor-pointer', selected?.has(i.id) && 'bg-accent-soft/50', i.id.startsWith('temp-') && 'opacity-60')}>
              {canWrite && (
                <td className="border-b border-line px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`تحديد ${i.name}`} className="size-4 accent-brand-600" checked={Boolean(selected?.has(i.id))} onChange={() => onToggle?.(i.id)} />
                </td>
              )}
              <td className="num border-b border-line px-3 py-2 text-center text-xs text-muted">{n + 1}</td>
              <td className="border-b border-line px-3 py-2">
                <div className="font-medium">{i.name}</div>
                {(missing.get(i.id) ?? 0) > 0 && <Badge tone="amber">فنيون ناقصون {missing.get(i.id)}</Badge>}
              </td>
              <td className="border-b border-line px-3 py-2 whitespace-nowrap">
                <NumberWithUnit value={i.base_quantity ?? i.quantity} unit={unitSym.get(i.unit_id ?? '')} unitClassName="text-xs text-muted" />
              </td>
              <td className="num border-b border-line px-3 py-2 text-center">{i.cubic_factor ?? 1}</td>
              <td className="border-b border-line px-3 py-2 whitespace-nowrap">
                <NumberWithUnit value={i.quantity} unit={unitSym.get(i.unit_id ?? '')} unitClassName="text-xs text-muted" />
              </td>
              <td className="border-b border-line px-3 py-2 text-left">
                <Money value={i.unit_price} />
              </td>
              <td className="border-b border-line px-3 py-2 text-left">
                <Money value={i.total_price} className="font-semibold" />
              </td>
              <td className="border-b border-line px-2 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">{actions?.(i)}</div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {total !== undefined && rows.length > 0 && (
            <tr className="bg-surface-2 font-semibold">
              <td colSpan={canWrite ? 7 : 6} className="px-3 py-2.5">
                الإجمالي ({rows.length} بند)
              </td>
              <td className="px-3 py-2.5 text-left">
                <Money value={total} />
              </td>
              <td colSpan={1} />
            </tr>
          )}
        </tfoot>
      </table></div>
    </div>
  )
}
