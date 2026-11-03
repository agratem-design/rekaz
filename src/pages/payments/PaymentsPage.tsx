import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Briefcase, CircleDollarSign, HandCoins, Plus, Printer, ReceiptText, Truck, Wrench } from 'lucide-react'
import { BusinessForm } from '@/components/BusinessForm'
import { DataTable, RecordCount } from '@/components/DataTable'
import { AmountCell } from '@/components/pickers'
import { Badge, Button, EmptyState, Field, FilterChips, Input, Money, PageHeader, SearchInput, Select, StatCard, Tabs } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { openPrint, sourcePrintKind } from '@/print/open'
import { payrollPaymentDialog } from '../business/payrollDialogs'
import { SupplierPaymentForm } from '../suppliers/SupplierPaymentForm'
import { TechCashForm } from '../technicians/TechForms'
import { sourceLabels } from '../TreasuriesPage'
import { PaymentChooser } from './PaymentChooser'
import { useOutflows, usePayables, useSupplierDues, type Payable, type PayableKind } from './paymentsData'

const kindLabels: Record<PayableKind, string> = { supplier: 'مورد', technician: 'فني / عامل', payroll: 'راتب' }
const kindTone = { supplier: 'blue', technician: 'brand', payroll: 'sand' } as const

// الصرف والتسديد: ما هو مستحق على الشركة، وما خرج فعلاً من الخزائن، ومدخل واحد لكل عملية صرف
export function PaymentsPage() {
  const [tab, setTab] = useState('payables')
  const [choosing, setChoosing] = useState(false)
  const payables = usePayables()
  const dues = useSupplierDues()
  const outflows = useOutflows()
  const sum = (kind: PayableKind) => payables.rows.filter((r) => r.kind === kind).reduce((a, r) => a + r.amount, 0)
  const supplierDue = [...(dues.data?.values() ?? [])].reduce((a, v) => a + Math.max(v, 0), 0)
  const month = todayISO().slice(0, 7)
  // التحويل ينقل المال بين الخزائن ولا يخرجه من الشركة
  const paidThisMonth = (outflows.data ?? []).filter((o) => !o.reversed && o.sourceType !== 'transfer' && o.date.startsWith(month)).reduce((a, o) => a + o.amount, 0)
  return (
    <div>
      <PageHeader
        title="الصرف والتسديد"
        description="كل ما هو مستحق على الشركة وكل ما خرج من الخزائن في مكان واحد"
        actions={
          <Button onClick={() => setChoosing(true)}>
            <Plus className="size-4" />
            صرف من الخزينة
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={Truck} label="مستحق للموردين" value={<Money value={supplierDue} />} tone="red" />
        <StatCard icon={Wrench} label="مستحق للفنيين" value={<Money value={sum('technician')} />} tone="red" />
        <StatCard icon={Briefcase} label="رواتب غير مصروفة" value={<Money value={sum('payroll')} />} tone="sand" />
        <StatCard icon={Banknote} label="صُرف هذا الشهر" value={<Money value={paidThisMonth} />} tone="blue" hint="بدون التحويلات بين الخزائن" />
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'payables', label: 'المستحقات', icon: CircleDollarSign },
          { key: 'outflows', label: 'سجل الصرف', icon: ReceiptText },
        ]}
      />
      <div className="mt-4">{tab === 'payables' ? <PayablesTable payables={payables} /> : <OutflowsTable outflows={outflows} />}</div>
      <PaymentChooser open={choosing} onClose={() => setChoosing(false)} />
    </div>
  )
}

function PayablesTable({ payables }: { payables: ReturnType<typeof usePayables> }) {
  const [paying, setPaying] = useState<Payable | null>(null)
  const [kind, setKind] = useState<'all' | PayableKind>('all')
  const [search, setSearch] = useState('')
  const q = search.trim()
  const shown = payables.rows.filter((r) => (kind === 'all' || r.kind === kind) && (!q || r.party.includes(q) || r.title.includes(q) || (r.project ?? '').includes(q)))
  const count = (k: PayableKind) => payables.rows.filter((r) => r.kind === k).length
  return (
    <>
      <DataTable
        rows={shown}
        getKey={(r) => r.key}
        loading={payables.isLoading}
        error={payables.error ? errorMessage(payables.error) : null}
        onRetry={payables.refetch}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالجهة أو البيان أو المشروع…" />
            <FilterChips
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'الكل', count: payables.rows.length },
                { value: 'supplier', label: 'موردون', count: count('supplier') },
                { value: 'technician', label: 'فنيون', count: count('technician') },
                { value: 'payroll', label: 'رواتب', count: count('payroll') },
              ]}
            />
            <div className="ms-auto flex items-center gap-3 text-xs text-muted">
              <span>
                مجموع المعروض <Money value={shown.reduce((a, r) => a + r.amount, 0)} className="font-semibold text-ink" />
              </span>
              <RecordCount shown={shown.length} total={payables.rows.length} />
            </div>
          </>
        }
        empty={
          <EmptyState icon={HandCoins} title={q || kind !== 'all' ? 'لا توجد مستحقات مطابقة' : 'لا توجد مستحقات غير مسددة'}>
            {!q && kind === 'all' && 'الفواتير وأعمال الفنيين والرواتب المعتمدة تظهر هنا حتى تُسدَّد.'}
          </EmptyState>
        }
        columns={[
          { key: 'kind', label: 'النوع', hideBelow: 'sm', render: (r) => <Badge tone={kindTone[r.kind]}>{kindLabels[r.kind]}</Badge> },
          {
            key: 'party',
            label: 'الجهة',
            render: (r) => (
              <div>
                {r.to ? (
                  <Link to={r.to} className="font-medium hover:underline">
                    {r.party}
                  </Link>
                ) : (
                  <span className="font-medium">{r.party}</span>
                )}
                <div className="text-xs text-muted sm:hidden">{r.title}</div>
              </div>
            ),
          },
          {
            key: 'title',
            label: 'البيان',
            hideBelow: 'sm',
            render: (r) => (
              <div>
                <div>{r.title}</div>
                {r.note && <div className="text-xs text-sand-600">{r.note}</div>}
              </div>
            ),
          },
          { key: 'project', label: 'المشروع', hideBelow: 'md', render: (r) => r.project ?? <span className="text-faint">—</span> },
          { key: 'date', label: 'التاريخ', hideBelow: 'lg', render: (r) => (r.date ? <span className="num whitespace-nowrap text-muted">{formatDate(r.date)}</span> : <span className="text-faint">—</span>) },
          { key: 'amount', label: 'المستحق', align: 'end', render: (r) => <Money value={r.amount} className="font-semibold text-red-700 dark:text-red-400" /> },
        ]}
        rowActions={(r) => (
          <Button size="sm" onClick={() => setPaying(r)}>
            تسديد
          </Button>
        )}
      />
      <SupplierPaymentForm open={paying?.kind === 'supplier'} supplierId={paying?.kind === 'supplier' ? paying.partyId : undefined} purchaseId={paying?.purchaseId} onClose={() => setPaying(null)} />
      <TechCashForm open={paying?.kind === 'technician'} direction="pay" technicianId={paying?.kind === 'technician' ? paying.partyId : undefined} defaultAmount={paying?.kind === 'technician' ? paying.amount : undefined} onClose={() => setPaying(null)} />
      {paying?.kind === 'payroll' && <BusinessForm key={paying.partyId} {...payrollPaymentDialog({ id: paying.partyId, remaining: paying.amount })} printKind="payroll-payment" onClose={() => setPaying(null)} />}
    </>
  )
}

