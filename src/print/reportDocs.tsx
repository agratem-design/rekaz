import { Money } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatDate, formatMoney } from '@/lib/format'
import { projectStatusLabels, projectTypeLabels } from '@/lib/labels'
import { InfoGrid, PrintDocument, PrintSection, PrintTable, Signatures } from './PrintDocument'
import type { Loader } from './financeDocs'

// تقارير المرحلة (هـ): كل الأرقام من العروض في قاعدة البيانات
async function q<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p
  if (error) throw error
  return data as NonNullable<T>
}
const today = () => formatDate(new Date().toISOString())
const n = (v: unknown) => Number(v ?? 0)

export const reportLoaders: Record<string, Loader> = {
  // ───────────── الملخص المالي العام ─────────────
  async 'financial-summary'() {
    const [t, c, s, tech, cu, pay, adv] = await Promise.all([
      q(supabase.from('treasury_balances').select('*').order('name')),
      q(supabase.from('client_balances').select('*')),
      q(supabase.from('supplier_balances').select('*')),
      q(supabase.from('technician_balances').select('*')),
      q(supabase.from('custody_balances').select('*').eq('is_closed', false)),
      q(supabase.from('payroll_balances').select('remaining').eq('status', 'posted')),
      q(supabase.from('employee_advance_balances').select('remaining')),
    ])
    const cash = t.reduce((a, x) => a + n(x.balance), 0)
    const receivable = c.reduce((a, x) => a + n(x.total_due), 0)
    const credits = c.reduce((a, x) => a + n(x.available_credit) + n(x.total_overpaid_on_projects), 0)
    const supDue = s.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0)
    const techDue = tech.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0)
    const custody = cu.reduce((a, x) => a + n(x.remaining), 0)
    const payrollDue = pay.reduce((a, x) => a + n(x.remaining), 0)
    const advances = adv.reduce((a, x) => a + n(x.remaining), 0)
    return {
      title: 'الملخص المالي العام',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="الملخص المالي العام" date={today()}>
          <PrintSection title="أرصدة الخزائن">
            <PrintTable
              columns={[
                { label: 'الخزينة / الحساب', render: (x) => x.name },
                { label: 'الرصيد', align: 'end', width: '40mm', render: (x) => <span className="num">{formatMoney(x.balance)}</span> },
              ]}
              rows={t}
              totals={[{ label: 'إجمالي النقدية', value: formatMoney(cash) }]}
            />
          </PrintSection>
          <PrintSection title="المركز المالي المختصر">
            <PrintTable
              columns={[
                { label: 'البند', render: (r: [string, number]) => r[0] },
                { label: 'المبلغ', align: 'end', width: '40mm', render: (r) => <span className="num">{formatMoney(r[1])}</span> },
              ]}
              rows={[
                ['النقدية في الخزائن', cash],
                ['مستحق على الزبائن', receivable],
                ['عهد مفتوحة لدى الموظفين والمهندسين', custody],
                ['سلف لدى الموظفين', advances],
                ['مستحق للموردين', -supDue],
                ['مستحق للفنيين', -techDue],
                ['رواتب معتمدة غير مصروفة', -payrollDue],
                ['أرصدة دائنة وزيادات للزبائن', -credits],
              ]}
              totals={[{ label: 'الصافي', value: formatMoney(cash + receivable + custody + advances - supDue - techDue - payrollDue - credits) }]}
            />
          </PrintSection>
          <Signatures items={[{ label: 'المدير', name: company.signee_name ?? undefined }]} />
        </PrintDocument>
      ),
    }
  },

  // ───────────── ربحية المشاريع ─────────────
  async 'projects-report'(_id, params) {
    const type = params.get('type')
    let rq = supabase.from('project_financials').select('*').order('name')
    if (type === 'contracting' || type === 'finishing') rq = rq.eq('project_type', type)
    const rows = await q(rq)
    const sum = (k: 'client_obligation' | 'collected' | 'direct_cost' | 'net_contract_value') => rows.reduce((a, x) => a + (k === 'net_contract_value' ? n(x.client_obligation) - n(x.direct_cost) : n(x[k])), 0)
    return {
      title: 'تقرير المشاريع',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="تقرير المشاريع المالي" date={today()} subtitle={type ? `مشاريع ${projectTypeLabels[type as 'contracting']}` : 'كل المشاريع'}>
          <PrintTable
            columns={[
              { label: 'المشروع', render: (x) => x.name },
              { label: 'النوع', width: '18mm', render: (x) => projectTypeLabels[x.project_type!] },
              { label: 'الحالة', width: '18mm', render: (x) => projectStatusLabels[x.status!] },
              { label: 'الالتزام', align: 'end', render: (x) => <span className="num">{formatMoney(x.client_obligation)}</span> },
              { label: 'المحصّل', align: 'end', render: (x) => <span className="num">{formatMoney(x.collected)}</span> },
              { label: 'التكلفة المباشرة', align: 'end', render: (x) => <span className="num">{formatMoney(x.direct_cost)}</span> },
              { label: 'القيمة بعد التكاليف', align: 'end', render: (x) => <span className="num">{formatMoney(n(x.client_obligation) - n(x.direct_cost))}</span> },
            ]}
            rows={rows}
            totals={[
              { label: 'إجمالي الالتزام', value: formatMoney(sum('client_obligation')) },
              { label: 'إجمالي المحصّل', value: formatMoney(sum('collected')) },
              { label: 'إجمالي التكلفة المباشرة', value: formatMoney(sum('direct_cost')) },
              { label: 'إجمالي القيمة بعد التكاليف', value: formatMoney(sum('net_contract_value')) },
            ]}
          />
        </PrintDocument>
      ),
    }
  },

  // ───────────── ذمم الموردين ─────────────
  async 'suppliers-report'() {
    const rows = (await q(supabase.from('supplier_balances').select('*').order('name'))).filter((x) => n(x.invoiced) || n(x.paid))
    return {
      title: 'ذمم الموردين',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="كشف ذمم الموردين" date={today()}>
          <PrintTable
            columns={[
              { label: 'م', width: '9mm', align: 'center', render: (_x, i) => <span className="num">{i + 1}</span> },
              { label: 'المورد', render: (x) => x.name },
              { label: 'الفواتير', align: 'end', render: (x) => <span className="num">{formatMoney(n(x.invoiced) - n(x.returned))}</span> },
              { label: 'المدفوع', align: 'end', render: (x) => <span className="num">{formatMoney(x.paid)}</span> },
              { label: 'مقدم غير موزع', align: 'end', render: (x) => <span className="num">{formatMoney(x.unallocated_advance)}</span> },
              { label: 'المستحق', align: 'end', render: (x) => <span className="num">{formatMoney(x.balance_due)}</span> },
            ]}
            rows={rows}
            totals={[{ label: 'إجمالي المستحق للموردين', value: formatMoney(rows.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0)) }]}
          />
        </PrintDocument>
      ),
    }
  },

  // ───────────── مستحقات الفنيين ─────────────
  async 'technicians-report'() {
    const rows = (await q(supabase.from('technician_balances').select('*').order('name'))).filter((x) => n(x.earned) || n(x.paid))
    return {
      title: 'مستحقات الفنيين',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="تقرير مستحقات الفنيين" date={today()}>
          <PrintTable
            columns={[
              { label: 'م', width: '9mm', align: 'center', render: (_x, i) => <span className="num">{i + 1}</span> },
              { label: 'الفني', render: (x) => x.name },
              { label: 'المستحق من الأعمال', align: 'end', render: (x) => <span className="num">{formatMoney(x.earned)}</span> },
              { label: 'المدفوع', align: 'end', render: (x) => <span className="num">{formatMoney(x.paid)}</span> },
              { label: 'المستلم منه', align: 'end', render: (x) => <span className="num">{formatMoney(x.received_back)}</span> },
              { label: 'المتبقي له', align: 'end', render: (x) => <span className="num">{formatMoney(x.balance_due)}</span> },
            ]}
            rows={rows}
            totals={[{ label: 'إجمالي المستحق للفنيين', value: formatMoney(rows.reduce((a, x) => a + Math.max(n(x.balance_due), 0), 0)) }]}
          />
        </PrintDocument>
      ),
    }
  },

  // ───────────── كشف مصروفات المشاريع ─────────────
  async 'expenses-report'(_id, params) {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    let rq = supabase.from('expenses').select('*, projects(name), expense_categories(name)').eq('status', 'posted').order('expense_date')
    if (from) rq = rq.gte('expense_date', from)
    if (to) rq = rq.lte('expense_date', to)
    const rows = await q(rq)
    const byProject = new Map<string, { name: string; total: number }>()
    for (const e of rows) {
      const k = e.project_id ?? 'general'
      const cur = byProject.get(k) ?? { name: e.projects?.name ?? 'مصروفات عامة', total: 0 }
      cur.total += n(e.amount)
      byProject.set(k, cur)
    }
    const period = from || to ? `${from ? `من ${formatDate(from)} ` : ''}${to ? `إلى ${formatDate(to)}` : ''}` : 'كل الفترات'
    return {
      title: 'كشف المصروفات',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="كشف المصروفات" date={today()} subtitle={period}>
          <PrintSection title="حسب المشروع">
            <PrintTable
              columns={[
                { label: 'المشروع', render: (x: { name: string; total: number }) => x.name },
                { label: 'المجموع', align: 'end', width: '40mm', render: (x) => <span className="num">{formatMoney(x.total)}</span> },
              ]}
              rows={[...byProject.values()]}
              totals={[{ label: 'الإجمالي', value: formatMoney(rows.reduce((a, e) => a + n(e.amount), 0)) }]}
            />
          </PrintSection>
          <PrintSection title="التفاصيل">
            <PrintTable
              columns={[
                { label: 'التاريخ', width: '22mm', render: (e) => <span className="num">{formatDate(e.expense_date)}</span> },
                { label: 'البيان', render: (e) => e.description },
                { label: 'الفئة', width: '26mm', render: (e) => e.expense_categories?.name ?? '—' },
                { label: 'المشروع', width: '38mm', render: (e) => e.projects?.name ?? 'عام' },
                { label: 'المبلغ', align: 'end', width: '26mm', render: (e) => <span className="num">{formatMoney(e.amount)}</span> },
              ]}
              rows={rows}
            />
          </PrintSection>
        </PrintDocument>
      ),
    }
  },

  // ───────────── ديون وذمم الزبائن (المستحقة فقط) ─────────────
  async 'debts-report'() {
    const [b, f] = await Promise.all([q(supabase.from('client_balances').select('*').order('name')), q(supabase.from('project_financials').select('name, client_id, client_obligation, collected, client_remaining'))])
    const rows = b.filter((x) => n(x.total_due) > 0)
    return {
      title: 'ديون وذمم الزبائن',
      render: (company, st) => (
        <PrintDocument company={company} settings={st} title="كشف ديون وذمم الزبائن" date={today()} subtitle={`${rows.length} زبون عليه مستحقات`}>
          {rows.map((c) => (
            <PrintSection key={c.client_id} title={c.name ?? ''}>
              <PrintTable
                columns={[
                  { label: 'المشروع', render: (p) => p.name },
                  { label: 'الالتزام', align: 'end', render: (p) => <span className="num">{formatMoney(p.client_obligation)}</span> },
                  { label: 'المحصّل', align: 'end', render: (p) => <span className="num">{formatMoney(p.collected)}</span> },
                  { label: 'المتبقي', align: 'end', render: (p) => <span className="num">{formatMoney(p.client_remaining)}</span> },
                ]}
                rows={f.filter((p) => p.client_id === c.client_id && n(p.client_remaining) > 0)}
                totals={[{ label: 'المستحق على الزبون', value: formatMoney(c.total_due) }]}
              />
            </PrintSection>
          ))}
          <InfoGrid items={[{ label: 'إجمالي الذمم المستحقة', value: <Money value={rows.reduce((a, x) => a + n(x.total_due), 0)} />, wide: true }]} />
        </PrintDocument>
      ),
    }
  },
}
