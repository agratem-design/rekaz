import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Briefcase, Coins, HandCoins, Truck, Wallet, Wrench, type LucideIcon } from 'lucide-react'
import { BusinessForm } from '@/components/BusinessForm'
import { Modal } from '@/components/dialog'
import { Button, EmptyState, Money } from '@/components/ui'
import { useBusinessTable } from '@/lib/businessData'
import { formatMoney } from '@/lib/format'
import { useTreasuriesWithBalance } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { employeeAdvanceDialog, payrollPickDialog } from '../business/payrollDialogs'
import { IssueForm } from '../CustodiesPage'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { SupplierPaymentForm } from '../suppliers/SupplierPaymentForm'
import { TechCashForm } from '../technicians/TechForms'
import { TransferForm } from '../TransfersPage'

type Op = 'supplier' | 'technician' | 'payroll' | 'advance' | 'expense' | 'custody' | 'transfer'

const ops: { op: Op; icon: LucideIcon; title: string; desc: string }[] = [
  { op: 'supplier', icon: Truck, title: 'سداد فاتورة مورد', desc: 'لفاتورة محددة، أو على الحساب، أو دفعة مقدمة' },
  { op: 'technician', icon: Wrench, title: 'صرف لفني أو عامل', desc: 'يخفض مستحقه من الأعمال، والزيادة تبقى مقدماً عنده' },
  { op: 'payroll', icon: Briefcase, title: 'صرف راتب', desc: 'من قسيمة معتمدة في مسير الرواتب' },
  { op: 'advance', icon: Wallet, title: 'سلفة موظف', desc: 'صرف سلفة، أو تسجيل ردها إلى الخزينة' },
  { op: 'expense', icon: Coins, title: 'مصروف', desc: 'مصروف عام، أو مباشر على مشروع' },
  { op: 'custody', icon: HandCoins, title: 'صرف عهدة', desc: 'مبلغ عند موظف أو مهندس يُسوّى لاحقاً' },
  { op: 'transfer', icon: ArrowLeftRight, title: 'تحويل إلى خزينة أخرى', desc: 'لا يغيّر مجموع الأرصدة' },
]

// «ماذا تريد أن تصرف؟»: مدخل واحد لكل ما يخرج من الخزينة، ويفتح نموذج العملية نفسه المستخدم في بقية الشاشات
export function PaymentChooser({ open, treasuryId, onClose }: { open: boolean; treasuryId?: string; onClose: () => void }) {
  const [form, setForm] = useState<{ op: Op; treasuryId?: string; open: boolean } | null>(null)
  const treasuries = useTreasuriesWithBalance()
  const from = (treasuries.data ?? []).find((t) => t.id === treasuryId)
  const close = () => setForm((f) => f && { ...f, open: false })
  const pick = (op: Op) => {
    setForm({ op, treasuryId, open: true })
    onClose()
  }
  return (
    <>
      {open && (
        <Modal title="ماذا تريد أن تصرف؟" onClose={onClose}>
          {from && (
            <p className="px-4 pt-4 text-sm text-muted">
              من {from.name} · الرصيد المتاح <Money value={from.balance} className="font-semibold text-ink" />
            </p>
          )}
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {ops.map((o) => (
              <button key={o.op} type="button" onClick={() => pick(o.op)} className="flex gap-3 rounded-xl border border-line p-3 text-right transition hover:border-brand-400 hover:bg-accent-soft">
                <span className="h-fit rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/60 dark:text-brand-200">
                  <o.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-xs text-muted">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {/* النماذج تبقى مركبة بعد الإغلاق لتعرض خيارات طباعة السند */}
      {form?.op === 'supplier' && <SupplierPaymentForm open={form.open} treasuryId={form.treasuryId} onClose={close} />}
      {form?.op === 'technician' && <TechCashForm open={form.open} direction="pay" treasuryId={form.treasuryId} onClose={close} />}
      {form?.op === 'expense' && <ExpenseForm open={form.open} treasuryId={form.treasuryId} onClose={close} />}
      {form?.op === 'custody' && <IssueForm open={form.open} treasuryId={form.treasuryId} onClose={close} />}
      {form?.op === 'transfer' && <TransferForm open={form.open} fromId={form.treasuryId} onClose={close} />}
      {form?.op === 'payroll' && form.open && <PayrollPick treasuryId={form.treasuryId} onClose={close} />}
      {form?.op === 'advance' && form.open && <AdvanceForm treasuryId={form.treasuryId} onClose={close} />}
    </>
  )
}

const useActiveEmployees = () =>
  useQuery({
    queryKey: ['employees', 'active-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, name, is_active').order('name')
      if (error) throw error
      return data
    },
  })

function PayrollPick({ treasuryId, onClose }: { treasuryId?: string; onClose: () => void }) {
  const navigate = useNavigate()
  const slips = useBusinessTable('payroll_balances')
  const employees = useActiveEmployees()
  if (slips.isLoading || employees.isLoading) return null
  const names = new Map(employees.data?.map((e) => [e.id, e.name]))
  const open = (slips.data ?? []).filter((s) => s.status === 'posted' && Number(s.remaining) > 0)
  if (!open.length)
    return (
      <Modal title="صرف راتب" size="sm" onClose={onClose}>
        <EmptyState
          icon={Briefcase}
          title="لا توجد رواتب معتمدة غير مصروفة"
          action={
            <Button
              onClick={() => {
                onClose()
                navigate('/payroll')
              }}
            >
              فتح الرواتب والسلف
            </Button>
          }
        >
          اعتمد مسير الشهر أولاً، ثم اصرف الصافي من الخزينة.
        </EmptyState>
      </Modal>
    )
  const options = open.map((s) => ({ value: s.id, label: `${names.get(s.employee_id) ?? ''} — ${s.period.slice(0, 7)} — متبقٍ ${formatMoney(s.remaining)}` }))
  return <BusinessForm {...payrollPickDialog(options, treasuryId)} printKind="payroll-payment" onClose={onClose} />
}

function AdvanceForm({ treasuryId, onClose }: { treasuryId?: string; onClose: () => void }) {
  const employees = useActiveEmployees()
  const balances = useBusinessTable('employee_advance_balances')
  if (employees.isLoading || balances.isLoading) return null
  const options = (employees.data ?? []).filter((e) => e.is_active).map((e) => ({ value: e.id, label: `${e.name} — سلفة متبقية ${formatMoney(balances.data?.find((b) => b.employee_id === e.id)?.remaining ?? 0)}` }))
  return <BusinessForm {...employeeAdvanceDialog(options, undefined, treasuryId)} printKind="employee-advance" onClose={onClose} />
}