const typeFilters = [
  { value: 'all', label: 'الكل', sources: [] as string[] },
  { value: 'supplier', label: 'موردون', sources: ['supplier_payment'] },
  { value: 'technician', label: 'فنيون', sources: ['technician_payment'] },
  { value: 'staff', label: 'رواتب وسلف', sources: ['payroll_slip', 'employee_advance'] },
  { value: 'expense', label: 'مصروفات', sources: ['expense'] },
  { value: 'custody', label: 'عهد', sources: ['custody_issue'] },
  { value: 'transfer', label: 'تحويلات', sources: ['transfer'] },
] as const
type TypeFilter = (typeof typeFilters)[number]['value']

function OutflowsTable({ outflows }: { outflows: ReturnType<typeof useOutflows> }) {
  const [type, setType] = useState<TypeFilter>('all')
  const [treasury, setTreasury] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const all = outflows.data ?? []
  const sources: readonly string[] = typeFilters.find((t) => t.value === type)!.sources
  const q = search.trim()
  const shown = all.filter((o) => (type === 'all' || sources.includes(o.sourceType)) && (!treasury || o.treasuryId === treasury) && (!from || o.date >= from) && (!to || o.date <= to) && (!q || o.party.includes(q) || (o.detail ?? '').includes(q)))
  const treasuries = [...new Map(all.map((o) => [o.treasuryId, o.treasury])).entries()]
  return (
    <DataTable
      rows={shown}
      getKey={(o) => o.id}
      loading={outflows.isLoading}
      error={outflows.error ? errorMessage(outflows.error) : null}
      onRetry={() => outflows.refetch()}
      rowClassName={(o) => o.reversed && 'text-faint line-through decoration-faint/50'}
      toolbar={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالمستلم أو البيان…" />
          <FilterChips value={type} onChange={setType} options={typeFilters.map((t) => ({ value: t.value, label: t.label }))} />
          <Field label="الخزينة">
            <Select value={treasury} onChange={(e) => setTreasury(e.target.value)} className="h-8">
              <option value="">كل الخزائن</option>
              {treasuries.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="من تاريخ">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </Field>
          <span className="ms-auto text-xs text-muted">
            مجموع المعروض <Money value={shown.filter((o) => !o.reversed).reduce((a, o) => a + o.amount, 0)} className="font-semibold text-ink" />
          </span>
        </>
      }
      empty={<EmptyState icon={ReceiptText} title={all.length ? 'لا توجد حركات مطابقة' : 'لم يخرج أي مبلغ من الخزائن بعد'} />}
      columns={[
        { key: 'date', label: 'التاريخ', render: (o) => <span className="num whitespace-nowrap text-muted">{formatDate(o.date)}</span> },
        { key: 'type', label: 'نوع الصرف', hideBelow: 'sm', render: (o) => sourceLabels[o.sourceType] ?? o.sourceType },
        {
          key: 'party',
          label: 'المستلم / البيان',
          render: (o) => (
            <div>
              {o.to ? (
                <Link to={o.to} className="font-medium hover:underline">
                  {o.party}
                </Link>
              ) : (
                <span className="font-medium">{o.party}</span>
              )}
              {o.detail && <div className="text-xs text-muted">{o.detail}</div>}
            </div>
          ),
        },
        { key: 'treasury', label: 'الخزينة', hideBelow: 'md', render: (o) => <span className="text-muted">{o.treasury}</span> },
        { key: 'amount', label: 'المبلغ', align: 'end', render: (o) => <AmountCell value={o.amount} reversed={o.reversed} /> },
      ]}
      rowActions={(o) =>
        sourcePrintKind[o.sourceType] && (
          <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة السند" title="طباعة السند" onClick={() => openPrint(sourcePrintKind[o.sourceType], o.sourceId)}>
            <Printer className="size-4" />
          </Button>
        )
      }
    />
  )
}
