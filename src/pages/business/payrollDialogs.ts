import type { BusinessField } from '@/components/BusinessForm'
import { todayISO } from '@/lib/format'

export type Dialog = { action: string; title: string; initial: Record<string, string>; fields: BusinessField[]; scope?: string }

export const dateField: BusinessField = { key: 'date', label: 'التاريخ', type: 'date', required: true }
export const notesField: BusinessField = { key: 'notes', label: 'البيان والملاحظات', type: 'notes' }

const payFields: BusinessField[] = [
  { key: 'amount', label: 'المبلغ المدفوع', type: 'number', required: true, min: 0.001 },
  { key: 'treasury_id', label: 'الخزينة المخصوم منها', type: 'treasury', required: true },
  dateField,
  notesField,
]

// صرف راتب قسيمة معروفة
export const payrollPaymentDialog = (slip: { id: string; remaining: number }, treasuryId = ''): Dialog => ({
  action: 'payroll_payment',
  title: 'صرف راتب',
  scope: slip.id,
  initial: { slip_id: slip.id, amount: String(slip.remaining), treasury_id: treasuryId, date: todayISO(), notes: '' },
  fields: payFields,
})

// صرف راتب مع اختيار القسيمة، عند البدء من الخزينة
export const payrollPickDialog = (slips: { value: string; label: string }[], treasuryId = ''): Dialog => ({
  action: 'payroll_payment',
  title: 'صرف راتب',
  scope: 'pick',
  initial: { slip_id: '', amount: '', treasury_id: treasuryId, date: todayISO(), notes: '' },
  fields: [{ key: 'slip_id', label: 'قسيمة الراتب', type: 'select', required: true, options: slips }, ...payFields],
})

export const employeeAdvanceDialog = (employees: { value: string; label: string }[], employeeId?: string, treasuryId = ''): Dialog => ({
  action: 'employee_advance',
  title: 'سلفة موظف أو رد سلفة',
  scope: employeeId,
  initial: { employee_id: employeeId ?? '', kind: 'advance', amount: '', treasury_id: treasuryId, date: todayISO(), notes: '' },
  fields: [
    { key: 'employee_id', label: 'الموظف', type: 'select', required: true, options: employees },
    { key: 'kind', label: 'نوع الحركة', type: 'select', required: true, options: [{ value: 'advance', label: 'صرف سلفة من الخزينة' }, { value: 'repayment', label: 'رد سلفة إلى الخزينة' }] },
    { key: 'amount', label: 'المبلغ', type: 'number', required: true, min: 0.001 },
    { key: 'treasury_id', label: 'الخزينة', type: 'treasury', required: true },
    dateField,
    notesField,
  ],
})
