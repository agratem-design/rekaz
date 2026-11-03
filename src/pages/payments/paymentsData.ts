import { useQuery } from '@tanstack/react-query'
import { useBusinessTable } from '@/lib/businessData'
import { formatMoney } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { purchaseKindLabels, usePurchases } from '../purchases/purchaseData'
import { useTechnicianBalance } from '../technicians/techData'

const useEmployeeNames = () =>
  useQuery({
    queryKey: ['employees', 'names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, name').order('name')
      if (error) throw error
      return new Map(data.map((e) => [e.id, e.name]))
    },
  })

export const useSupplierDues = () =>
  useQuery({
    queryKey: ['supplier_balances', 'dues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_balances').select('supplier_id, balance_due')
      if (error) throw error
      return new Map(data.map((s) => [s.supplier_id, Number(s.balance_due)]))
    },
  })

export type PayableKind = 'supplier' | 'technician' | 'payroll'
export type Payable = {
  key: string
  kind: PayableKind
  partyId: string
  party: string
  to: string | null
  title: string
  project: string | null
  date: string | null
  amount: number
  note?: string
  purchaseId?: string
}

// كل ما هو مستحق على الشركة ولم يُصرف بعد. لا حساب هنا: الأرقام من العروض مباشرة.
export function usePayables() {
  const purchases = usePurchases()
  const dues = useSupplierDues()
  const techs = useTechnicianBalance()
  const slips = useBusinessTable('payroll_balances')
  const employees = useEmployeeNames()

  const invoices = (purchases.data ?? []).filter((p) => p.status === 'posted' && p.kind !== 'return' && p.remaining > 0)
  const openBySupplier = new Map<string, number>()
  for (const p of invoices) openBySupplier.set(p.supplier_id, (openBySupplier.get(p.supplier_id) ?? 0) + p.remaining)

  const rows: Payable[] = [
    ...invoices.map((p): Payable => {
      const net = dues.data?.get(p.supplier_id)
      // المقدمات غير الموزعة والمرتجعات تُحسب على مستوى المورد لا الفاتورة
      const reduced = net !== undefined && net < (openBySupplier.get(p.supplier_id) ?? 0)
      return {
        key: `supplier-${p.id}`,
        kind: 'supplier',
        partyId: p.supplier_id,
        party: p.suppliers?.name ?? '',
        to: `/suppliers/${p.supplier_id}`,
        title: `${p.invoice_no ? `#${p.invoice_no} · ` : ''}${p.description ?? purchaseKindLabels[p.kind]}`,
        project: p.projects?.name ?? null,
        date: p.invoice_date,
        amount: p.remaining,
        note: reduced ? `صافي حساب المورد بعد المقدمات والمرتجعات ${formatMoney(Math.max(net, 0))}` : undefined,
        purchaseId: p.id,
      }
    }),
    ...(techs.data ?? [])
      .filter((t) => Number(t.balance_due) > 0)
      .map((t): Payable => ({
        key: `technician-${t.technician_id}`,
        kind: 'technician',
        partyId: t.technician_id!,
        party: t.name ?? '',
        to: `/technicians/${t.technician_id}`,
        title: 'مستحق أعمال منجزة',
        project: null,
        date: null,
        amount: Number(t.balance_due),
      })),
    ...(slips.data ?? [])
      .filter((s) => s.status === 'posted' && Number(s.remaining) > 0)
      .map((s): Payable => ({
        key: `payroll-${s.id}`,
        kind: 'payroll',
        partyId: s.id,
        party: employees.data?.get(s.employee_id) ?? '',
        to: `/employees/${s.employee_id}`,
        title: `راتب شهر ${s.period.slice(0, 7)}`,
        project: null,
        date: s.period,
        amount: Number(s.remaining),
      })),
  ]
  const queries = [purchases, dues, techs, slips, employees]
  return { rows, isLoading: queries.some((q) => q.isLoading), error: queries.find((q) => q.error)?.error ?? null, refetch: () => queries.forEach((q) => q.refetch()) }
}

export type Outflow = {
  id: string
  sourceType: string
  sourceId: string
  date: string
  party: string
  detail: string | null
  to: string | null
  treasuryId: string
  treasury: string
  amount: number
  reversed: boolean
}

