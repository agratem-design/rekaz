import { PayrollPage } from './business/PayrollPage'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Building2, CalendarDays, HardHat, Link2, Mail, Package, Phone, Plus, Printer, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Money, PageHeader, Select, Skeleton, StatCard, Tabs } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { projectStatusLabels, projectStatusTone } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { IssueForm } from './CustodiesPage'
import { useCustodies, type CustodyRow } from './expenses/expenseData'

function CustodyList({ rows, onIssue }: { rows: CustodyRow[]; onIssue?: () => void }) {
  return (
    <DataTable
      rows={rows}
      getKey={(c) => c.id}
      rowClassName={(c) => c.status === 'reversed' && 'text-faint line-through'}
      rowActions={(c) => (
        <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة كشف العهدة" title="طباعة كشف العهدة (يشمل الإرجاعات)" onClick={() => openPrint('custody-statement', c.id)}>
          <Printer className="size-4" />
        </Button>
      )}
      empty={<EmptyState icon={Wallet} title="لا توجد عهد" action={onIssue && <Button onClick={onIssue}>صرف عهدة</Button>} />}
      columns={[
        { key: 'date', label: 'التاريخ', render: (c) => <span className="num text-muted">{formatDate(c.issue_date)}</span> },
        { key: 'purpose', label: 'الغرض', render: (c) => c.purpose ?? '—' },
        { key: 'project', label: 'المشروع', hideBelow: 'sm', render: (c) => c.projects?.name ?? <Badge>عامة</Badge> },
        { key: 'amount', label: 'العهدة', align: 'end', render: (c) => <Money value={c.amount} /> },
        { key: 'remaining', label: 'المتبقي', align: 'end', render: (c) => (c.is_closed ? <Badge>مغلقة</Badge> : <Money value={c.remaining} className="font-semibold" />) },
      ]}
      onRowClick={() => (window.location.hash = '#/custodies')}
    />
  )
}

// ───────────── صفحة الموظف ─────────────
export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')
  const qc = useQueryClient()
  const [tab, setTab] = useState('custody')
  const [issuing, setIssuing] = useState(false)
  const e = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
  const profiles = useQuery({
    queryKey: ['profiles-for-link'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, display_name, username').order('display_name')
      if (error) throw error
      return data ?? []
    },
  })
  const link = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from('employees').update({ profile_id: profileId || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم ربط حساب المستخدم')
      qc.invalidateQueries({ queryKey: ['employee', id] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const custodies = useCustodies()
  if (e.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (e.error)
    return (e.error as { code?: string }).code === 'PGRST116' ? (
      <Card>
        <EmptyState title="الموظف غير موجود" action={<Button variant="secondary" onClick={() => navigate('/employees')}>العودة للموظفين</Button>} />
      </Card>
    ) : (
      <ErrorState message={errorMessage(e.error)} onRetry={() => e.refetch()} />
    )
  const emp = e.data!
  const mine = (custodies.data ?? []).filter((c) => c.employee_id === emp.id)
  const open = mine.filter((c) => c.status === 'posted' && !c.is_closed)
  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'الموظفون', to: '/employees' }, { label: emp.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={emp.name} size="lg" />
            {emp.name}
            {!emp.is_active && <Badge>ليس على رأس العمل</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            {(emp.position || emp.department) && (
              <span className="flex items-center gap-1">
                <Briefcase className="size-3.5" />
                {[emp.position, emp.department].filter(Boolean).join(' · ')}
              </span>
            )}
            {emp.phone && (
              <span className="num flex items-center gap-1">
                <Phone className="size-3.5" />
                {emp.phone}
              </span>
            )}
            {emp.hire_date && (
              <span className="num flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                منذ {formatDate(emp.hire_date)}
              </span>
            )}
          </span>
        }
        actions={
          <Button onClick={() => setIssuing(true)}>
            <Plus className="size-4" />
            صرف عهدة للموظف
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Briefcase} label="الراتب الأساسي" value={<Money value={emp.base_salary} />} />
        <StatCard icon={Wallet} label="عهد مفتوحة" value={<span className="num">{open.length}</span>} tone="sand" />
        <StatCard icon={Wallet} label="المتبقي في عهده" value={<Money value={open.reduce((a, c) => a + c.remaining, 0)} />} tone="blue" />
      </div>
      {isAdmin && (
        <Card className="mb-5">
          <CardHeader title="حساب المستخدم المرتبط" icon={Link2} description="يربط الموظف بحساب دخول في المنظومة" />
          <Field label="المستخدم">
            <Select value={emp.profile_id ?? ''} onChange={(ev) => link.mutate(ev.target.value)} disabled={link.isPending} className="max-w-sm">
              <option value="">— بلا حساب —</option>
              {(profiles.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.username})
                </option>
              ))}
            </Select>
          </Field>
          {emp.profile_id && (
            <p className="mt-2 text-xs text-muted">مرتبط بـ {(profiles.data ?? []).find((p) => p.id === emp.profile_id)?.display_name ?? 'حساب مستخدم'}</p>
          )}
        </Card>
      )}
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'custody', label: 'العهد', icon: Wallet },
          { key: 'payroll', label: 'الرواتب والسلف', icon: Briefcase },
        ]}
      />
      <div className="mt-4">{tab === 'custody' ? <CustodyList rows={mine} onIssue={() => setIssuing(true)} /> : <PayrollPage employeeId={emp.id} />}</div>
      <IssueForm open={issuing} onClose={() => setIssuing(false)} holderType="employee" holderId={emp.id} />
    </div>
  )
}

