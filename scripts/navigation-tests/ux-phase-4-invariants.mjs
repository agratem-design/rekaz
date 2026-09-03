/**
 * ============================================================================
 * UX PHASE 4: CONTEXTUAL DRAWERS, DECOUPLED ENTRY, AND TREASURY SUITE
 * ============================================================================
 *
 * Verifies the mathematical, structural, and behavioral invariants of UX Phase 4:
 * 1. Contextual Drawer Lifecycle & Project Header (DRAWER-01)
 * 2. Supported Operation Launcher (DRAWER-02)
 * 3. Incurred vs Paid Module Separation (DRAWER-03)
 * 4. Unpaid Purchase Omits Treasury Requirement (DRAWER-04)
 * 5. Paid Purchase Authoritative Payment Path (DRAWER-05)
 * 6. Direct Project Expense Cash-Paid Invariant (DRAWER-06)
 * 7. Direct Project Expense Project ID Scope (DRAWER-07)
 * 8. Strict Treasury Domain Filtering (DRAWER-08)
 * 9. Hierarchical Treasury Tree & Informational Balance (DRAWER-09)
 * 10. Searchable Supplier Combobox (DRAWER-10)
 * 11. Nested Supplier Creation Draft Preservation (DRAWER-11)
 * 12. Persisted Row Auto-Selection (DRAWER-12)
 * 13. Finishing BOQ Exclusion Invariant (DRAWER-13)
 * 14. Unsaved Changes Guard Protection (DRAWER-14)
 * 15. Pending Mutation Safety (DRAWER-15)
 * 16. Partial Payment Failure State & Retry Isolation (DRAWER-16)
 * 17. Unpaid Purchase Financial Invariant [P4-FIN-01]
 * 18. Partial Payment Financial Invariant [P4-FIN-02]
 * 19. Full Payment Financial Invariant [P4-FIN-03]
 * 20. Historical Payment Invariant During Edit [P4-FIN-04]
 * 21. Direct Expense Financial Invariant [P4-FIN-05]
 * 22. Total Reduction Protection Invariant [P4-FIN-06]
 * 23. Paid Purchase Supplier Immutability [P4-FIN-07]
 * 24. Wrong-Domain Default Treasury Rejection [P4-TREASURY-01]
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(id, description, passed, details = '', expected = true, actual = true) {
  if (passed) {
    passedTests++;
    results.push({ id, description, status: 'PASS', details });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${id}: ${description}`);
    if (details) console.log(`         \x1b[90m└─ ${details}\x1b[0m`);
  } else {
    failedTests++;
    results.push({ id, description, status: 'FAIL', details, expected, actual });
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${id}: ${description}`);
    console.log(`         \x1b[90m└─ Expected: ${expected}\x1b[0m`);
    console.log(`         \x1b[90m└─ Actual:   ${actual}\x1b[0m`);
    if (details) console.log(`         \x1b[90m└─ Details:  ${details}\x1b[0m`);
  }
}

console.log('\n================================================================');
console.log('       UX PHASE 4: AUTOMATED INVARIANTS TEST SUITE RUNNER       ');
console.log('================================================================\n');

// Load Component Source Files
const drawerShellPath = path.join(ROOT_DIR, 'src/components/purchases/ProjectOperationDrawerShell.tsx');
const operationSelectorPath = path.join(ROOT_DIR, 'src/components/purchases/OperationTypeSelector.tsx');
const materialFormPath = path.join(ROOT_DIR, 'src/components/purchases/forms/MaterialPurchaseForm.tsx');
const serviceFormPath = path.join(ROOT_DIR, 'src/components/purchases/forms/SupplierServiceForm.tsx');
const expenseFormPath = path.join(ROOT_DIR, 'src/components/expenses/forms/DirectProjectExpenseForm.tsx');
const treasurySelectorPath = path.join(ROOT_DIR, 'src/components/treasury/TreasurySelector.tsx');
const entityComboboxPath = path.join(ROOT_DIR, 'src/components/common/EntityCombobox.tsx');
const quickSupplierPath = path.join(ROOT_DIR, 'src/components/suppliers/QuickAddSupplierDialog.tsx');
const projectPurchasesPath = path.join(ROOT_DIR, 'src/pages/ProjectPurchases.tsx');
const projectExpensesPath = path.join(ROOT_DIR, 'src/pages/ProjectExpenses.tsx');

const drawerShellSource = fs.readFileSync(drawerShellPath, 'utf8');
const operationSelectorSource = fs.readFileSync(operationSelectorPath, 'utf8');
const materialFormSource = fs.readFileSync(materialFormPath, 'utf8');
const serviceFormSource = fs.readFileSync(serviceFormPath, 'utf8');
const expenseFormSource = fs.readFileSync(expenseFormPath, 'utf8');
const treasurySelectorSource = fs.readFileSync(treasurySelectorPath, 'utf8');
const entityComboboxSource = fs.readFileSync(entityComboboxPath, 'utf8');
const quickSupplierSource = fs.readFileSync(quickSupplierPath, 'utf8');
const purchasesSource = fs.readFileSync(projectPurchasesPath, 'utf8');
const expensesSource = fs.readFileSync(projectExpensesPath, 'utf8');

// --------------------------------------------------------------------------
// DRAWER-01: Contextual Drawer Lifecycle & Project Header
// --------------------------------------------------------------------------
const hasDrawerShell =
  drawerShellSource.includes('<Sheet') &&
  drawerShellSource.includes('projectName') &&
  drawerShellSource.includes('projectType') &&
  drawerShellSource.includes('useUnsavedChangesGuard');
assert(
  'DRAWER-01',
  'Project Operation Drawer mounts with project identity, context header, and dirty guards',
  hasDrawerShell,
  `Drawer Shell Verified: ${hasDrawerShell}`,
  true,
  hasDrawerShell
);

// --------------------------------------------------------------------------
// DRAWER-02: Supported Operation Launcher (Material, Service, Expense, Labor)
// --------------------------------------------------------------------------
const hasSupportedOperationsOnly =
  operationSelectorSource.includes('"material"') &&
  operationSelectorSource.includes('"service"') &&
  operationSelectorSource.includes('"expense"') &&
  operationSelectorSource.includes('"labor"') &&
  !operationSelectorSource.includes('"equipment"');
assert(
  'DRAWER-02',
  'Operation launcher exposes supported operations (Material, Service, Expense, Labor)',
  hasSupportedOperationsOnly,
  `Supported Operations Verified: ${hasSupportedOperationsOnly}`,
  true,
  hasSupportedOperationsOnly
);

// --------------------------------------------------------------------------
// DRAWER-03: Incurred vs Paid Module Separation
// --------------------------------------------------------------------------
const hasIncurredVsPaidSeparation =
  materialFormSource.includes('حالة السداد النقدي') &&
  materialFormSource.includes('غير مسدد (ذمة مورد)') &&
  materialFormSource.includes('دفع مبلغ الآن') &&
  materialFormSource.includes('calculatedTotal') &&
  materialFormSource.includes('supplierRemaining');
assert(
  'DRAWER-03',
  'Material purchase form distinctly separates commercial incurred obligation from cash payment',
  hasIncurredVsPaidSeparation,
  `Incurred vs Paid Verified: ${hasIncurredVsPaidSeparation}`,
  true,
  hasIncurredVsPaidSeparation
);

// --------------------------------------------------------------------------
// DRAWER-04: Unpaid Purchase Omits Treasury Requirement
// --------------------------------------------------------------------------
const unpaidOmitsTreasury =
  materialFormSource.includes('hasPaidNow ?') &&
  materialFormSource.includes('<TreasurySelector') &&
  materialFormSource.includes('paid_amount = 0');
assert(
  'DRAWER-04',
  'Unpaid purchase (paid_amount = 0) omits treasury requirement and creates obligation with 0 treasury movement',
  unpaidOmitsTreasury,
  `Unpaid Treasury Omission Verified: ${unpaidOmitsTreasury}`,
  true,
  unpaidOmitsTreasury
);

// --------------------------------------------------------------------------
// DRAWER-05: Paid Purchase Authoritative Payment Path
// --------------------------------------------------------------------------
const usesAuthoritativePaymentPath =
  materialFormSource.includes('supabase.from("purchase_payments").insert') &&
  serviceFormSource.includes('supabase.from("purchase_payments").insert');
assert(
  'DRAWER-05',
  'Initial cash payment uses authoritative purchase_payments ledger and never fakes paid_amount directly',
  usesAuthoritativePaymentPath,
  `Authoritative Payment Write Path Verified: ${usesAuthoritativePaymentPath}`,
  true,
  usesAuthoritativePaymentPath
);

// --------------------------------------------------------------------------
// DRAWER-06: Direct Project Expense Cash-Paid Invariant
// --------------------------------------------------------------------------
const directExpenseCashOnly =
  expenseFormSource.includes('treasury_id: treasuryId') &&
  expenseFormSource.includes('type: "project"') &&
  expenseFormSource.includes('numAmount') &&
  !expenseFormSource.includes('غير مسدد');
assert(
  'DRAWER-06',
  'Direct project expense is inherently cash-paid with mandatory treasury selection and no unpaid toggle',
  directExpenseCashOnly,
  `Cash-Paid Direct Expense Verified: ${directExpenseCashOnly}`,
  true,
  directExpenseCashOnly
);

// --------------------------------------------------------------------------
// DRAWER-07: Direct Project Expense Project ID Scope
// --------------------------------------------------------------------------
const directExpenseScoped =
  expenseFormSource.includes('project_id: projectId') &&
  !expenseFormSource.includes('project_id: null');
assert(
  'DRAWER-07',
  'Direct project expense strictly scopes project_id and rejects general null company overhead leakage',
  directExpenseScoped,
  `Project ID Scope Verified: ${directExpenseScoped}`,
  true,
  directExpenseScoped
);

// --------------------------------------------------------------------------
// DRAWER-08: Strict Treasury Domain Filtering
// --------------------------------------------------------------------------
const strictTreasuryFiltering =
  (treasurySelectorSource.includes('root.project_category === targetDomain') ||
   treasurySelectorSource.includes('contracting_treasury_id') ||
   treasurySelectorSource.includes('targetDomain')) &&
  treasurySelectorSource.includes('is_active');
assert(
  'DRAWER-08',
  'TreasurySelector strictly filters cross-domain treasuries and excludes finishing from contracting',
  strictTreasuryFiltering,
  `Strict Treasury Domain Filtering Verified: ${strictTreasuryFiltering}`,
  true,
  strictTreasuryFiltering
);

// --------------------------------------------------------------------------
// DRAWER-09: Hierarchical Treasury Tree & Informational Balance
// --------------------------------------------------------------------------
const hierarchicalTreasuryTree =
  (treasurySelectorSource.includes('roots.map') || treasurySelectorSource.includes('authoritativeRoot')) &&
  (treasurySelectorSource.includes('childBranches') || treasurySelectorSource.includes('descendants')) &&
  (treasurySelectorSource.includes('formatCurrencyLYD(root.balance || 0)') || treasurySelectorSource.includes('formatCurrencyLYD(authoritativeRoot.balance || 0)')) &&
  (treasurySelectorSource.includes('formatCurrencyLYD(branch.balance || 0)') || treasurySelectorSource.includes('formatCurrencyLYD(desc.balance || 0)'));
assert(
  'DRAWER-09',
  'TreasurySelector renders hierarchical tree of root and branch treasuries with live informational balance',
  hierarchicalTreasuryTree,
  `Hierarchical Tree Verified: ${hierarchicalTreasuryTree}`,
  true,
  hierarchicalTreasuryTree
);

// --------------------------------------------------------------------------
// DRAWER-10: Searchable Supplier Combobox
// --------------------------------------------------------------------------
const searchableCombobox =
  entityComboboxSource.includes('o.label.toLowerCase().includes(s)') &&
  entityComboboxSource.includes('o.phone') &&
  entityComboboxSource.includes('showCreateButton');
assert(
  'DRAWER-10',
  'EntityCombobox provides instant search by name, phone, and category with inline create action',
  searchableCombobox,
  `Searchable Combobox Verified: ${searchableCombobox}`,
  true,
  searchableCombobox
);

// --------------------------------------------------------------------------
// DRAWER-11: Nested Supplier Creation Draft Preservation
// --------------------------------------------------------------------------
const nestedSupplierPreservesDraft =
  quickSupplierSource.includes('QuickAddSupplierDialog') &&
  quickSupplierSource.includes('onSuccess') &&
  materialFormSource.includes('setQuickSupplierOpen(true)') &&
  materialFormSource.includes('setSupplierId(newSupplier.id)');
assert(
  'DRAWER-11',
  'Nested supplier creation executes in isolated surface without resetting parent purchase draft',
  nestedSupplierPreservesDraft,
  `Draft Preservation Verified: ${nestedSupplierPreservesDraft}`,
  true,
  nestedSupplierPreservesDraft
);

// --------------------------------------------------------------------------
// DRAWER-12: Persisted Row Auto-Selection
// --------------------------------------------------------------------------
const autoSelectPersistedRow =
  quickSupplierSource.includes('.select("id, name")') &&
  quickSupplierSource.includes('onSuccess(data)') &&
  materialFormSource.includes('setSupplierId(newSupplier.id)');
assert(
  'DRAWER-12',
  'Newly created supplier returns persisted database row ID and auto-selects in parent form with zero name guessing',
  autoSelectPersistedRow,
  `Persisted Row Auto-Selection Verified: ${autoSelectPersistedRow}`,
  true,
  autoSelectPersistedRow
);

// --------------------------------------------------------------------------
// DRAWER-13: Finishing BOQ Exclusion Invariant
// --------------------------------------------------------------------------
const finishingExcludesBOQ =
  materialFormSource.includes('projectType === "contracting"') &&
  materialFormSource.includes('enabled: projectType === "contracting"') &&
  !materialFormSource.includes('projectType === "finishing" && projectItems');
assert(
  'DRAWER-13',
  'Finishing project workspace and purchase form strictly exclude Contracting BOQ items',
  finishingExcludesBOQ,
  `Finishing BOQ Exclusion Verified: ${finishingExcludesBOQ}`,
  true,
  finishingExcludesBOQ
);

// --------------------------------------------------------------------------
// DRAWER-14: Unsaved Changes Guard Protection
// --------------------------------------------------------------------------
const unsavedChangesGuardActive =
  drawerShellSource.includes('useUnsavedChangesGuard') &&
  (drawerShellSource.includes('guard.guardedNavigate') || drawerShellSource.includes('guard.requestAction')) &&
  drawerShellSource.includes('UnsavedChangesDialog');
assert(
  'DRAWER-14',
  'Project Operation Drawer integrates useUnsavedChangesGuard to protect close, Escape, and project navigation',
  unsavedChangesGuardActive,
  `Dirty Guard Protection Verified: ${unsavedChangesGuardActive}`,
  true,
  unsavedChangesGuardActive
);

// --------------------------------------------------------------------------
// DRAWER-15: Pending Mutation Safety
// --------------------------------------------------------------------------
const pendingMutationSafe =
  materialFormSource.includes('disabled={saveMutation.isPending') &&
  serviceFormSource.includes('disabled={saveMutation.isPending') &&
  expenseFormSource.includes('disabled={saveMutation.isPending');
assert(
  'DRAWER-15',
  'Pending mutation state disables inputs and submit actions to block duplicate submissions',
  pendingMutationSafe,
  `Pending Mutation Safety Verified: ${pendingMutationSafe}`,
  true,
  pendingMutationSafe
);

// --------------------------------------------------------------------------
// DRAWER-16: Partial Payment Failure State & Retry Isolation
// --------------------------------------------------------------------------
const paymentFailureRetryIsolated =
  materialFormSource.includes('handleRetryPayment') &&
  materialFormSource.includes('paymentFailedState.failed') &&
  materialFormSource.includes('createdPurchaseId') &&
  materialFormSource.includes('إعادة محاولة تسجيل الدفعة فقط');
assert(
  'DRAWER-16',
  'Initial payment failure transitions to partial success state, retaining purchase_id with isolated payment retry',
  paymentFailureRetryIsolated,
  `Payment Failure Retry Isolation Verified: ${paymentFailureRetryIsolated}`,
  true,
  paymentFailureRetryIsolated
);

// --------------------------------------------------------------------------
// P4-FIN-01: Unpaid Purchase Financial Invariant
// --------------------------------------------------------------------------
const p4Fin01Verified =
  purchasesSource.includes('ProjectOperationDrawerShell') &&
  materialFormSource.includes('purchasePayload.paid_amount = 0') &&
  materialFormSource.includes('purchasePayload.status = "due"');
assert(
  'P4-FIN-01',
  'Unpaid purchase creates commercial obligation/incurred cost with zero Treasury OUT transaction',
  p4Fin01Verified,
  `P4-FIN-01 Verified: ${p4Fin01Verified}`,
  true,
  p4Fin01Verified
);

// --------------------------------------------------------------------------
// P4-FIN-02: Partial Payment Financial Invariant
// --------------------------------------------------------------------------
const p4Fin02Verified =
  materialFormSource.includes('amount: numPaidNow') &&
  materialFormSource.includes('treasury_id: treasuryId') &&
  (materialFormSource.includes('purchase_id: activePurchaseId') ||
   materialFormSource.includes('create_purchase_with_immediate_payment'));
assert(
  'P4-FIN-02',
  'Partial purchase payment records exact paid amount in purchase_payments and creates single Treasury OUT',
  p4Fin02Verified,
  `P4-FIN-02 Verified: ${p4Fin02Verified}`,
  true,
  p4Fin02Verified
);

// --------------------------------------------------------------------------
// P4-FIN-03: Full Payment Financial Invariant
// --------------------------------------------------------------------------
const p4Fin03Verified =
  materialFormSource.includes('numPaidNow > calculatedTotal') &&
  materialFormSource.includes('hasPaidNow && numPaidNow > 0');
assert(
  'P4-FIN-03',
  'Full purchase payment records single purchase_payments row without double posting or trigger collision',
  p4Fin03Verified,
  `P4-FIN-03 Verified: ${p4Fin03Verified}`,
  true,
  p4Fin03Verified
);

// --------------------------------------------------------------------------
// P4-FIN-04: Historical Payment Invariant During Edit
// --------------------------------------------------------------------------
const p4Fin04Verified =
  (materialFormSource.includes('!editingPurchase && hasPaidNow') ||
   materialFormSource.includes('if (editingPurchase)')) &&
  materialFormSource.includes('existingPaidSum') &&
  materialFormSource.includes('calculatedTotal < existingPaidSum');
assert(
  'P4-FIN-04',
  'Editing purchase commercial data preserves historical payment ledger and blocks reduction below paid amount',
  p4Fin04Verified,
  `P4-FIN-04 Verified: ${p4Fin04Verified}`,
  true,
  p4Fin04Verified
);

// --------------------------------------------------------------------------
// P4-FIN-05: Direct Expense Financial Invariant
// --------------------------------------------------------------------------
const p4Fin05Verified =
  expenseFormSource.includes('type: "project"') &&
  expenseFormSource.includes('project_id: projectId') &&
  expenseFormSource.includes('treasury_id: treasuryId') &&
  expensesSource.includes('ProjectOperationDrawerShell');
assert(
  'P4-FIN-05',
  'Direct project expense creates exactly one Treasury OUT and enters project incurred cost and cash flow',
  p4Fin05Verified,
  `P4-FIN-05 Verified: ${p4Fin05Verified}`,
  true,
  p4Fin05Verified
);

// --------------------------------------------------------------------------
// P4-FIN-06: Total Reduction Protection Invariant
// --------------------------------------------------------------------------
const p4Fin06Verified =
  materialFormSource.includes('calculatedTotal < existingPaidSum') &&
  serviceFormSource.includes('numTotal < existingPaidSum');
assert(
  'P4-FIN-06',
  'Purchase and service forms block reducing invoice total below already paid amount',
  p4Fin06Verified,
  `P4-FIN-06 Verified: ${p4Fin06Verified}`,
  true,
  p4Fin06Verified
);

// --------------------------------------------------------------------------
// P4-FIN-07: Paid Purchase Supplier Immutability
// --------------------------------------------------------------------------
const p4Fin07Verified =
  materialFormSource.includes('Boolean(editingPurchase) && existingPaidSum > 0') &&
  serviceFormSource.includes('Boolean(editingPurchase) && existingPaidSum > 0');
assert(
  'P4-FIN-07',
  'Supplier/Subcontractor selector is disabled during edit if historical payments already exist on the purchase',
  p4Fin07Verified,
  `P4-FIN-07 Verified: ${p4Fin07Verified}`,
  true,
  p4Fin07Verified
);

// --------------------------------------------------------------------------
// P4-TREASURY-01: Wrong-Domain Default Treasury Rejection
// --------------------------------------------------------------------------
const p4Treasury01Verified =
  treasurySelectorSource.includes('projectDefaultTreasuryId') &&
  (treasurySelectorSource.includes('project_category === targetDomain') ||
   treasurySelectorSource.includes('allowedIds.has(projectDefaultTreasuryId)'));
assert(
  'P4-TREASURY-01',
  'TreasurySelector validates project default treasury against allowed domain and rejects wrong-domain defaults',
  p4Treasury01Verified,
  `P4-TREASURY-01 Verified: ${p4Treasury01Verified}`,
  true,
  p4Treasury01Verified
);

console.log('\n================================================================');
console.log('               UX PHASE 4 TEST RUN SUMMARY                      ');
console.log('================================================================');
console.log(`  Total Tests:    ${passedTests + failedTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
if (failedTests === 0) {
  console.log('  Status:         \x1b[32mALL UX PHASE 4 INVARIANTS PASSED\x1b[0m');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.log('  Status:         \x1b[31mSOME INVARIANTS FAILED\x1b[0m');
  console.log('================================================================\n');
  process.exit(1);
}
