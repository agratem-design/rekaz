import { useState } from 'react'
import { Building2, CalendarDays, Coins, Plus } from 'lucide-react'
import { Button, Money, PageHeader, StatCard } from '@/components/ui'
import { todayISO } from '@/lib/format'
import { ExpenseForm } from './ExpenseForm'
import { ExpensesTable } from './ExpensesTable'
import { useExpenses } from './expenseData'

export function ExpensesPage() {
  const [open, setOpen] = useState(false)
  const { data } = useExpenses()
  const posted = (data ?? []).filter((e) => e.status === 'posted')
  const month = todayISO().slice(0, 7)
  const sum = (xs: typeof posted) => xs.reduce((a, e) => a + Number(e.amount), 0)
  return (
    <div>
      <PageHeader
        title="المصروفات العامة"
        description="مصروفات الشركة العامة ومصروفات المشاريع المباشرة، من خزينة أو من عهدة"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            تسجيل مصروف
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Coins} label="المصروفات العامة" value={<Money value={sum(posted.filter((e) => !e.project_id))} />} hint="لا تدخل تكلفة أي مشروع" />
        <StatCard icon={Building2} label="مصروفات المشاريع" value={<Money value={sum(posted.filter((e) => e.project_id))} />} tone="blue" />
        <StatCard icon={CalendarDays} label="مصروفات هذا الشهر" value={<Money value={sum(posted.filter((e) => e.expense_date.startsWith(month)))} />} tone="sand" />
      </div>
      <ExpensesTable scopeFilter onNew={() => setOpen(true)} />
      <ExpenseForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