// ───────────── صفحة المهندس ─────────────
export function EngineerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')
  const finance = hasRole('admin', 'accountant')
  const qc = useQueryClient()
  const [tab, setTab] = useState('projects')
  const [issuing, setIssuing] = useState(false)
  const data = useQuery({
    queryKey: ['engineer', id],
    queryFn: async () => {
      const [e, projects, items, profiles] = await Promise.all([
        supabase.from('engineers').select('*').eq('id', id).single(),
        supabase.from('projects').select('id, name, status, project_type, clients(name)').eq('supervising_engineer_id', id).order('created_at', { ascending: false }),
        supabase.from('project_items').select('id, name, total_price, project_id, projects(name)').eq('engineer_id', id),
        supabase.from('profiles').select('id, display_name, username').order('display_name'),
      ])
      if (e.error) throw e.error
      for (const r of [projects, items]) if (r.error) throw r.error
      return { eng: e.data, projects: projects.data ?? [], items: items.data ?? [], profiles: profiles.data ?? [] }
    },
  })
  const custodies = useCustodies()
  const link = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from('engineers').update({ profile_id: profileId || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم ربط حساب المستخدم')
      qc.invalidateQueries({ queryKey: ['engineer', id] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  if (data.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (data.error)
    return (data.error as { code?: string }).code === 'PGRST116' ? (
      <Card>
        <EmptyState title="المهندس غير موجود" action={<Button variant="secondary" onClick={() => navigate('/engineers')}>العودة للمهندسين</Button>} />
      </Card>
    ) : (
      <ErrorState message={errorMessage(data.error)} onRetry={() => data.refetch()} />
    )
  const { eng, projects, items, profiles } = data.data!
  const mine = (custodies.data ?? []).filter((c) => c.engineer_id === eng.id)
  const linked = profiles.find((p) => p.id === eng.profile_id)
  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'المهندسون', to: '/engineers' }, { label: eng.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={eng.name} size="lg" />
            {eng.name}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            {eng.specialty && (
              <span className="flex items-center gap-1">
                <HardHat className="size-3.5" />
                {eng.specialty}
                {eng.license_number ? ` · قيد ${eng.license_number}` : ''}
              </span>
            )}
            {eng.phone && (
              <span className="num flex items-center gap-1">
                <Phone className="size-3.5" />
                {eng.phone}
              </span>
            )}
            {eng.email && (
              <span className="flex items-center gap-1" dir="ltr">
                <Mail className="size-3.5" />
                {eng.email}
              </span>
            )}
          </span>
        }
        actions={
          finance && (
            <Button onClick={() => setIssuing(true)}>
              <Plus className="size-4" />
              صرف عهدة للمهندس
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Building2} label="مشاريع يشرف عليها" value={<span className="num">{projects.length}</span>} />
        <StatCard icon={Package} label="بنود مسؤول عنها" value={<span className="num">{items.length}</span>} tone="blue" />
        <StatCard icon={Wallet} label="عهد مفتوحة" value={<span className="num">{mine.filter((c) => c.status === 'posted' && !c.is_closed).length}</span>} tone="sand" />
      </div>
      {isAdmin && (
        <Card className="mb-5">
          <CardHeader title="حساب المستخدم المرتبط" icon={Link2} description="يربط المهندس بحساب دخول في المنظومة" />
          <Field label="المستخدم">
            <Select value={eng.profile_id ?? ''} onChange={(e) => link.mutate(e.target.value)} disabled={link.isPending} className="max-w-sm">
              <option value="">— بلا حساب —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.username})
                </option>
              ))}
            </Select>
          </Field>
          {linked && <p className="mt-2 text-xs text-muted">مرتبط بـ {linked.display_name}</p>}
        </Card>
      )}
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'projects', label: 'المشاريع', icon: Building2 },
          { key: 'items', label: 'البنود', icon: Package },
          ...(finance ? [{ key: 'custody', label: 'العهد', icon: Wallet }] : []),
        ]}
      />
      <div className="mt-4">
        {tab === 'projects' && (
          <DataTable
            rows={projects}
            getKey={(p) => p.id}
            onRowClick={(p) => navigate(`/projects/${p.id}`)}
            empty={<EmptyState icon={Building2} title="لا يشرف على مشاريع" />}
            columns={[
              { key: 'name', label: 'المشروع', render: (p) => <span className="font-medium">{p.name}</span> },
              { key: 'client', label: 'الزبون', render: (p) => p.clients?.name },
              { key: 'status', label: 'الحالة', render: (p) => <Badge tone={projectStatusTone[p.status]} dot>{projectStatusLabels[p.status]}</Badge> },
            ]}
          />
        )}
        {tab === 'items' && (
          <DataTable
            rows={items}
            getKey={(i) => i.id}
            empty={<EmptyState icon={Package} title="لا توجد بنود مسندة" />}
            columns={[
              { key: 'name', label: 'البند', render: (i) => <span className="font-medium">{i.name}</span> },
              { key: 'project', label: 'المشروع', render: (i) => <Link to={`/projects/${i.project_id}/items`} className="hover:underline">{i.projects?.name}</Link> },
            ]}
          />
        )}
        {tab === 'custody' && <CustodyList rows={mine} onIssue={() => setIssuing(true)} />}
      </div>
      {finance && <IssueForm open={issuing} onClose={() => setIssuing(false)} holderType="engineer" holderId={eng.id} />}
    </div>
  )
}
