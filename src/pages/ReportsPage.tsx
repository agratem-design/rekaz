import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Coins, FileBarChart, Landmark, Printer, Truck, Users, Wrench, type LucideIcon } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { Badge, Button, Card, Field, FilterChips, Input, Money, PageHeader, Tabs, cn } from '@/components/ui'
import { projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'

const n = (v: unknown) => Number(v ?? 0)

// التقارير: كل رقم من العروض في القاعدة، وكل تقرير قابل للطباعة على قالب الطباعة الموحد
export function ReportsPage() {
  const [tab, setTab] = useState('hub')
  const data = useQuery({
    queryKey: ['reports', 'hub'],
    queryFn: async () => {
      const [t, c, s, tech, p, e] = await Promise.all([
        supabase.from('treasury_balances').select('balance'),
        supabase.from('client_balances').select('total_due'),
        supabase.from('supplier_balances').select('balance_due'),
        supabase.from('technician_balances').select('balance_due'),
        supabase.from('project_financials').select('*').order('name'),
        supabase.from('expenses').select('amount, project_id').eq('status', 'posted'),
      ])
      for (const r of [t, c, s, tech, p, e]) if (r.error) throw r.error
      return {
        cash: t.data!.reduce((a, x) => a + n(x.balance), 0),
        receivable: c.data!.reduce((a, x) => a + n(x.total_due), 0),
        debtors: c.data!.filter((x) => n(x.total_due) > 0).length,
        supDue: s.data!.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0),
        techDue: tech.data!.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0),
        projects: p.data!,
        expenses: e.data!.reduce((a, x) => a + n(x.amount), 0),
      }
    },
  })
  const d = data.data

  return (
    <div>
      <PageHeader title="التقارير" description="تقارير مالية وتشغيلية من مصدر واحد، جاهزة للطباعة" />
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'hub', label: 'كل التقارير', icon: FileBarChart },
          { key: 'projects', label: 'ربحية المشاريع', icon: Building2 },
          { key: 'expenses', label: 'كشف المصروفات', icon: Coins },
        ]}
      />
      <div className="mt-5">
        {data.error && <p className="text-sm text-red-600">{errorMessage(data.error)}</p>}
        {tab === 'hub' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReportCard icon={Landmark} title="الملخص المالي العام" desc="أرصدة الخزائن والمركز المالي المختصر: النقدية والذمم والمستحقات" figure={d && <Money value={d.cash} />} figureLabel="النقدية" kind="financial-summary" link="/treasuries" />
            <ReportCard icon={Building2} title="تقرير المشاريع المالي" desc="الالتزام والمحصّل والتكلفة المباشرة والقيمة بعد التكاليف لكل مشروع" figure={d && <span className="num">{d.projects.length}</span>} figureLabel="مشروع" kind="projects-report" onView={() => setTab('projects')} />
            <ReportCard icon={Users} title="ديون وذمم الزبائن" desc="الزبائن الذين عليهم مستحقات، مفصّلة لكل مشروع" figure={d && <Money value={d.receivable} />} figureLabel={d ? `${d.debtors} زبون` : ''} kind="debts-report" link="/clients" />
            <ReportCard icon={Users} title="كشف الزبائن الإجمالي" desc="كل الزبائن: إجمالي الأعمال والمسدد والمتبقي والرصيد الدائن" kind="clients-statement" link="/clients" />
            <ReportCard icon={Truck} title="ذمم الموردين" desc="الفواتير والمدفوع والمقدم والمستحق لكل مورد" figure={d && <Money value={d.supDue} />} figureLabel="مستحق" kind="suppliers-report" link="/suppliers" />
            <ReportCard icon={Wrench} title="مستحقات الفنيين" desc="المستحق من الأعمال والمدفوع والمتبقي لكل فني" figure={d && <Money value={d.techDue} />} figureLabel="مستحق" kind="technicians-report" link="/technicians" />
            <ReportCard icon={Coins} title="كشف المصروفات" desc="مصروفات المشاريع والمصروفات العامة حسب المشروع والفترة" figure={d && <Money value={d.expenses} />} figureLabel="الإجمالي" kind="expenses-report" onView={() => setTab('expenses')} />
          </div>
        )}
        {tab === 'projects' && <ProjectsReport rows={d?.projects} loading={data.isLoading} />}
        {tab === 'expenses' && <ExpensesReport />}
      </div>
    </div>
  )
}

function ReportCard({ icon: Icon, title, desc, figure, figureLabel, kind, link, onView }: { icon: LucideIcon; title: string; desc: string; figure?: React.ReactNode; figureLabel?: string; kind: string; link?: string; onView?: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/60 dark:text-sand-300">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{desc}</p>
        </div>
      </div>
      {figure && (
        <div className="flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-xs text-muted">{figureLabel}</span>
          <span className="font-display text-lg font-semibold">{figure}</span>
        </div>
      )}
      <div className="mt-auto flex gap-2">
        <Button size="sm" onClick={() => openPrint(kind, 'all')}>
          <Printer className="size-3.5" />
          طباعة
        </Button>
        {onView && (
          <Button size="sm" variant="secondary" onClick={onView}>
            عرض
          </Button>
        )}
        {link && !onView && (
          <Link to={link}>
            <Button size="sm" variant="secondary">
              فتح الشاشة
            </Button>
          </Link>
        )}
      </div>
    </Card>
  )
}

