import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Building2, CircleDollarSign, Landmark, Truck, Users, Wallet, Wrench, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Badge, Card, CardHeader, CardsSkeleton, EmptyState, ErrorState, Money, PageHeader, ProgressBar, Skeleton, StatCard, cn } from '@/components/ui'
import { domainLabels, projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { formatMoney, todayLong } from '@/lib/format'

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + Number(b ?? 0), 0)

async function load(finance: boolean) {
  const [projects, staffing, treasuries, clients, suppliers, techs, custodies] = await Promise.all([
    supabase.from('project_financials').select('*').in('status', ['planned', 'active', 'on_hold']).order('name'),
    supabase.from('project_item_staffing').select('missing_count').gt('missing_count', 0),
    finance ? supabase.from('treasury_balances').select('*').order('name') : null,
    finance ? supabase.from('client_balances').select('total_due, total_overpaid_on_projects') : null,
    finance ? supabase.from('supplier_balances').select('balance_due, unallocated_advance') : null,
    finance ? supabase.from('technician_balances').select('balance_due') : null,
    finance ? supabase.from('custody_balances').select('remaining').eq('is_closed', false) : null,
  ])
  for (const r of [projects, staffing, treasuries, clients, suppliers, techs, custodies]) if (r?.error) throw r.error
  return {
    projects: projects.data ?? [],
    understaffed: staffing.data?.length ?? 0,
    treasuries: treasuries?.data ?? [],
    clientDue: sum((clients?.data ?? []).map((c) => c.total_due)),
    clientOverpaid: sum((clients?.data ?? []).map((c) => c.total_overpaid_on_projects)),
    supplierDue: sum((suppliers?.data ?? []).map((s) => Math.max(Number(s.balance_due), 0))),
    techDue: sum((techs?.data ?? []).map((t) => Math.max(Number(t.balance_due), 0))),
    openCustodies: custodies?.data?.length ?? 0,
  }
}

type Alert = { tone: 'red' | 'amber' | 'blue'; icon: LucideIcon; text: ReactNode; to: string; action: string }

