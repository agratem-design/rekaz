// يفتح مستند الطباعة في تبويب جديد (الجلسة محفوظة فلا يُطلب الدخول مجدداً)
export function openPrint(kind: string, id: string, auto = false, params?: Record<string, string>) {
  const base = `${window.location.origin}${window.location.pathname}`
  const q = new URLSearchParams(params)
  if (auto) q.set('auto', '1')
  const qs = q.toString()
  window.open(`${base}#/print/${kind}/${id}${qs ? `?${qs}` : ''}`, '_blank', 'noopener')
}

// المستند المصدر لكل حركة خزينة
export const sourcePrintKind: Record<string, string> = {
  client_receipt: 'receipt',
  supplier_payment: 'supplier-payment',
  technician_payment: 'technician-payment',
  technician_deposit: 'technician-receipt',
  expense: 'expense',
  transfer: 'transfer',
  custody_issue: 'custody',
  payroll_slip: 'payroll-payment',
  employee_advance: 'employee-advance',
  advance_repayment: 'employee-advance',
  custody_return: 'custody-return',
  supplier_refund: 'supplier-refund',
}