type PRow = { project_id: string | null; name: string | null; project_type: 'contracting' | 'finishing' | null; status: string | null; client_obligation: number | null; collected: number | null; direct_cost: number | null; gross_profit_to_date: number | null; client_remaining: number | null }

function ProjectsReport({ rows, loading }: { rows?: PRow[]; loading: boolean }) {
  const [type, setType] = useState<'all' | 'contracting' | 'finishing'>('all')
  const shown = (rows ?? []).filter((r) => type === 'all' || r.project_type === type)
  const sum = (k: keyof PRow) => shown.reduce((a, r) => a + n(r[k]), 0)
  return (
    <DataTable
      rows={shown}
      getKey={(r) => r.project_id!}
      loading={loading}
      toolbar={
        <>
          <FilterChips
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'الكل' },
              { value: 'contracting', label: 'مقاولات' },
              { value: 'finishing', label: 'تشطيبات' },
            ]}
          />
          <Button size="sm" variant="secondary" className="ms-auto" onClick={() => openPrint('projects-report', 'all', false, type === 'all' ? undefined : { type })}>
            <Printer className="size-3.5" />
            طباعة
          </Button>
        </>
      }
      columns={[
        { key: 'name', label: 'المشروع', render: (r) => <Link to={`/projects/${r.project_id}`} className="font-medium hover:underline">{r.name}</Link> },
        { key: 'type', label: 'النوع', hideBelow: 'md', render: (r) => projectTypeLabels[r.project_type!] },
        { key: 'status', label: 'الحالة', hideBelow: 'md', render: (r) => <Badge tone={projectStatusTone[r.status as keyof typeof projectStatusTone]}>{projectStatusLabels[r.status as keyof typeof projectStatusLabels]}</Badge> },
        { key: 'ob', label: 'الالتزام', align: 'end', render: (r) => <Money value={r.client_obligation} /> },
        { key: 'col', label: 'المحصّل', align: 'end', hideBelow: 'sm', render: (r) => <Money value={r.collected} /> },
        { key: 'cost', label: 'التكلفة المباشرة', align: 'end', hideBelow: 'sm', render: (r) => <Money value={r.direct_cost} /> },
        { key: 'profit', label: 'القيمة بعد التكاليف', align: 'end', render: (r) => <Money value={n(r.client_obligation) - n(r.direct_cost)} className={cn('font-semibold', n(r.client_obligation) - n(r.direct_cost) >= 0 && 'text-olive-700 dark:text-olive-300')} /> },
      ]}
      footer={
        shown.length > 0 && (
          <tr>
            <td className="px-4 py-2.5">الإجمالي</td>
            <td className="hidden md:table-cell" colSpan={2} />
            <td className="px-4 py-2.5 text-left">
              <Money value={sum('client_obligation')} />
            </td>
            <td className="hidden px-4 py-2.5 text-left sm:table-cell">
              <Money value={sum('collected')} />
            </td>
            <td className="hidden px-4 py-2.5 text-left sm:table-cell">
              <Money value={sum('direct_cost')} />
            </td>
            <td className="px-4 py-2.5 text-left">
              <Money value={sum('client_obligation') - sum('direct_cost')} />
            </td>
          </tr>
        )
      }
    />
  )
}

function ExpensesReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'expenses', from, to],
    queryFn: async () => {
      let rq = supabase.from('expenses').select('amount, project_id, projects(name), expense_categories(name)').eq('status', 'posted')
      if (from) rq = rq.gte('expense_date', from)
      if (to) rq = rq.lte('expense_date', to)
      const { data, error } = await rq
      if (error) throw error
      const byProject = new Map<string, { key: string; name: string; total: number; count: number }>()
      for (const e of data) {
        const k = e.project_id ?? 'general'
        const cur = byProject.get(k) ?? { key: k, name: e.projects?.name ?? 'مصروفات عامة', total: 0, count: 0 }
        cur.total += n(e.amount)
        cur.count++
        byProject.set(k, cur)
      }
      return [...byProject.values()].sort((a, b) => b.total - a.total)
    },
  })
  const total = (data ?? []).reduce((a, r) => a + r.total, 0)
  return (
    <DataTable
      rows={data}
      getKey={(r) => r.key}
      loading={isLoading}
      toolbar={
        <>
          <Field label="من تاريخ">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </Field>
          <span className="ms-auto text-sm text-muted">
            الإجمالي <Money value={total} className="font-semibold text-ink" />
          </span>
          <Button size="sm" variant="secondary" onClick={() => openPrint('expenses-report', 'all', false, { ...(from && { from }), ...(to && { to }) })}>
            <Printer className="size-3.5" />
            طباعة
          </Button>
        </>
      }
      columns={[
        { key: 'name', label: 'المشروع', render: (r) => (r.key === 'general' ? <span className="font-medium">مصروفات عامة</span> : <Link to={`/projects/${r.key}/expenses`} className="font-medium hover:underline">{r.name}</Link>) },
        { key: 'count', label: 'عدد المصروفات', render: (r) => <span className="num">{r.count}</span> },
        { key: 'total', label: 'المجموع', align: 'end', render: (r) => <Money value={r.total} className="font-semibold" /> },
      ]}
    />
  )
}
