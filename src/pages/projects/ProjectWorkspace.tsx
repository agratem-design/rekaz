import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, Coins, FileSignature, FolderKanban, Layers, MapPin, Package, Printer, Receipt, Settings2, ShoppingCart, TrendingUp, User, Wrench } from 'lucide-react'
import { openPrint } from '@/print/open'
import { useAuth } from '@/auth/AuthProvider'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui'
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

  return (
    <div>
      <PageHeader
        crumbs={[{ label: contracting ? 'مشاريع المقاولات' : 'مشاريع التشطيبات', to: listPath }, { label: p.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name}
            <Badge tone={projectStatusTone[p.status]} dot>
              {projectStatusLabels[p.status]}
            </Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{projectTypeLabels[p.project_type]}{p.project_type === 'finishing' && p.finishing_percentage !== null ? ` · نسبة الشركة ${p.finishing_percentage}%` : ''}</span>
            <Link to={`/clients/${p.client_id}`} className="flex items-center gap-1 hover:text-ink hover:underline">
              <User className="size-3.5" />
              {p.clients?.name}
            </Link>
            {p.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {p.location}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {finance && (
              <Button variant="soft" onClick={() => setReceipt(true)}>
                <Banknote className="size-4" />
                تسجيل إيصال قبض
              </Button>
            )}
            {finance && (
              <Button variant="secondary" onClick={() => openPrint('project-statement', p.id)}>
                <Printer className="size-4" />
                التقرير المالي
              </Button>
            )}
            {canWrite && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Settings2 className="size-4" />
                إعدادات المشروع
              </Button>
            )}
          </>
        }
      />
      <Tabs items={tabs} active={active} onChange={(k) => navigate(`/projects/${p.id}${k ? `/${k}` : ''}`)} />
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
