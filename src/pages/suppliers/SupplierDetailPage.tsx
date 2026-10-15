import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, FileText, Phone, Plus, Printer, ReceiptText, ScrollText, ShoppingCart, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Button, Card, EmptyState, ErrorState, Money, PageHeader, Skeleton, StatCard, Tabs } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { PurchaseForm } from '../purchases/PurchaseForm'
import { PurchasesTable } from '../purchases/PurchasesTable'
import { purchaseKindLabels, usePurchases } from '../purchases/purchaseData'
import { SupplierPaymentForm } from './SupplierPaymentForm'
import { SupplierPaymentsTable, useSupplierPayments } from './SupplierPaymentsTable'

// كشف حساب مورد: الفواتير (+) والمرتجعات والدفعات (−) بالترتيب الزمني مع الرصيد بعد كل حركة
export function SupplierDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const [tab, setTab] = useState('statement')
  const [invoice, setInvoice] = useState(false)
  const [paying, setPaying] = useState(false)
  const s = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const [a, b] = await Promise.all([supabase.from('suppliers').select('*').eq('id', id).single(), supabase.from('supplier_balances').select('*').eq('supplier_id', id).maybeSingle()])
      if (a.error) throw a.error
      if (b.error) throw b.error
      return { supplier: a.data, bal: b.data }
    },
  })
  const purchases = usePurchases({ supplierId: id })
  const payments = useSupplierPayments(id)

  if (s.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (s.error)
    return (s.error as { code?: string }).code === 'PGRST116' ? (
      <Card>
        <EmptyState title="المورد غير موجود" action={<Button variant="secondary" onClick={() => navigate('/suppliers')}>العودة للموردين</Button>} />
      </Card>
    ) : (
      <ErrorState message={errorMessage(s.error)} onRetry={() => s.refetch()} />
    )
  const sup = s.data!.supplier
  const bal = s.data!.bal

  type Line = { date: string; created: string; label: string; debit: number; credit: number }
  const lines: Line[] = [
    ...(purchases.data ?? [])
      .filter((p) => p.status === 'posted')
      .map((p) => ({
        date: p.invoice_date,
        created: p.created_at,
        label: `${purchaseKindLabels[p.kind]}${p.invoice_no ? ` #${p.invoice_no}` : ''}${p.description ? ` — ${p.description}` : ''}${p.projects?.name ? ` (${p.projects.name})` : ''}`,
        debit: p.kind === 'return' ? 0 : Number(p.total_amount),
        credit: p.kind === 'return' ? Number(p.total_amount) : 0,
      })),
    ...(payments.data ?? [])
      .filter((p) => p.status === 'posted')
      .map((p) => ({ date: p.payment_date, created: p.created_at, label: `سند صرف${p.unallocated > 0 ? ' (يتضمن مقدماً)' : ''}${p.reference ? ` — ${p.reference}` : ''}`, debit: 0, credit: Number(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.created.localeCompare(b.created))
  let running = 0
  const withBal = lines.map((l) => ((running += l.debit - l.credit), { ...l, balance: running }))

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'الموردون', to: '/suppliers' }, { label: sup.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={sup.name} size="lg" />
            {sup.name}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            {sup.category && <span>{sup.category}</span>}
            {sup.phone && (
              <span className="num flex items-center gap-1">
                <Phone className="size-3.5" />
                {sup.phone}
              </span>
            )}
          </span>
        }
        actions={
          finance && (
            <>
              <Button onClick={() => setPaying(true)}>
                <Banknote className="size-4" />
                سداد دفعة للمورد
              </Button>
              <Button variant="soft" onClick={() => setInvoice(true)}>
                <Plus className="size-4" />
                فاتورة مشتريات
              </Button>
              <Button variant="secondary" onClick={() => openPrint('supplier-statement', sup.id)}>
                <Printer className="size-4" />
                كشف الحساب
              </Button>
            </>
          )
        }
      />
      {finance && bal && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <StatCard icon={ShoppingCart} label="إجمالي الفواتير" value={<Money value={Number(bal.invoiced) - Number(bal.returned)} />} hint={Number(bal.returned) > 0 ? `بعد مرتجعات ${bal.returned}` : undefined} />
          <StatCard icon={Banknote} label="المدفوع" value={<Money value={bal.paid} />} tone="blue" />
          <StatCard icon={Wallet} label="المستحق للمورد" value={<Money value={Math.max(Number(bal.balance_due), 0)} />} tone="red" />
          <StatCard icon={Wallet} label="مقدم غير موزع" value={<Money value={bal.unallocated_advance} />} tone="sand" hint="دفعات لم توزَّع على فواتير بعد" />
        </div>
      )}
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'statement', label: 'كشف الحساب', icon: ScrollText },
          { key: 'invoices', label: 'الفواتير', icon: FileText },
          { key: 'payments', label: 'سندات الصرف', icon: ReceiptText },
        ]}
      />
      <div className="mt-4">
        {tab === 'statement' && (
          <Card className="overflow-x-auto p-0">
            {!withBal.length ? (
              <EmptyState icon={ScrollText} title="لا توجد حركات" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-semibold">التاريخ</th>
                    <th className="px-4 py-2.5 text-right font-semibold">البيان</th>
                    <th className="px-4 py-2.5 text-left font-semibold">له (فواتير)</th>
                    <th className="px-4 py-2.5 text-left font-semibold">منه (دفعات/مرتجعات)</th>
                    <th className="px-4 py-2.5 text-left font-semibold">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {withBal.map((l, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="num px-4 py-2 whitespace-nowrap text-muted">{formatDate(l.date)}</td>
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2 text-left">{l.debit ? <Money value={l.debit} /> : ''}</td>
                      <td className="px-4 py-2 text-left">{l.credit ? <Money value={l.credit} /> : ''}</td>
                      <td className="px-4 py-2 text-left">
                        <Money value={l.balance} className="font-semibold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
        {tab === 'invoices' && <PurchasesTable supplierId={sup.id} onNew={() => setInvoice(true)} />}
        {tab === 'payments' && <SupplierPaymentsTable supplierId={sup.id} onNew={() => setPaying(true)} />}
      </div>
      {finance && <PurchaseForm open={invoice} onClose={() => setInvoice(false)} supplierId={sup.id} />}
      {finance && <SupplierPaymentForm open={paying} onClose={() => setPaying(false)} supplierId={sup.id} />}
    </div>
  )
}
