import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, FileText, Plus, ReceiptText, RotateCcw, ShoppingCart, Wallet } from 'lucide-react'
import { Button, Money, PageHeader, StatCard, Tabs } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { SupplierPaymentForm } from '../suppliers/SupplierPaymentForm'
import { SupplierPaymentsTable } from '../suppliers/SupplierPaymentsTable'
import { PurchaseForm } from './PurchaseForm'
import { PurchasesTable } from './PurchasesTable'

// مركز الفواتير: كل فواتير الموردين وسندات صرفها
export function PurchasesPage() {
  const [tab, setTab] = useState('invoices')
  const [invoice, setInvoice] = useState<'material' | 'return' | null>(null)
  const [paying, setPaying] = useState(false)
  const bal = useQuery({
    queryKey: ['supplier_balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_balances').select('*')
      if (error) throw error
      return data
    },
  })
  const sum = (k: 'invoiced' | 'returned' | 'paid' | 'unallocated_advance') => (bal.data ?? []).reduce((a, x) => a + Number(x[k] ?? 0), 0)
  const due = (bal.data ?? []).reduce((a, x) => a + Math.max(Number(x.balance_due), 0), 0)
  return (
    <div>
      <PageHeader
        title="مركز الفواتير"
        description="فواتير الموردين (مواد، خدمات، مرتجعات) وسداداتها"
        actions={
          <>
            <Button variant="secondary" onClick={() => setInvoice('return')}>
              <RotateCcw className="size-4" />
              مرتجع
            </Button>
            <Button variant="soft" onClick={() => setPaying(true)}>
              <Banknote className="size-4" />
              سداد دفعة لمورد
            </Button>
            <Button onClick={() => setInvoice('material')}>
              <Plus className="size-4" />
              فاتورة مشتريات
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="إجمالي الفواتير" value={<Money value={sum('invoiced') - sum('returned')} />} />
        <StatCard icon={Banknote} label="المدفوع للموردين" value={<Money value={sum('paid')} />} tone="blue" />
        <StatCard icon={Wallet} label="المستحق للموردين" value={<Money value={due} />} tone="red" />
        <StatCard icon={Wallet} label="مقدمات غير موزعة" value={<Money value={sum('unallocated_advance')} />} tone="sand" />
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'invoices', label: 'الفواتير', icon: FileText },
          { key: 'payments', label: 'سندات الصرف', icon: ReceiptText },
        ]}
      />
      <div className="mt-4">{tab === 'invoices' ? <PurchasesTable onNew={() => setInvoice('material')} /> : <SupplierPaymentsTable onNew={() => setPaying(true)} />}</div>
      <PurchaseForm open={invoice !== null} onClose={() => setInvoice(null)} kind={invoice ?? undefined} />
      <SupplierPaymentForm open={paying} onClose={() => setPaying(false)} />
    </div>
  )
}
