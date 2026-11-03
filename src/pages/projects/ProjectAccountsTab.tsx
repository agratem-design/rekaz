import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CircleDollarSign, HandCoins, Scale, Truck, Wallet, Wrench } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { useSuppliers, useTechnicians } from '@/components/pickers'
import { Button, Card, CardHeader, EmptyState, ErrorState, KeyValue, Money, StatCard, cn } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import type { ProjectDetail } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { useProjectCash, useSupplierProjects, useTechnicianProjects } from '../payments/settlementData'
import { SupplierPaymentForm } from '../suppliers/SupplierPaymentForm'
import { TechCashForm } from '../technicians/TechForms'

type Paying = { kind: 'supplier' | 'technician'; id?: string; amount?: number }

// حساب المشروع: ما دخل من زبونه، وما خرج لمورديه وفنييه، والتسديد من هنا مباشرة دون اختيار فاتورة أو بند
export function ProjectAccountsTab({ project, onReceipt }: { project: ProjectDetail; onReceipt: () => void }) {
  const cash = useProjectCash(project.id)
  const suppliers = useSupplierProjects({ projectId: project.id })
  const techs = useTechnicianProjects({ projectId: project.id })
  const supplierNames = useSuppliers()
  const techNames = useTechnicians()
  const [paying, setPaying] = useState<Paying | null>(null)
  const name = (list: { id: string; name: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.name ?? ''
  const failed = cash.error ?? suppliers.error ?? techs.error
  if (failed) return <ErrorState message={errorMessage(failed)} onRetry={() => [cash, suppliers, techs].forEach((q) => q.refetch())} />
  const c = cash.data
  const position = Number(c?.cash_position ?? 0)
  const remaining = Number(project.fin?.client_remaining ?? 0)
  const open = (kind: Paying['kind'], id: string | null, due: number) => setPaying({ kind, id: id ?? undefined, amount: due > 0 ? due : undefined })
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={Banknote} label="دخل من الزبون" value={<Money value={c?.received} />} tone="blue" hint={`متبقٍ عليه ${formatMoney(Math.max(remaining, 0))}`} />
        <StatCard icon={HandCoins} label="خرج على المشروع" value={<Money value={c?.total_paid} />} tone="sand" />
        <StatCard icon={Scale} label={position < 0 ? 'الشركة تموّل المشروع' : 'بيد الشركة من مال الزبون'} value={<Money value={Math.abs(position)} />} tone={position < 0 ? 'red' : 'blue'} hint="ما دخل ناقص ما خرج" />
        <StatCard icon={CircleDollarSign} label="مستحقات لم تُسدد" value={<Money value={c?.unpaid_dues} />} tone="red" hint="موردون وفنيون" />
      </div>

      <Card>
        <CardHeader title="موقف المقاول في هذا المشروع" icon={Wallet} description="قبض الزبون يدخل الخزينة، وصرف المشروع يخرج منها. لا يسدد أحدهما الآخر مباشرة." action={<Button size="sm" variant="soft" onClick={onReceipt}>تسجيل قبض من الزبون</Button>} />
        <KeyValue label="مدفوع للموردين"><Money value={c?.paid_suppliers} /></KeyValue>
        <KeyValue label="مدفوع للفنيين"><Money value={c?.paid_technicians} /></KeyValue>
        <KeyValue label="مصروفات المشروع"><Money value={c?.paid_expenses} /></KeyValue>
        {Number(c?.paid_payroll) > 0 && <KeyValue label="رواتب محملة على المشروع"><Money value={c?.paid_payroll} /></KeyValue>}
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><Truck className="size-4 text-muted" />الموردون في هذا المشروع</h3>
          <Button size="sm" variant="soft" onClick={() => setPaying({ kind: 'supplier' })}>دفعة لمورد</Button>
        </div>
        <DataTable
          rows={suppliers.data}
          getKey={(r) => r.supplier_id!}
          loading={suppliers.isLoading}
          empty={<EmptyState icon={Truck} title="لا توجد فواتير موردين على هذا المشروع" />}
          columns={[
            { key: 'name', label: 'المورد', render: (r) => <Link to={`/suppliers/${r.supplier_id}`} className="font-medium hover:underline">{name(supplierNames.data, r.supplier_id)}</Link> },
            { key: 'billed', label: 'الفواتير', align: 'end', hideBelow: 'sm', render: (r) => <Money value={Number(r.invoiced) - Number(r.returned)} /> },
            { key: 'paid', label: 'المدفوع', align: 'end', hideBelow: 'sm', render: (r) => <Money value={r.paid} /> },
            { key: 'due', label: 'الرصيد', align: 'end', render: (r) => <Balance value={Number(r.balance_due)} /> },
          ]}
          rowActions={(r) => <Button size="sm" onClick={() => open('supplier', r.supplier_id, Number(r.balance_due))}>تسديد</Button>}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><Wrench className="size-4 text-muted" />الفنيون في هذا المشروع</h3>
          <Button size="sm" variant="soft" onClick={() => setPaying({ kind: 'technician' })}>دفعة لفني</Button>
        </div>
        <DataTable
          rows={techs.data}
          getKey={(r) => r.technician_id!}
          loading={techs.isLoading}
          empty={<EmptyState icon={Wrench} title="لا توجد أعمال فنيين على هذا المشروع" />}
          columns={[
            { key: 'name', label: 'الفني', render: (r) => <Link to={`/technicians/${r.technician_id}`} className="font-medium hover:underline">{name(techNames.data, r.technician_id)}</Link> },
            { key: 'earned', label: 'الأعمال', align: 'end', hideBelow: 'sm', render: (r) => <Money value={r.earned} /> },
            { key: 'paid', label: 'المدفوع', align: 'end', hideBelow: 'sm', render: (r) => <Money value={r.paid} /> },
            { key: 'due', label: 'الرصيد', align: 'end', render: (r) => <Balance value={Number(r.balance_due)} /> },
          ]}
          rowActions={(r) => <Button size="sm" onClick={() => open('technician', r.technician_id, Number(r.balance_due))}>تسديد</Button>}
        />
      </section>

      <SupplierPaymentForm open={paying?.kind === 'supplier'} projectId={project.id} supplierId={paying?.kind === 'supplier' ? paying.id : undefined} defaultAmount={paying?.kind === 'supplier' ? paying.amount : undefined} onClose={() => setPaying(null)} />
      <TechCashForm open={paying?.kind === 'technician'} direction="pay" projectId={project.id} technicianId={paying?.kind === 'technician' ? paying.id : undefined} defaultAmount={paying?.kind === 'technician' ? paying.amount : undefined} onClose={() => setPaying(null)} />
    </div>
  )
}

function Balance({ value }: { value: number }) {
  return (
    <span className="inline-flex flex-col items-end">
      <Money value={Math.abs(value)} className={cn('font-semibold', value > 0 && 'text-red-700 dark:text-red-400', value < 0 && 'text-sand-600')} />
      {value < 0 && <span className="text-[10px] text-sand-600">مقدم</span>}
    </span>
  )
}
