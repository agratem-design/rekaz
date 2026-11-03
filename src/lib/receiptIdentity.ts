/** The persisted source identifies a receipt across screens and reprints. */
export function receiptNumber(prefix: string, id: string): string {
  if (!id) throw new Error("لا يمكن طباعة واصل قبل حفظ العملية");
  return `${prefix}-${id.toUpperCase()}`;
}

export function treasuryReceiptNumber(tx: { id: string; reference_type?: string | null; reference_id?: string | null }): string {
  const prefixes: Record<string, string> = {
    employee_advance: "ADV", employee_advances: "ADV",
    employee_advance_repayment: "REP", employee_advance_repayments: "REP",
    advance_repayment: "REP",
    payroll: "SAL", payroll_slip: "SAL", employee_payroll_slip: "SAL", employee_payroll_slips: "SAL",
    custody: "CUST", project_custody: "CUST", custody_settlement: "SET",
    expense: "EXP", income: "INC", purchase_payment: "PAY", supplier_payment: "PAY",
    technician_payment: "PAY", technician_deposit: "DEP", equipment_rental: "RNT",
  };
  const prefix = prefixes[tx.reference_type || ""];
  return prefix && tx.reference_id ? receiptNumber(prefix, tx.reference_id) : receiptNumber("TX", tx.id);
}
