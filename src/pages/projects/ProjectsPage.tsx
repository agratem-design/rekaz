import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Building2, CalendarDays, CircleDollarSign, HardHat, LayoutGrid, Layers, List, MapPin, Paintbrush, Plus, Scale, Settings2, User } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable, RecordCount } from '@/components/DataTable'
import { Menu } from '@/components/Menu'
import { Badge, Button, Card, CardsSkeleton, EmptyState, ErrorState, FilterChips, Money, PageHeader, ProgressBar, SearchInput, Select, StatCard, cn } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { useProjectsFinancials, type ProjectWithFin } from '@/lib/queries'
import { errorMessage, type Enums } from '@/lib/supabase'
import { ProjectForm } from './ProjectForm'

type StatusFilter = 'all' | Enums<'project_status'>
type Sort = 'recent' | 'name' | 'remaining' | 'value'

function readView(): 'grid' | 'list' {
  try {
    return localStorage.getItem('projects-view') === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

const progressOf = (p: ProjectWithFin) => {
  const items = Number(p.fin?.items_total ?? 0)
  return items > 0 ? (Number(p.fin?.earned_value ?? 0) / items) * 100 : null
}
const collectionOf = (p: ProjectWithFin) => {
  const ob = Number(p.fin?.client_obligation ?? 0)
  return ob > 0 ? (Number(p.fin?.collected ?? 0) / ob) * 100 : null
}

export function ProjectsPage({ type }: { type: Enums<'project_type'> }) {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const finance = hasRole('admin', 'accountant')
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const { data, isLoading, error, refetch } = useProjectsFinancials()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<'grid' | 'list'>(readView)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProjectWithFin | null>(null)

  const changeView = (v: 'grid' | 'list') => {
    setView(v)
    try {
      localStorage.setItem('projects-view', v)
    } catch {
      /* التخزين غير متاح */
    }
  }

  const all = useMemo(() => (data ?? []).filter((p) => p.project_type === type), [data, type])
  const q = search.trim()
  const shown = useMemo(() => {
    const list = all.filter((p) => (status === 'all' || p.status === status) && (!q || p.name.includes(q) || (p.clients?.name ?? '').includes(q) || (p.location ?? '').includes(q) || (p.engineers?.name ?? '').includes(q)))
    const by: Record<Sort, (a: ProjectWithFin, b: ProjectWithFin) => number> = {
      recent: (a, b) => b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
      remaining: (a, b) => Number(b.fin?.client_remaining ?? 0) - Number(a.fin?.client_remaining ?? 0),
      value: (a, b) => Number(b.fin?.client_obligation ?? 0) - Number(a.fin?.client_obligation ?? 0),
    }
    return [...list].sort(by[sort])
  }, [all, status, q, sort])
  const count = (s: StatusFilter) => all.filter((p) => p.status === s).length
  const sum = (k: 'client_obligation' | 'collected') => shown.reduce((a, p) => a + Number(p.fin?.[k] ?? 0), 0)
  const due = shown.reduce((a, p) => a + Math.max(Number(p.fin?.client_remaining ?? 0), 0), 0)
  const contracting = type === 'contracting'
  const title = contracting ? 'مشاريع المقاولات' : 'مشاريع التشطيبات'
  const Icon = contracting ? Building2 : Paintbrush
  const newLabel = `مشروع ${projectTypeLabels[type]} جديد`

  const addButton = canWrite && (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" />
      {newLabel}
    </Button>
  )

  const actions = (p: ProjectWithFin) => [
    { label: 'لوحة المشروع', icon: Icon, onClick: () => navigate(`/projects/${p.id}`) },
    { label: 'مراحل المشروع', icon: Layers, onClick: () => navigate(`/projects/${p.id}/phases`) },
    { label: 'إعدادات المشروع', icon: Settings2, onClick: () => setEditing(p), hidden: !canWrite },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        description={contracting ? 'مشاريع بسعر ثابت من العقود أو بنود المقاولات' : 'مشاريع بالتكلفة الفعلية مضافاً إليها نسبة الشركة'}
        actions={addButton}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard
          icon={Icon}
          label="المشاريع"
          value={<span className="num">{isLoading ? '…' : all.length}</span>}
          hint={`${count('active')} قيد التنفيذ · ${count('planned')} مخطط · ${count('completed')} مكتمل`}
        />
        {finance ? (
          <>
            <StatCard icon={Scale} label={contracting ? 'قيمة المشاريع' : 'إجمالي الاستحقاق'} value={<Money value={sum('client_obligation')} />} tone="sand" hint="للمشاريع المعروضة" />
            <StatCard icon={Banknote} label="المحصّل" value={<Money value={sum('collected')} />} tone="blue" hint={sum('client_obligation') > 0 ? `${((sum('collected') / sum('client_obligation')) * 100).toFixed(0)}% من الاستحقاق` : undefined} />
            <StatCard icon={CircleDollarSign} label="المتبقي على الزبائن" value={<Money value={due} />} tone="red" />
          </>
        ) : (
          <StatCard icon={CalendarDays} label="قيد التنفيذ" value={<span className="num">{count('active')}</span>} tone="blue" />
        )}
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المشروع، الزبون، الموقع، المهندس…" />
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'الكل', count: all.length },
            { value: 'active', label: projectStatusLabels.active, count: count('active') },
            { value: 'planned', label: projectStatusLabels.planned, count: count('planned') },
            { value: 'on_hold', label: projectStatusLabels.on_hold, count: count('on_hold') },
            { value: 'completed', label: projectStatusLabels.completed, count: count('completed') },
          ]}
        />
        <div className="ms-auto flex items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 w-auto text-xs" aria-label="الترتيب">
            <option value="recent">الأحدث أولاً</option>
            <option value="name">حسب الاسم</option>
            {finance && <option value="remaining">الأعلى متبقياً</option>}
            {finance && <option value="value">الأعلى قيمة</option>}
          </Select>
          <RecordCount shown={shown.length} total={all.length} />
          <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="طريقة العرض">
            {(
              [
                ['grid', LayoutGrid, 'عرض شبكي'],
                ['list', List, 'عرض قائمة'],
              ] as const
            ).map(([v, I, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={l}
                title={l}
                onClick={() => changeView(v)}
                className={cn('rounded-md p-1.5', view === v ? 'bg-accent-soft text-brand-700 dark:text-sand-200' : 'text-faint hover:text-ink')}
              >
                <I className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : !shown.length ? (
        <Card>
          {q || status !== 'all' ? (
            <EmptyState title="لا توجد مشاريع تطابق البحث" action={<Button variant="secondary" onClick={() => (setSearch(''), setStatus('all'))}>مسح الفلاتر</Button>}>
              جرّب كلمة أخرى أو أزل فلتر الحالة.
            </EmptyState>
          ) : (
            <EmptyState icon={Icon} title={`لا توجد ${title} حتى الآن`} action={addButton}>
              {contracting ? 'ابدأ بإنشاء أول مشروع مقاولات لمتابعة المراحل والمقايسات والتكاليف.' : 'ابدأ بإنشاء أول مشروع تشطيبات بنسبة الشركة لمتابعة الأعمال والمدفوعات.'}
            </EmptyState>
          )}
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} p={p} finance={finance} menu={<Menu items={actions(p)} />} />
          ))}
        </div>
      ) : (
        <DataTable
          rows={shown}
          getKey={(p) => p.id}
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          rowActions={(p) => <Menu items={actions(p)} />}
          columns={[
            {
              key: 'name',
              label: 'المشروع / الزبون',
              render: (p) => (
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.clients?.name}
                    {p.location ? ` · ${p.location}` : ''}
                  </div>
                </div>
              ),
            },
            { key: 'status', label: 'الحالة', render: (p) => <Badge tone={projectStatusTone[p.status]} dot>{projectStatusLabels[p.status]}</Badge> },
            { key: 'engineer', label: 'المهندس المشرف', hideBelow: 'lg', render: (p) => p.engineers?.name ?? <span className="text-faint">—</span> },
            ...(contracting
              ? [
                  {
                    key: 'progress',
                    label: 'الإنجاز',
                    hideBelow: 'md' as const,
                    render: (p: ProjectWithFin) => {
                      const v = progressOf(p)
                      return v === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <div className="flex min-w-24 items-center gap-2">
                          <ProgressBar value={v} tone="green" />
                          <span className="num w-9 text-xs text-muted">{v.toFixed(0)}%</span>
                        </div>
                      )
                    },
                  },
                ]
              : []),
            ...(finance
              ? [
                  { key: 'ob', label: contracting ? 'قيمة المشروع' : 'إجمالي المستحق', align: 'end' as const, render: (p: ProjectWithFin) => <Money value={p.fin?.client_obligation} /> },
                  { key: 'col', label: 'المحصّل', align: 'end' as const, hideBelow: 'sm' as const, render: (p: ProjectWithFin) => <Money value={p.fin?.collected} /> },
                  { key: 'rem', label: 'المتبقي على الزبون', align: 'end' as const, render: (p: ProjectWithFin) => <Remaining value={p.fin?.client_remaining} /> },
                ]
              : []),
          ]}
        />
      )}

      <ProjectForm open={creating} onClose={() => setCreating(false)} type={type} />
      <ProjectForm open={editing !== null} onClose={() => setEditing(null)} project={editing} />
    </div>
  )
}

