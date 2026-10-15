import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, Building2, CalendarDays, Coins, FileSignature, FolderKanban, HardHat, Layers, MapPin, Package, Paintbrush, Printer, Receipt, Settings2, ShoppingCart, TrendingUp, User, Wrench } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { openPrint } from '@/print/open'
import { useAuth } from '@/auth/AuthProvider'
import { Badge, Button, Card, EmptyState, ErrorState, Money, PageHeader, ProgressBar, Skeleton, Tabs } from '@/components/ui'
import { projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { useProject } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { StageNotice } from '../ComingSoonPage'
import { ReceiptForm } from '../receipts/ReceiptForm'
import { ReceiptsTable } from '../receipts/ReceiptsTable'
import { ContractsList } from '../contracts/ContractsList'
import { ProjectForm } from './ProjectForm'
import { OverviewTab } from './OverviewTab'
import { PhasesTab } from './PhasesTab'
import { ItemsTab } from './ItemsTab'
import { ProgressTab } from './ProgressTab'
import { ProjectExpensesTab, ProjectPurchasesTab } from './ProjectFinanceTabs'

// مساحة عمل المشروع بتبويبات ثابتة بنفس ترتيب النظام السابق
export function ProjectWorkspace() {
  const { id, tab = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const { data: p, isLoading, error, refetch } = useProject(id)
  const [editing, setEditing] = useState(false)
  const [receipt, setReceipt] = useState(false)

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  if (error)
    return (
      <Card>
        {(error as { code?: string }).code === 'PGRST116' ? (
          <EmptyState title="المشروع غير موجود" action={<Button variant="secondary" onClick={() => navigate('/projects/contracting')}>العودة إلى قائمة المشاريع</Button>}>
            قد يكون الرابط غير صحيح.
          </EmptyState>
        ) : (
          <div className="p-2">
            <ErrorState message={`تعذر تحميل بيانات المشروع: ${errorMessage(error)}`} onRetry={() => refetch()} />
          </div>
        )}
      </Card>
    )
  if (!p) return null

  const contracting = p.project_type === 'contracting'
  const listPath = `/projects/${p.project_type}`
  const tabs = [
    { key: '', label: 'لوحة المشروع', icon: FolderKanban },
    ...(contracting ? [{ key: 'items', label: 'بنود المقايسة', icon: Package }] : []),
    { key: 'phases', label: 'المراحل', icon: Layers },
    { key: 'purchases', label: contracting ? 'المشتريات' : 'المشتريات والخدمات', icon: ShoppingCart },
    { key: 'expenses', label: 'المصروفات', icon: Coins },
    ...(finance ? [{ key: 'payments', label: 'إيصالات القبض', icon: Receipt }] : []),
    ...(contracting ? [{ key: 'progress', label: 'نسب الإنجاز', icon: TrendingUp }] : []),
    { key: 'contracts', label: 'العقود', icon: FileSignature },
    { key: 'equipment', label: 'المعدات', icon: Wrench, muted: true },
  ]
  const active = tabs.some((t) => t.key === tab) ? tab : ''
  const f = p.fin
  const items = Number(f?.items_total ?? 0)
  const progress = items > 0 ? (Number(f?.earned_value ?? 0) / items) * 100 : null
  const remaining = Number(f?.client_remaining ?? 0)
  const TypeIcon = contracting ? Building2 : Paintbrush

  return (
    <div>
      <PageHeader crumbs={[{ label: contracting ? 'مشاريع المقاولات' : 'مشاريع التشطيبات', to: listPath }, { label: p.name }]} title="" />
      <div className="-mt-6 mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="relative flex flex-wrap items-start gap-4 bg-linear-to-l from-brand-800 to-brand-950 p-5 text-white">
          <span className="rounded-2xl bg-white/10 p-3 text-sand-300 ring-1 ring-white/15">
            <TypeIcon className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <Badge tone={projectStatusTone[p.status]} dot>
                {projectStatusLabels[p.status]}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-100/85">
              <span>
                {projectTypeLabels[p.project_type]}
                {p.project_type === 'finishing' && p.finishing_percentage !== null ? ` · نسبة الشركة ${p.finishing_percentage}%` : ''}
              </span>
              <Link to={`/clients/${p.client_id}`} className="flex items-center gap-1 hover:text-white hover:underline">
                <User className="size-3.5" />
                {p.clients?.name}
              </Link>
              {p.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {p.location}
                </span>
              )}
              {p.engineers?.name && (
                <span className="flex items-center gap-1">
                  <HardHat className="size-3.5" />
                  {p.engineers.name}
                </span>
              )}
              {p.start_date && (
                <span className="num flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatDate(p.start_date)}
                  {p.end_date ? ` ← ${formatDate(p.end_date)}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {finance && (
              <Button className="bg-sand-400 text-brand-950 hover:bg-sand-300" onClick={() => setReceipt(true)}>
                <Banknote className="size-4" />
                تسجيل إيصال قبض
              </Button>
            )}
            {finance && (
              <Button variant="ghost" className="text-brand-100! hover:bg-white/10 hover:text-white!" onClick={() => openPrint('project-statement', p.id)}>
                <Printer className="size-4" />
                التقرير المالي
              </Button>
            )}
            {canWrite && (
              <Button variant="ghost" className="text-brand-100! hover:bg-white/10 hover:text-white!" onClick={() => setEditing(true)}>
                <Settings2 className="size-4" />
                الإعدادات
              </Button>
            )}
          </div>
        </div>
        {(finance || progress !== null) && (
          <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x sm:divide-x-reverse">
            {finance && (
              <>
                <Figure label={contracting ? 'قيمة المشروع' : 'إجمالي الاستحقاق'} value={<Money value={f?.client_obligation} />} />
                <Figure label="المحصّل" value={<Money value={f?.collected} />} />
                <Figure label={remaining < 0 ? 'زيادة مدفوعة' : 'المتبقي على الزبون'} value={<Money value={Math.abs(remaining)} className={remaining > 0 ? 'text-red-700 dark:text-red-400' : remaining < 0 ? 'text-sand-600 dark:text-sand-300' : ''} />} />
              </>
            )}
            {progress !== null ? (
              <Figure
                label="نسبة الإنجاز"
                value={
                  <span className="flex items-center gap-2">
                    <span className="num">{progress.toFixed(0)}%</span>
                    <ProgressBar value={progress} tone="green" className="max-w-24" />
                  </span>
                }
              />
            ) : (
              finance && <Figure label="التكلفة المباشرة" value={<Money value={f?.direct_cost} />} />
            )}
          </dl>
        )}
      </div>
      <div className="sticky top-0 z-20 -mx-4 bg-canvas/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Tabs items={tabs} active={active} onChange={(k) => navigate(`/projects/${p.id}${k ? `/${k}` : ''}`)} />
      </div>
      <div className="mt-5">
        {active === '' && <OverviewTab p={p} onReceipt={() => setReceipt(true)} />}
        {active === 'items' && <ItemsTab project={p} />}
        {active === 'phases' && <PhasesTab project={p} />}
        {active === 'purchases' && <ProjectPurchasesTab project={p} />}
        {active === 'expenses' && <ProjectExpensesTab project={p} />}
        {active === 'payments' && <ReceiptsTable projectId={p.id} onNew={() => setReceipt(true)} />}
        {active === 'progress' && <ProgressTab project={p} />}
        {active === 'contracts' && <ContractsList project={p} />}
        {active === 'equipment' && <StageNotice stage="د" title="المعدات وإيجاراتها تُبنى في المرحلة (د)" />}
      </div>
      <ProjectForm open={editing} onClose={() => setEditing(false)} project={p} />
      {finance && <ReceiptForm open={receipt} onClose={() => setReceipt(false)} clientId={p.client_id} projectId={p.id} />}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-t border-line px-5 py-3 sm:border-t-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}
