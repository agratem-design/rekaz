import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, LayoutGrid, Layers, List, MapPin, Paintbrush, Plus, Settings2, Timer, User } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable, RecordCount } from '@/components/DataTable'
import { Menu } from '@/components/Menu'
import { Badge, Button, Card, CardsSkeleton, EmptyState, ErrorState, FilterChips, Money, PageHeader, ProgressBar, SearchInput, StatCard, cn } from '@/components/ui'
import { projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { useProjectsFinancials, type ProjectWithFin } from '@/lib/queries'
import { errorMessage, type Enums } from '@/lib/supabase'
import { ProjectForm } from './ProjectForm'

type StatusFilter = 'all' | Enums<'project_status'>

function readView(): 'grid' | 'list' {
  try {
    return localStorage.getItem('projects-view') === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function ProjectsPage({ type }: { type: Enums<'project_type'> }) {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const finance = hasRole('admin', 'accountant')
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const { data, isLoading, error, refetch } = useProjectsFinancials()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
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

  const all = (data ?? []).filter((p) => p.project_type === type)
  const q = search.trim()
  const shown = all.filter((p) => (status === 'all' || p.status === status) && (!q || p.name.includes(q) || (p.clients?.name ?? '').includes(q) || (p.location ?? '').includes(q)))
  const count = (s: StatusFilter) => all.filter((p) => p.status === s).length
  const title = type === 'contracting' ? 'مشاريع المقاولات' : 'مشاريع التشطيبات'
  const Icon = type === 'contracting' ? Building2 : Paintbrush
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
      <PageHeader title={title} description={type === 'contracting' ? 'مشاريع بسعر ثابت من العقود أو بنود المقايسة' : 'مشاريع بالتكلفة الفعلية مضافاً إليها نسبة الشركة'} actions={addButton} />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Icon} label="إجمالي المشاريع" value={<span className="num">{isLoading ? '…' : all.length}</span>} />
        <StatCard icon={Timer} label="قيد التنفيذ" value={<span className="num">{isLoading ? '…' : count('active')}</span>} tone="blue" />
        <StatCard icon={CheckCircle2} label="مكتملة" value={<span className="num">{isLoading ? '…' : count('completed')}</span>} tone="sand" />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المشروع، الزبون، أو الموقع…" />
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
        <div className="ms-auto flex items-center gap-3">
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
                className={cn('rounded-md p-1.5', view === v ? 'bg-accent-soft text-brand-700 dark:text-brand-200' : 'text-faint hover:text-ink')}
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
            <EmptyState title="لا توجد مشاريع تطابق البحث" action={<Button variant="secondary" onClick={() => (setSearch(''), setStatus('all'))}>مسح الفلاتر</Button>} />
          ) : (
            <EmptyState icon={Icon} title={`لا توجد ${title} حتى الآن`} action={addButton}>
              {type === 'contracting' ? 'ابدأ بإنشاء أول مشروع مقاولات لمتابعة المراحل والمقايسات والتكاليف.' : 'ابدأ بإنشاء أول مشروع تشطيبات بنسبة الشركة لمتابعة الأعمال والمدفوعات.'}
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
                  <div className="text-xs text-muted">{p.clients?.name}</div>
                </div>
              ),
            },
            { key: 'status', label: 'الحالة', render: (p) => <Badge tone={projectStatusTone[p.status]} dot>{projectStatusLabels[p.status]}</Badge> },
            { key: 'location', label: 'الموقع', hideBelow: 'md', render: (p) => p.location ?? <span className="text-faint">—</span> },
            { key: 'engineer', label: 'المهندس المشرف', hideBelow: 'lg', render: (p) => p.engineers?.name ?? <span className="text-faint">—</span> },
            ...(finance
              ? [
                  { key: 'ob', label: type === 'finishing' ? 'إجمالي المستحق' : 'قيمة المشروع', align: 'end' as const, render: (p: ProjectWithFin) => <Money value={p.fin?.client_obligation} /> },
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

function ProjectCard({ p, finance, menu }: { p: ProjectWithFin; finance: boolean; menu: React.ReactNode }) {
  const ob = Number(p.fin?.client_obligation ?? 0)
  const col = Number(p.fin?.collected ?? 0)
  const items = Number(p.fin?.items_total ?? 0)
  const progress = items > 0 ? (Number(p.fin?.earned_value ?? 0) / items) * 100 : 0
  return (
    <Card className="group relative flex flex-col p-0 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
      <Link to={`/projects/${p.id}`} className="absolute inset-0 rounded-xl" aria-label={p.name} />
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={projectStatusTone[p.status]} dot>
              {projectStatusLabels[p.status]}
            </Badge>
            {p.project_type === 'finishing' && p.finishing_percentage !== null && <Badge tone="sand">نسبة الشركة {p.finishing_percentage}%</Badge>}
          </div>
          <h3 className="truncate text-base font-semibold">{p.name}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <User className="size-3.5" />
              {p.clients?.name ?? 'زبون غير محدد'}
            </span>
            {p.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {p.location}
              </span>
            )}
          </div>
        </div>
        <div className="relative z-10">{menu}</div>
      </div>
      {p.project_type === 'contracting' && items > 0 && (
        <div className="px-4 pb-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>نسبة الإنجاز</span>
            <span className="num">{progress.toFixed(0)}%</span>
          </div>
          <ProgressBar value={progress} tone="green" label="نسبة الإنجاز" />
        </div>
      )}
      {finance && (
        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line bg-surface-2 px-4 py-3 text-xs">
          <div>
            <div className="text-muted">{p.project_type === 'finishing' ? 'إجمالي المستحق' : 'قيمة المشروع'}</div>
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
          <ProgressBar value={col} max={ob || col || 1} tone={col > ob ? 'sand' : 'brand'} className="col-span-3" label="نسبة التحصيل" />
        </div>
      )}
    </Card>
  )
}