export function DashboardPage() {
  const { hasRole, profile } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard', finance], queryFn: () => load(finance) })

  const header = <PageHeader title={`أهلاً ${profile?.display_name ?? ''}`} description={todayLong()} />

  if (isLoading)
    return (
      <div className="space-y-6">
        {header}
        <CardsSkeleton count={finance ? 5 : 2} />
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  if (error || !data)
    return (
      <div>
        {header}
        <ErrorState message={`تعذر تحميل المؤشرات: ${errorMessage(error)}. لم تُعرض أرقام ناقصة.`} onRetry={() => refetch()} />
      </div>
    )

  const roots = data.treasuries.filter((t) => !t.parent_id)
  const negative = data.treasuries.filter((t) => Number(t.balance) < 0)
  const maxAbs = Math.max(1, ...data.treasuries.map((t) => Math.abs(Number(t.balance))))
  const overpaidProjects = data.projects.filter((p) => Number(p.client_remaining) < 0)

  const alerts: Alert[] = []
  for (const t of negative)
    alerts.push({ tone: 'red', icon: Landmark, text: <>رصيد سالب في «{t.name}»: <Money value={t.balance} /></>, to: '/treasuries', action: 'الخزائن' })
  if (data.clientOverpaid > 0)
    alerts.push({
      tone: 'amber',
      icon: CircleDollarSign,
      text: <>زبائن دفعوا أكثر من التزامهم على مشاريع بمجموع <Money value={data.clientOverpaid} /></>,
      to: overpaidProjects.length === 1 ? `/projects/${overpaidProjects[0].project_id}` : '/clients',
      action: overpaidProjects.length === 1 ? 'لوحة المشروع' : 'الزبائن',
    })
  if (data.understaffed > 0)
    alerts.push({ tone: 'amber', icon: Wrench, text: <>{data.understaffed} تخصص في بنود المشاريع خطة العمالة فيه ناقصة</>, to: '/projects/contracting', action: 'المشاريع' })
  if (data.openCustodies > 0) alerts.push({ tone: 'blue', icon: Wallet, text: <>{data.openCustodies} عهدة مفتوحة لم تُسوَّ</>, to: '/custodies', action: 'العهد' })

  return (
    <div className="space-y-6">
      {header}

      <div className={cn('grid grid-cols-2 gap-2 sm:gap-3', finance ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
        {finance && <StatCard icon={Landmark} label="إجمالي الخزائن" value={<Money value={sum(data.treasuries.map((t) => t.balance))} />} to="/treasuries" hint={`${data.treasuries.length} خزينة وحساب`} />}
        {finance && <StatCard icon={Users} label="مستحق على الزبائن" value={<Money value={data.clientDue} />} to="/clients" tone="sand" />}
        {finance && <StatCard icon={Truck} label="مستحق للموردين" value={<Money value={data.supplierDue} />} to="/suppliers" tone="blue" />}
        {finance && <StatCard icon={Wrench} label="مستحق للفنيين" value={<Money value={data.techDue} />} to="/technicians" tone="blue" />}
        <StatCard icon={Building2} label="مشاريع قائمة" value={<span className="num">{data.projects.length}</span>} to="/projects/contracting" />
      </div>

      {alerts.length > 0 && (
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" />
            تنبيهات المتابعة
          </div>
          <ul className="divide-y divide-line">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link to={a.to} className="group flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span
                    className={cn(
                      'rounded-lg p-1.5',
                      a.tone === 'red' && 'bg-red-50 text-red-600 dark:bg-red-950/60',
                      a.tone === 'amber' && 'bg-amber-50 text-amber-600 dark:bg-amber-950/60',
                      a.tone === 'blue' && 'bg-sky-50 text-sky-600 dark:bg-sky-950/60',
                    )}
                  >
                    <a.icon className="size-4" />
                  </span>
                  <span className="flex-1">{a.text}</span>
                  <span className="flex items-center gap-1 text-xs text-muted group-hover:text-brand-600">
                    {a.action}
                    <ArrowLeft className="size-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        {finance && (
          <Card className="xl:col-span-2">
            <CardHeader title="أرصدة الخزائن" icon={Landmark} action={<Link to="/treasuries" className="text-xs text-brand-600 hover:underline dark:text-brand-300">كل الخزائن</Link>} />
            {!roots.length && <EmptyState title="لا توجد خزائن بعد" />}
            <div className="space-y-4">
              {roots.map((root) => {
                const kids = data.treasuries.filter((t) => t.parent_id === root.treasury_id)
                const total = Number(root.balance) + sum(kids.map((k) => k.balance))
                return (
                  <div key={root.treasury_id}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {root.name} <Badge tone="brand">{domainLabels[root.domain!]}</Badge>
                      </span>
                      <Money value={total} className="font-display font-semibold" />
                    </div>
                    {[root, ...kids].map((t) => (
                      <div key={t.treasury_id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-1 text-[13px]">
                        <span className="truncate text-muted">{t.treasury_id === root.treasury_id ? 'الخزينة الرئيسية' : t.name}</span>
                        <Money value={t.balance} />
                        <ProgressBar value={Math.abs(Number(t.balance))} max={maxAbs} tone={Number(t.balance) < 0 ? 'red' : 'brand'} className="col-span-2 mt-1" label={t.name ?? ''} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Card>
        )}
        <Card className={finance ? 'xl:col-span-3' : 'xl:col-span-5'}>
          <CardHeader title="المشاريع القائمة" icon={Building2} />
          {!data.projects.length ? (
            <EmptyState icon={Building2} title="لا توجد مشاريع قائمة" />
          ) : (
            <ul className="divide-y divide-line">
              {data.projects.map((p) => {
                const obligation = Number(p.client_obligation)
                const collected = Number(p.collected)
                return (
                  <li key={p.project_id}>
                    <Link to={`/projects/${p.project_id}`} className="-mx-2 block rounded-lg px-2 py-3 hover:bg-surface-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <Badge tone={projectStatusTone[p.status!]} dot>
                          {projectStatusLabels[p.status!]}
                        </Badge>
                        <span className="text-xs text-muted">{projectTypeLabels[p.project_type!]}</span>
                      </div>
                      {finance && (
                        <>
                          <ProgressBar value={collected} max={obligation || collected || 1} tone={collected > obligation ? 'sand' : 'brand'} className="mt-2.5" label="نسبة التحصيل" />
                          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted">
                            <span>
                              المحصّل <Money value={collected} className="text-ink" /> من <Money value={obligation} className="text-ink" />
                            </span>
                            <span>
                              {Number(p.client_remaining) < 0 ? 'زيادة مدفوعة ' : 'المتبقي '}
                              <span className={cn('num font-medium', Number(p.client_remaining) < 0 ? 'text-sand-600' : 'text-ink')}>{formatMoney(Math.abs(Number(p.client_remaining)))}</span>
                            </span>
                          </div>
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
