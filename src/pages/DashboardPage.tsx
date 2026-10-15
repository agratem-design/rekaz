import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Landmark, Truck, Users, Wrench } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Card, ErrorState, Money, PageHeader, Spinner } from '@/components/ui'
import { domainLabels, projectStatusLabels, projectTypeLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + Number(b ?? 0), 0)

async function load(finance: boolean) {
  const [projects, staffing, treasuries, clients, suppliers, techs, custodies] = await Promise.all([
    supabase.from('project_financials').select('*').in('status', ['planned', 'active', 'on_hold']).order('name'),
    supabase.from('project_item_staffing').select('missing_count').gt('missing_count', 0),
    finance ? supabase.from('treasury_balances').select('*').order('name') : null,
    finance ? supabase.from('client_balances').select('total_due, total_overpaid_on_projects') : null,
    finance ? supabase.from('supplier_balances').select('balance_due, unallocated_advance') : null,
    supabase.from('technician_balances').select('balance_due'),
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
    techDue: sum((techs.data ?? []).map((t) => Math.max(Number(t.balance_due), 0))),
    openCustodies: custodies?.data?.length ?? 0,
  }
}

export function DashboardPage() {
  const { hasRole, profile } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard', finance], queryFn: () => load(finance) })

  if (isLoading) return <Spinner />
  if (error || !data) return <ErrorState message={errorMessage(error)} />

  const roots = data.treasuries.filter((t) => !t.parent_id)
  const negative = data.treasuries.filter((t) => Number(t.balance) < 0)
  const alerts: ReactNode[] = []
  if (negative.length) alerts.push(<>خزائن برصيد سالب: {negative.map((t) => t.name).join('، ')}</>)
  if (data.clientOverpaid > 0) alerts.push(<>زبائن دفعوا أكثر من التزامهم على مشاريع بمجموع <Money value={data.clientOverpaid} /> د.ل</>)
  if (data.understaffed > 0) alerts.push(<>{data.understaffed} تخصص في بنود المشاريع خطة العمالة فيه ناقصة</>)
  if (data.openCustodies > 0) alerts.push(<>{data.openCustodies} عهدة مفتوحة</>)

  return (
    <div className="space-y-6">
      <PageHeader title={`أهلاً ${profile?.display_name ?? ''}`} description="ملخص الوضع الحالي من قاعدة البيانات مباشرة" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {finance && <Stat icon={Landmark} label="إجمالي الخزائن" value={<Money value={sum(data.treasuries.map((t) => t.balance))} />} to="/treasuries" />}
        {finance && <Stat icon={Users} label="مستحق على الزبائن" value={<Money value={data.clientDue} />} to="/clients" />}
        {finance && <Stat icon={Truck} label="مستحق للموردين" value={<Money value={data.supplierDue} />} to="/suppliers" />}
        <Stat icon={Wrench} label="مستحق للفنيين" value={<Money value={data.techDue} />} to="/technicians" />
        <Stat icon={Building2} label="مشاريع قائمة" value={<span className="num">{data.projects.length}</span>} />
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4" />
            تنبيهات
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {alerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {finance && (
          <Card>
            <h2 className="mb-3 font-semibold">أرصدة الخزائن</h2>
            {roots.map((root) => (
              <div key={root.treasury_id} className="mb-3">
                <Row label={`${root.name} (${domainLabels[root.domain!]})`} value={root.balance} bold />
                {data.treasuries
                  .filter((t) => t.parent_id === root.treasury_id)
                  .map((t) => (
                    <Row key={t.treasury_id} label={t.name!} value={t.balance} indent />
                  ))}
              </div>
            ))}
          </Card>
        )}
        <Card>
          <h2 className="mb-3 font-semibold">المشاريع القائمة</h2>
          {!data.projects.length && <p className="text-sm text-stone-500">لا توجد مشاريع قائمة</p>}
          <table className="w-full text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="py-1 text-right font-medium">المشروع</th>
                <th className="py-1 text-right font-medium">النوع</th>
                {finance && <th className="py-1 text-left font-medium">المحصّل</th>}
                {finance && <th className="py-1 text-left font-medium">المتبقي على الزبون</th>}
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.project_id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="py-1.5">
                    {p.name} <span className="text-xs text-stone-500">({projectStatusLabels[p.status!]})</span>
                  </td>
                  <td>{projectTypeLabels[p.project_type!]}</td>
                  {finance && (
                    <td className="text-left">
                      <Money value={p.collected} />
                    </td>
                  )}
                  {finance && (
                    <td className="text-left">
                      <Money value={p.client_remaining} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, to }: { icon: typeof Landmark; label: string; value: ReactNode; to?: string }) {
  const body = (
    <Card className="flex items-center gap-3 transition hover:border-brand-500">
      <div className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-700/20 dark:text-brand-100">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-stone-500">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Row({ label, value, bold, indent }: { label: string; value: number | null; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'pr-4 text-stone-600 dark:text-stone-300' : ''}`}>
      <span>{label}</span>
      <Money value={value} />
    </div>
  )
}
