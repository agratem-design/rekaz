/** Read-only reconciliation of the rows visible to the configured public client.
 * GET/HEAD queries only; no RPCs, authentication changes, or business writes.
 * Output contains aggregate counts/amounts, not names, notes, or record IDs.
 * Visibility may be limited by RLS. Results are not a whole-database guarantee.
 */
import { supabase } from '../financial-tests/client.mjs';

const { data: sessionData } = await supabase.auth.getSession();
const hasAuthenticatedSession = Boolean(sessionData.session);

const columns = {
  projects: 'id,project_type',
  purchases: 'id,project_id,technician_id,supplier_id,purchase_type,total_amount,paid_amount',
  project_item_technicians: 'id,technician_id,total_cost',
  client_payments: 'id,client_id,project_id,amount,treasury_id',
  client_credit_ledger: 'id,entry_type,amount,source_payment_id,target_project_id',
  supplier_payments: 'id,supplier_id,amount,treasury_id',
  supplier_payment_allocations: 'id,payment_id,purchase_id,amount',
  purchase_payments: 'id,purchase_id,amount,treasury_id',
  technician_payments: 'id,technician_id,amount,status,treasury_id,context_project_id',
  treasuries: 'id,parent_id,balance',
  treasury_transactions: 'id,treasury_id,type,amount,reference_id,reference_type,source',
  income: 'id,amount,subtype,reference_id',
};
const tables = {};
const coverage = [];
for (const [table, select] of Object.entries(columns)) {
  const rows = [];
  let total = null;
  let error = null;
  for (let offset = 0; offset < 10000; offset += 500) {
    const result = await supabase.from(table).select(select, { count: 'exact' }).order('id').range(offset, offset + 499);
    if (result.error) { error = { code: result.error.code, message: result.error.message }; break; }
    total = result.count;
    rows.push(...result.data);
    if (result.data.length < 500 || (total !== null && rows.length >= total)) break;
  }
  tables[table] = rows;
  coverage.push({ table, visibleRows: rows.length, visibleTotal: total, complete: error === null && rows.length === total, error });
}
if (coverage.some(x => !x.complete)) {
  console.log(JSON.stringify({ mode: 'READ_ONLY', coverage, reconciliation: 'SKIPPED: incomplete source data' }, null, 2));
  process.exitCode = 2;
} else {
  const sum = rows => rows.reduce((n, r) => n + Number(r.amount || 0), 0);
  const money = n => Math.round(n * 1000) / 1000;
  const labor = tables.purchases.filter(r => r.purchase_type === 'labor' || r.technician_id);
  const assignedTechs = new Set(tables.project_item_technicians.map(r => r.technician_id));
  const unmatchedLabor = labor.filter(r => r.technician_id && !assignedTechs.has(r.technician_id));
  const paidFieldMismatches = tables.purchases.filter(p => Math.abs(Number(p.paid_amount || 0) -
    sum(tables.purchase_payments.filter(x => x.purchase_id === p.id)) -
    sum(tables.supplier_payment_allocations.filter(x => x.purchase_id === p.id))) > 0.001);
  const generalPayments = tables.client_payments.filter(p => !p.project_id);
  const generalWithoutCredit = generalPayments.filter(p => !tables.client_credit_ledger.some(e => e.source_payment_id === p.id && e.entry_type === 'CREDIT_CREATED'));
  const clientTxCounts = tables.client_payments.map(p => tables.treasury_transactions.filter(t => t.reference_id === p.id && t.type === 'deposit').length);
  const leafTreasuries = tables.treasuries.filter(t => !tables.treasuries.some(child => child.parent_id === t.id));
  const knownTypes = new Set(['deposit', 'withdrawal']);
  const unknownTxTypes = [...new Set(tables.treasury_transactions.filter(t => !knownTypes.has(t.type)).map(t => t.type))];
  const leafMismatches = unknownTxTypes.length ? null : leafTreasuries.filter(t => {
    const calculated = tables.treasury_transactions.filter(x => x.treasury_id === t.id)
      .reduce((n, x) => n + (x.type === 'deposit' ? 1 : -1) * Number(x.amount), 0);
    return Math.abs(Number(t.balance) - calculated) > 0.001;
  });
  const transactionsByReferenceType = {};
  for (const t of tables.treasury_transactions) {
    const key = t.reference_type || '(none)';
    transactionsByReferenceType[key] = (transactionsByReferenceType[key] || 0) + 1;
  }
  console.log(JSON.stringify({
    mode: 'READ_ONLY_VISIBLE_ROWS_ONLY', hasAuthenticatedSession, realDatabaseWrites: 0, coverage,
    observations: {
      laborPurchaseCount: labor.length,
      laborPurchaseAmount: money(labor.reduce((n, p) => n + Number(p.total_amount), 0)),
      laborPurchasesForTechniciansWithoutAnyItemAssignment: unmatchedLabor.length,
      purchasesWithPaidFieldNotMatchingVisiblePaymentAndAllocationRows: paidFieldMismatches.length,
      generalClientPayments: generalPayments.length,
      generalClientPaymentsWithoutCreditCreatedEvent: generalWithoutCredit.length,
      clientPaymentsWithNoLinkedDeposit: clientTxCounts.filter(n => n === 0).length,
      clientPaymentsWithMultipleLinkedDeposits: clientTxCounts.filter(n => n > 1).length,
      visibleUnallocatedSupplierAdvance: money(sum(tables.supplier_payments) - sum(tables.supplier_payment_allocations)),
      leafTreasuryBalanceMismatches: leafMismatches?.length ?? 'NOT_CHECKED',
      unknownTransactionTypes: unknownTxTypes,
      transactionsByReferenceType,
    },
    caveats: [
      'Counts cover rows visible to the configured client, not an independent privileged inventory.',
      'Cross-table reads are not a single database snapshot.',
      'A balance mismatch needs opening-balance/import-policy review; it is not proof of missing money.',
      'Zero payment rows cannot validate payment, reversal, or concurrency workflows.',
    ],
  }, null, 2));
}