export function Remaining({ value }: { value: number | null | undefined }) {
  const v = Number(value ?? 0)
  if (v < 0)
    return (
      <span className="inline-flex flex-col items-end">
        <Money value={-v} className="text-sand-600 dark:text-sand-300" />
        <span className="text-[10px] text-sand-600 dark:text-sand-300">زيادة مدفوعة</span>
      </span>
    )
  return <Money value={v} className={v > 0 ? 'font-semibold' : 'text-muted'} />
}

const statusStrip: Record<Enums<'project_status'>, string> = {
  active: 'bg-olive-500',
  planned: 'bg-sky-500',
  on_hold: 'bg-amber-500',
  completed: 'bg-sand-400',
  cancelled: 'bg-red-500',
}

function ProjectCard({ p, finance, menu }: { p: ProjectWithFin; finance: boolean; menu: React.ReactNode }) {
  const ob = Number(p.fin?.client_obligation ?? 0)
  const col = Number(p.fin?.collected ?? 0)
  const progress = progressOf(p)
  const collection = collectionOf(p)
  const Icon = p.project_type === 'contracting' ? Building2 : Paintbrush
  return (
    <Card className="group relative flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md motion-reduce:hover:translate-y-0 dark:hover:border-brand-700">
      <span className={cn('absolute inset-x-0 top-0 h-1', statusStrip[p.status])} />
      <Link to={`/projects/${p.id}`} className="absolute inset-0 rounded-xl" aria-label={p.name} />
      <div className="flex items-start gap-3 p-4 pt-5">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/60 dark:text-sand-300">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={projectStatusTone[p.status]} dot>
              {projectStatusLabels[p.status]}
            </Badge>
            {p.project_type === 'finishing' && p.finishing_percentage !== null && <Badge tone="sand">نسبة الشركة {p.finishing_percentage}%</Badge>}
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold">{p.name}</h3>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <User className="size-3.5" />
            {p.clients?.name ?? 'زبون غير محدد'}
          </div>
        </div>
        <div className="relative z-10">{menu}</div>
      </div>

      <div className="space-y-2.5 px-4 pb-3">
        {progress !== null && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>نسبة الإنجاز</span>
              <span className="num font-medium text-ink">{progress.toFixed(0)}%</span>
            </div>
            <ProgressBar value={progress} tone="green" label="نسبة الإنجاز" />
          </div>
        )}
        {finance && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>نسبة التحصيل</span>
              <span className="num font-medium text-ink">{collection === null ? '—' : `${Math.min(collection, 999).toFixed(0)}%`}</span>
            </div>
            <ProgressBar value={col} max={ob || col || 1} tone={col > ob ? 'sand' : 'brand'} label="نسبة التحصيل" />
          </div>
        )}
      </div>

      {finance && (
        <div className="grid grid-cols-3 gap-2 border-t border-line bg-surface-2 px-4 py-3 text-xs">
          <div>
            <div className="text-muted">{p.project_type === 'finishing' ? 'المستحق' : 'القيمة'}</div>
            <Money value={ob} className="mt-0.5 block text-sm font-semibold" />
          </div>
          <div>
            <div className="text-muted">المحصّل</div>
            <Money value={col} className="mt-0.5 block text-sm font-semibold" />
          </div>
          <div className="text-left">
            <div className="text-muted">المتبقي</div>
            <div className="mt-0.5 text-sm">
              <Remaining value={p.fin?.client_remaining} />
            </div>
          </div>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-muted">
        {p.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {p.location}
          </span>
        )}
        {p.engineers?.name && (
          <span className="flex items-center gap-1">
            <HardHat className="size-3" />
            {p.engineers.name}
          </span>
        )}
        {p.start_date && (
          <span className="num flex items-center gap-1">
            <CalendarDays className="size-3" />
            {formatDate(p.start_date)}
          </span>
        )}
        {!p.location && !p.engineers?.name && !p.start_date && <span>لا تفاصيل إضافية</span>}
      </div>
    </Card>
  )
}
