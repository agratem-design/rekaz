import { useState } from 'react'
import { Banknote, CalendarDays, Plus, Wallet } from 'lucide-react'
import { Button, Money, PageHeader, StatCard } from '@/components/ui'
import { todayISO } from '@/lib/format'
import { ReceiptForm } from './ReceiptForm'
import { ReceiptsTable, useReceipts } from './ReceiptsTable'

export function ReceiptsPage() {
  const [open, setOpen] = useState(false)
  const { data } = useReceipts({})
  const posted = (data ?? []).filter((r) => r.status === 'posted')
  const month = todayISO().slice(0, 7)
  const sum = (xs: typeof posted) => xs.reduce((a, r) => a + Number(r.amount), 0)
  return (
    <div>
      <PageHeader
        title="إيصالات المقبوضات"
        description="تسجيل دفعة لمشروع أو رصيد دائن عام على حساب الزبون"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            إيصال قبض جديد
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Banknote} label="إجمالي المقبوضات" value={<Money value={sum(posted)} />} />
        <StatCard icon={CalendarDays} label="مقبوضات هذا الشهر" value={<Money value={sum(posted.filter((r) => r.receipt_date.startsWith(month)))} />} tone="blue" />
        <StatCard icon={Wallet} label="دفعات بلا مشروع" value={<Money value={sum(posted.filter((r) => !r.project_id))} />} tone="sand" hint="تُحفظ رصيداً دائناً للزبون" />
      </div>
      <ReceiptsTable onNew={() => setOpen(true)} />
      <ReceiptForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
