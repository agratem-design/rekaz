import { useState } from 'react'
import { Coins, Hammer, Package, Plus, RotateCcw, Wrench, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Modal } from '@/components/dialog'
import { Button, cn } from '@/components/ui'
import type { ProjectDetail } from '@/lib/queries'
import { ExpenseForm } from '../expenses/ExpenseForm'
import { ExpensesTable } from '../expenses/ExpensesTable'
import { PurchaseForm } from '../purchases/PurchaseForm'
import { PurchasesTable } from '../purchases/PurchasesTable'
import { WorkForm } from '../technicians/TechForms'
import { WorkTable } from '../technicians/WorkTable'

type Op = 'material' | 'service' | 'return' | 'work' | 'expense'

// «ماذا تريد أن تضيف للمشروع؟» — نفس خطوة اختيار نوع العملية في النظام السابق
export function OperationPicker({ onPick, onClose, finishing }: { onPick: (op: Op) => void; onClose: () => void; finishing: boolean }) {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const ops: { op: Op; icon: LucideIcon; title: string; desc: string; show: boolean }[] = [
    { op: 'material', icon: Package, title: 'شراء مواد ومستلزمات', desc: 'فاتورة شراء مواد بناء وأدوات من مورد (نقداً أو ذمة)', show: finance },
    { op: 'service', icon: Wrench, title: finishing ? 'خدمات مورد / تشطيب' : 'خدمات مورد', desc: 'فاتورة خدمة يقدمها مورد للمشروع', show: finance },
    { op: 'work', icon: Hammer, title: 'عمل فني / عمالة', desc: 'إنجاز فني بالكمية والسعر؛ يصبح مستحقاً للفني وتكلفة على المشروع', show: true },
    { op: 'expense', icon: Coins, title: 'مصروف مباشر للمشروع', desc: 'نثريات، وقود، ضيافة، ومصروفات موقعية من خزينة أو عهدة', show: finance },
    { op: 'return', icon: RotateCcw, title: 'مرتجع مشتريات', desc: 'إرجاع جزء من فاتورة مورد سابقة', show: finance },
  ]
  return (
    <Modal title="ماذا تريد أن تضيف للمشروع؟" onClose={onClose}>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {ops
          .filter((o) => o.show)
          .map((o) => (
            <button
              key={o.op}
              type="button"
              onClick={() => onPick(o.op)}
              className={cn('flex gap-3 rounded-xl border border-line p-3 text-right transition hover:border-brand-400 hover:bg-accent-soft', o.op === 'return' && 'sm:col-span-2')}
            >
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
  )
}

function useOps() {
  const [picking, setPicking] = useState(false)
  const [op, setOp] = useState<Op | null>(null)
  return { picking, setPicking, op, setOp }
}

function OpForms({ project, op, close }: { project: ProjectDetail; op: Op | null; close: () => void }) {
  return (
    <>
      <PurchaseForm open={op === 'material' || op === 'service' || op === 'return'} kind={op === 'service' ? 'service' : op === 'return' ? 'return' : 'material'} projectId={project.id} onClose={close} />
      <WorkForm open={op === 'work'} projectId={project.id} onClose={close} />
      <ExpenseForm open={op === 'expense'} projectId={project.id} onClose={close} />
    </>
  )
}

export function ProjectPurchasesTab({ project }: { project: ProjectDetail }) {
  const { picking, setPicking, op, setOp } = useOps()
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{project.project_type === 'finishing' ? 'المشتريات والخدمات' : 'المشتريات'}</h2>
          <p className="text-xs text-muted">فواتير المواد والخدمات والمرتجعات لهذا المشروع</p>
        </div>
        <Button onClick={() => setPicking(true)}>
          <Plus className="size-4" />
          إضافة مشترى
        </Button>
      </div>
      <PurchasesTable projectId={project.id} onNew={() => setPicking(true)} />
      <div className="mt-6">
        <h3 className="mb-2 font-semibold">أعمال الفنيين والعمالة</h3>
        <WorkTable projectId={project.id} onNew={() => setOp('work')} />
      </div>
      {picking && <OperationPicker finishing={project.project_type === 'finishing'} onClose={() => setPicking(false)} onPick={(o) => (setPicking(false), setOp(o))} />}
      <OpForms project={project} op={op} close={() => setOp(null)} />
    </div>
  )
}

export function ProjectExpensesTab({ project }: { project: ProjectDetail }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">مصروفات المشروع</h2>
          <p className="text-xs text-muted">تدخل التكلفة المباشرة للمشروع</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          مصروف مباشر
        </Button>
      </div>
      <ExpensesTable projectId={project.id} onNew={() => setOpen(true)} />
      <ExpenseForm open={open} projectId={project.id} onClose={() => setOpen(false)} />
    </div>
  )
}