// سجل واحد لكل ما خرج من الخزائن. المصدر دفتر الحركات، والمستندات تضيف اسم المستلم فقط.
// المفتاح تحت treasury_entries ليتحدث بعد كل عملية مالية.
export function useOutflows() {
  return useQuery({
    queryKey: ['treasury_entries', 'outflows'],
    queryFn: async (): Promise<Outflow[]> => {
      const [entries, reversals, treasuries, supplier, technician, expense, custody, transfer, payroll, slip, advance, employee] = await Promise.all([
        supabase.from('treasury_entries').select('*').eq('direction', 'out').is('reverses_entry_id', null).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('treasury_entries').select('reverses_entry_id').not('reverses_entry_id', 'is', null),
        supabase.from('treasuries').select('id, name'),
        supabase.from('supplier_payments').select('id, supplier_id, reference, suppliers(name), projects(name)'),
        supabase.from('technician_payments').select('id, technician_id, projects(name), technicians(name)'),
        supabase.from('expenses').select('id, description, project_id, projects(name)'),
        supabase.from('custodies').select('id, employee_id, purpose, employees(name), engineers(name)'),
        supabase.from('transfers').select('id, to_treasury_id, notes'),
        supabase.from('payroll_payments').select('id, slip_id'),
        supabase.from('payroll_slips').select('id, employee_id, period'),
        supabase.from('employee_advances').select('id, employee_id'),
        supabase.from('employees').select('id, name'),
      ])
      for (const r of [entries, reversals, treasuries, supplier, technician, expense, custody, transfer, payroll, slip, advance, employee]) if (r.error) throw r.error
      const by = <T extends { id: string }>(rows: T[] | null) => new Map((rows ?? []).map((r) => [r.id, r]))
      const treasuryName = by(treasuries.data)
      const suppliers = by(supplier.data), techs = by(technician.data), expenses = by(expense.data), custodies = by(custody.data), transfers = by(transfer.data)
      const payrolls = by(payroll.data), slips = by(slip.data), advances = by(advance.data), employees = by(employee.data)
      const reversed = new Set((reversals.data ?? []).map((r) => r.reverses_entry_id))

      const payee = (type: string, id: string): Pick<Outflow, 'party' | 'detail' | 'to'> => {
        if (type === 'supplier_payment') {
          const s = suppliers.get(id)
          return { party: s?.suppliers?.name ?? '', detail: [s?.projects?.name, s?.reference].filter(Boolean).join(' · ') || null, to: s ? `/suppliers/${s.supplier_id}` : null }
        }
        if (type === 'technician_payment') {
          const t = techs.get(id)
          return { party: t?.technicians?.name ?? '', detail: t?.projects?.name ?? 'على الحساب', to: t ? `/technicians/${t.technician_id}` : null }
        }
        if (type === 'expense') {
          const e = expenses.get(id)
          return { party: e?.description ?? '', detail: e?.projects?.name ?? 'مصروف عام', to: e?.project_id ? `/projects/${e.project_id}/expenses` : '/expenses' }
        }
        if (type === 'custody_issue') {
          const c = custodies.get(id)
          return { party: c?.employees?.name ?? c?.engineers?.name ?? '', detail: c?.purpose ?? null, to: '/custodies' }
        }
        if (type === 'transfer') {
          const t = transfers.get(id)
          return { party: `إلى ${treasuryName.get(t?.to_treasury_id ?? '')?.name ?? ''}`, detail: t?.notes ?? null, to: '/transfers' }
        }
        if (type === 'payroll_slip') {
          const s = slips.get(payrolls.get(id)?.slip_id ?? '')
          return { party: employees.get(s?.employee_id ?? '')?.name ?? '', detail: s ? `راتب شهر ${s.period.slice(0, 7)}` : null, to: s ? `/employees/${s.employee_id}` : null }
        }
        if (type === 'employee_advance') {
          const a = advances.get(id)
          return { party: employees.get(a?.employee_id ?? '')?.name ?? '', detail: null, to: a ? `/employees/${a.employee_id}` : null }
        }
        return { party: '', detail: null, to: null }
      }

      return (entries.data ?? []).map((e) => ({
        id: e.id,
        sourceType: e.source_type,
        sourceId: e.source_id,
        date: e.entry_date,
        ...payee(e.source_type, e.source_id),
        treasuryId: e.treasury_id,
        treasury: treasuryName.get(e.treasury_id)?.name ?? '',
        amount: Number(e.amount),
        reversed: reversed.has(e.id),
      }))
    },
  })
}
