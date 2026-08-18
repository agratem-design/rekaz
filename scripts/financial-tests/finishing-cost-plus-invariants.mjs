/**
 * FC-01: Finishing Cost-Plus & Project-Level Client Payment Invariants Test Suite
 */

import { calculateProjectFinancials } from './financialCore.mjs';

export async function runFinishingCostPlusInvariants(harness) {
  console.log('\n--- EXECUTING FC-01 FINISHING COST-PLUS & CLIENT PAYMENT INVARIANTS ---');

  // TEST DATASET: Finishing Project with 10% Fee
  const finishingProject = {
    id: 'proj-finishing-001',
    project_type: 'finishing',
    finishing_percentage: 10,
    budget: 0,
  };

  const samplePurchases = [
    { id: 'pur-1', total_amount: 8000, purchase_type: 'material', supplier_id: 'sup-1' },
    { id: 'pur-2', total_amount: 2000, purchase_type: 'service', supplier_id: 'sup-2' },
    { id: 'pur-3', total_amount: 3000, purchase_type: 'rental', rental_id: 'rent-1' },
  ];

  const sampleTechProgress = [
    { id: 'prog-1', earned_amount: 5000 },
  ];

  const sampleExpenses = [
    { id: 'exp-1', amount: 2000, project_id: 'proj-finishing-001' }, // Direct project expense
    { id: 'exp-gen', amount: 1500, project_id: null }, // General company expense (MUST BE EXCLUDED)
  ];

  const samplePurchasePayments = [
    { id: 'pp-1', purchase_id: 'pur-1', amount: 4000 }, // Supplier paid 4k out of 8k
  ];

  // FINISHING-01: Eligible Direct Incurred Cost Base
  // 8000 (mat) + 2000 (svc) + 5000 (tech) + 3000 (rent) + 2000 (exp) = 20,000 LYD
  const resultInitial = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: samplePurchasePayments,
    clientPayments: [],
  });

  harness.assert(
    'FINISHING-01',
    'Eligible Direct Cost Base Aggregates All 5 Direct Resources (20,000 LYD)',
    resultInitial.eligibleCostBase === 20000,
    `Materials: ${resultInitial.breakdown.materials}, Svc: ${resultInitial.breakdown.supplierServices}, Tech: ${resultInitial.breakdown.technicianEarned}, Rent: ${resultInitial.breakdown.equipmentRentals}, Exp: ${resultInitial.breakdown.directProjectExpenses}`,
    20000,
    resultInitial.eligibleCostBase
  );

  // FINISHING-02: Company Fee = Base * Percentage
  // 20,000 * 10% = 2,000 LYD
  harness.assert(
    'FINISHING-02',
    'Company Fee Correctly Computed on Incurred Direct Base (2,000 LYD)',
    resultInitial.companyFee === 2000,
    `Fee = ${resultInitial.companyFee} LYD (10% on 20,000)`,
    2000,
    resultInitial.companyFee
  );

  // FINISHING-03: Client Obligation = Base + Fee
  // 20,000 + 2,000 = 22,000 LYD
  harness.assert(
    'FINISHING-03',
    'Finishing Client Obligation = Base + Company Fee (22,000 LYD)',
    resultInitial.clientObligation === 22000,
    `Obligation = ${resultInitial.clientObligation} LYD`,
    22000,
    resultInitial.clientObligation
  );

  // FINISHING-04: Client Paid = 0 when no payments
  harness.assert(
    'FINISHING-04',
    'Client Paid Strictly Sourced from client_payments (0 LYD)',
    resultInitial.clientPaid === 0,
    `Client Paid = ${resultInitial.clientPaid} LYD`,
    0,
    resultInitial.clientPaid
  );

  // FINISHING-05: Client Remaining = Obligation - Paid
  harness.assert(
    'FINISHING-05',
    'Client Remaining = Obligation - Paid (22,000 LYD)',
    resultInitial.clientRemaining === 22000,
    `Client Remaining = ${resultInitial.clientRemaining} LYD`,
    22000,
    resultInitial.clientRemaining
  );

  // FINISHING-06: General Company Expenses Strictly Excluded
  harness.assert(
    'FINISHING-06',
    'General Company Expense (project_id IS NULL) Excluded from Base',
    resultInitial.breakdown.directProjectExpenses === 2000,
    `Direct Project Expenses = ${resultInitial.breakdown.directProjectExpenses} LYD (1,500 general expense excluded)`,
    2000,
    resultInitial.breakdown.directProjectExpenses
  );

  // DEDUP-01: Technician Progress vs Labor Purchases Deduplication
  const resultWithDuplicateLabor = calculateProjectFinancials({
    project: finishingProject,
    purchases: [
      ...samplePurchases,
      { id: 'pur-lab-mirror', total_amount: 5000, purchase_type: 'labor', technician_id: 'tech-1' },
    ],
    techProgressRecords: sampleTechProgress, // 5,000 earned
    expenses: sampleExpenses,
    purchasePayments: samplePurchasePayments,
    clientPayments: [],
  });

  harness.assert(
    'DEDUP-01',
    'Technician Progress & Labor Purchases Deduplicated (Exact 5,000 LYD, No Double Count)',
    resultWithDuplicateLabor.breakdown.technicianEarned === 5000 && resultWithDuplicateLabor.eligibleCostBase === 20000,
    `Technician Earned: ${resultWithDuplicateLabor.breakdown.technicianEarned} LYD, Base: ${resultWithDuplicateLabor.eligibleCostBase} LYD`,
    20000,
    resultWithDuplicateLabor.eligibleCostBase
  );

  // DEDUP-02: Equipment Rentals & Rental Purchases Deduplication
  const resultWithDuplicateRentals = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases, // contains pur-3 with rental_id: 'rent-1', amount: 3000
    techProgressRecords: sampleTechProgress,
    rentals: [{ id: 'rent-1', total_amount: 3000 }], // duplicate equipment_rentals table row
    expenses: sampleExpenses,
    purchasePayments: samplePurchasePayments,
    clientPayments: [],
  });

  harness.assert(
    'DEDUP-02',
    'Equipment Rentals & Rental Purchases Deduplicated (Exact 3,000 LYD, No Double Count)',
    resultWithDuplicateRentals.breakdown.equipmentRentals === 3000 && resultWithDuplicateRentals.eligibleCostBase === 20000,
    `Equipment Rentals: ${resultWithDuplicateRentals.breakdown.equipmentRentals} LYD, Base: ${resultWithDuplicateRentals.eligibleCostBase} LYD`,
    20000,
    resultWithDuplicateRentals.eligibleCostBase
  );

  // DEDUP-03: Isolated Standalone Rental Test (1,000 LYD Economic Rental)
  const isolatedRentalTest = calculateProjectFinancials({
    project: { id: 'p-rent-iso', project_type: 'finishing', finishing_percentage: 10 },
    purchases: [
      { id: 'pur-rent-1', total_amount: 1000, purchase_type: 'rental', rental_id: 'rent-iso-1' },
    ],
    rentals: [
      { id: 'rent-iso-1', total_amount: 1000 },
    ],
  });

  harness.assert(
    'DEDUP-03',
    'Economic Rental Cost 1,000 LYD = Exact 1,000 Incurred Cost (NOT 2,000 LYD)',
    isolatedRentalTest.breakdown.equipmentRentals === 1000 && isolatedRentalTest.eligibleCostBase === 1000 && isolatedRentalTest.clientObligation === 1100,
    `Rental: ${isolatedRentalTest.breakdown.equipmentRentals} LYD, Base: ${isolatedRentalTest.eligibleCostBase} LYD, Obligation: ${isolatedRentalTest.clientObligation} LYD`,
    1000,
    isolatedRentalTest.breakdown.equipmentRentals
  );

  // DEDUP-04: Standalone Labor Purchase Fallback (when zero progress records exist)
  const standaloneLaborTest = calculateProjectFinancials({
    project: { id: 'p-lab-fallback', project_type: 'finishing', finishing_percentage: 10 },
    purchases: [
      { id: 'pur-lab-1', total_amount: 5000, purchase_type: 'labor', technician_id: 'tech-1' },
    ],
    techProgressRecords: [], // Zero progress records -> fallback to standalone labor purchase
  });

  harness.assert(
    'DEDUP-04',
    'Standalone Labor Purchase Incurred as Fallback when Zero Progress Records (5,000 LYD)',
    standaloneLaborTest.breakdown.technicianEarned === 5000 && standaloneLaborTest.eligibleCostBase === 5000 && standaloneLaborTest.clientObligation === 5500,
    `Technician Earned: ${standaloneLaborTest.breakdown.technicianEarned} LYD, Base: ${standaloneLaborTest.eligibleCostBase} LYD, Obligation: ${standaloneLaborTest.clientObligation} LYD`,
    5000,
    standaloneLaborTest.breakdown.technicianEarned
  );

  // FINISHING-07: Changing Supplier Payment Does Not Alter Client Obligation
  const resultWithMoreSupplierPaid = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-1', purchase_id: 'pur-1', amount: 8000 }, // Paid in full
      { id: 'pp-2', purchase_id: 'pur-2', amount: 2000 }, // Paid in full
    ],
    clientPayments: [],
  });

  harness.assert(
    'FINISHING-07',
    'Changing Supplier Payment Does NOT Alter Client Obligation (22,000 LYD Invariant)',
    resultWithMoreSupplierPaid.clientObligation === 22000 && resultWithMoreSupplierPaid.cashFlow.supplierPaid === 10000,
    `Supplier Paid: ${resultWithMoreSupplierPaid.cashFlow.supplierPaid} LYD, Client Obligation: ${resultWithMoreSupplierPaid.clientObligation} LYD`,
    22000,
    resultWithMoreSupplierPaid.clientObligation
  );

  // FINISHING-08: Changing Technician Payment Does Not Alter Client Obligation
  const resultWithTechPaid = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-tech', purchase_id: 'pur-lab-1', amount: 5000 },
    ],
    clientPayments: [],
  });

  harness.assert(
    'FINISHING-08',
    'Changing Technician Payment Does NOT Alter Client Obligation (22,000 LYD Invariant)',
    resultWithTechPaid.clientObligation === 22000,
    `Client Obligation = ${resultWithTechPaid.clientObligation} LYD`,
    22000,
    resultWithTechPaid.clientObligation
  );

  // FINISHING-09: Golden Finishing 20k Base + 10% Fee = 22k Obligation Verification
  harness.assert(
    'FINISHING-09',
    'Golden Finishing Reconciliation: 20,000 Base + 10% = 22,000 Obligation',
    resultInitial.eligibleCostBase === 20000 && resultInitial.companyFee === 2000 && resultInitial.clientObligation === 22000,
    `Base: ${resultInitial.eligibleCostBase}, Fee: ${resultInitial.companyFee}, Obligation: ${resultInitial.clientObligation}`,
    22000,
    resultInitial.clientObligation
  );

  // FINISHING-10: Accrual Profitability = Company Fee = 2,000 LYD
  harness.assert(
    'FINISHING-10',
    'Accrual Gross Profit Exactly Matches Company Fee (2,000 LYD / 9.09%)',
    resultInitial.grossProfit === 2000 && Math.abs(resultInitial.profitMarginPercent - (2000 / 22000 * 100)) < 0.01,
    `Profit: ${resultInitial.grossProfit} LYD, Margin: ${resultInitial.profitMarginPercent.toFixed(2)}%`,
    2000,
    resultInitial.grossProfit
  );

  // FINISHING-11: Cash Flow Summary Calculation
  const purchasesWithLabor = [
    ...samplePurchases,
    { id: 'pur-lab-1', total_amount: 5000, purchase_type: 'labor' },
  ];

  const resultWithCash = calculateProjectFinancials({
    project: finishingProject,
    purchases: purchasesWithLabor,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-1', purchase_id: 'pur-1', amount: 4000 },
      { id: 'pp-tech', purchase_id: 'pur-lab-1', amount: 2000 },
    ],
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
    ],
  });

  // Cash In = 5,000
  // Cash Out = 4,000 (sup) + 2,000 (tech) + 2,000 (exp) = 8,000
  // Net Cash Flow = 5,000 - 8,000 = -3,000 LYD
  harness.assert(
    'FINISHING-11',
    'Cash Flow strictly calculated from payment entries (In: 5,000, Out: 8,000, Net: -3,000)',
    resultWithCash.cashFlow.actualCashIn === 5000 && resultWithCash.cashFlow.actualCashOut === 8000 && resultWithCash.cashFlow.netCashFlow === -3000,
    `Cash In: ${resultWithCash.cashFlow.actualCashIn}, Cash Out: ${resultWithCash.cashFlow.actualCashOut}, Net: ${resultWithCash.cashFlow.netCashFlow}`,
    -3000,
    resultWithCash.cashFlow.netCashFlow
  );

  // FINISHING-12: Accrual Profit != Net Cash Flow
  harness.assert(
    'FINISHING-12',
    'Accrual Profit (2,000 LYD) Strictly Independent from Net Cash Flow (-3,000 LYD)',
    resultWithCash.grossProfit !== resultWithCash.cashFlow.netCashFlow && resultWithCash.grossProfit === 2000 && resultWithCash.cashFlow.netCashFlow === -3000,
    `Accrual Profit: ${resultWithCash.grossProfit} LYD != Net Cash Flow: ${resultWithCash.cashFlow.netCashFlow} LYD`,
    true,
    resultWithCash.grossProfit !== resultWithCash.cashFlow.netCashFlow
  );

  // --------------------------------------------------------------------------
  // PROJECT-LEVEL CLIENT PAYMENT LIFECYCLE TESTS (CP-01 to CP-06)
  // --------------------------------------------------------------------------

  // TEST CP-01: First client payment of 5,000 LYD
  const testCP01 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-01',
    'TEST CP-01: First Client Payment 5,000 -> Paid = 5,000, Remaining = 17,000',
    testCP01.clientPaid === 5000 && testCP01.clientRemaining === 17000,
    `Paid: ${testCP01.clientPaid} LYD, Remaining: ${testCP01.clientRemaining} LYD`,
    17000,
    testCP01.clientRemaining
  );

  // TEST CP-02: Add second client payment of 3,000 LYD
  const testCP02 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
      { id: 'cp-2', amount: 3000, project_id: 'proj-finishing-001' },
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-02',
    'TEST CP-02: Second Payment +3,000 -> Paid = 8,000, Remaining = 14,000',
    testCP02.clientPaid === 8000 && testCP02.clientRemaining === 14000,
    `Paid: ${testCP02.clientPaid} LYD, Remaining: ${testCP02.clientRemaining} LYD`,
    14000,
    testCP02.clientRemaining
  );

  // TEST CP-03: Update second client payment: 3,000 -> 4,000 LYD
  const testCP03 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
      { id: 'cp-2', amount: 4000, project_id: 'proj-finishing-001' }, // updated from 3000 to 4000
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-03',
    'TEST CP-03: Update Payment 3,000 -> 4,000 -> Paid = 9,000, Remaining = 13,000',
    testCP03.clientPaid === 9000 && testCP03.clientRemaining === 13000,
    `Paid: ${testCP03.clientPaid} LYD, Remaining: ${testCP03.clientRemaining} LYD`,
    13000,
    testCP03.clientRemaining
  );

  // TEST CP-04: Delete/reverse second payment
  const testCP04 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' }, // second payment deleted
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-04',
    'TEST CP-04: Delete Second Payment -> Paid returns to 5,000, Remaining to 17,000',
    testCP04.clientPaid === 5000 && testCP04.clientRemaining === 17000,
    `Paid: ${testCP04.clientPaid} LYD, Remaining: ${testCP04.clientRemaining} LYD`,
    17000,
    testCP04.clientRemaining
  );

  // TEST CP-05: Change Supplier Payment -> Client Paid & Remaining Unchanged
  const testCP05 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-new-1', purchase_id: 'pur-1', amount: 7500 }, // modified supplier payment
    ],
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-05',
    'TEST CP-05: Supplier Payment Variation Leaves Client Paid & Remaining 100% Invariant',
    testCP05.clientPaid === 5000 && testCP05.clientRemaining === 17000 && testCP05.cashFlow.supplierPaid === 7500,
    `Client Paid: ${testCP05.clientPaid} LYD, Client Remaining: ${testCP05.clientRemaining} LYD, Supplier Paid: ${testCP05.cashFlow.supplierPaid} LYD`,
    17000,
    testCP05.clientRemaining
  );

  // TEST CP-06: Change Technician Payment -> Client Paid & Remaining Unchanged
  const testCP06 = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-tech-new', purchase_id: 'pur-lab-1', amount: 3500 },
    ],
    clientPayments: [
      { id: 'cp-1', amount: 5000, project_id: 'proj-finishing-001' },
    ],
  });

  harness.assert(
    'CLIENT-PROJECT-06',
    'TEST CP-06: Technician Payment Variation Leaves Client Paid & Remaining 100% Invariant',
    testCP06.clientPaid === 5000 && testCP06.clientRemaining === 17000,
    `Client Paid: ${testCP06.clientPaid} LYD, Client Remaining: ${testCP06.clientRemaining} LYD`,
    17000,
    testCP06.clientRemaining
  );

  // --------------------------------------------------------------------------
  // PERMANENT FORBIDDEN CROSS-SETTLEMENT INVARIANTS
  // --------------------------------------------------------------------------

  // NO-CROSS-SETTLEMENT-01: Client Payment affects ONLY Client Balance & Treasury IN
  const baseSupplierDue = resultInitial.cashFlow.supplierRemaining;
  const baseTechDue = resultInitial.cashFlow.technicianRemaining;
  const clientPayOnlyTest = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: samplePurchasePayments,
    clientPayments: [{ id: 'cp-x', amount: 12000, project_id: 'proj-finishing-001' }],
  });

  harness.assert(
    'NO-CROSS-SETTLEMENT-01',
    'Client Payment changes ONLY Client Paid/Remaining & Treasury IN (Supplier & Tech liabilities untouched)',
    clientPayOnlyTest.clientPaid === 12000 &&
    clientPayOnlyTest.clientRemaining === 10000 &&
    clientPayOnlyTest.cashFlow.supplierRemaining === baseSupplierDue &&
    clientPayOnlyTest.cashFlow.technicianRemaining === baseTechDue,
    `Client Paid: ${clientPayOnlyTest.clientPaid}, Client Rem: ${clientPayOnlyTest.clientRemaining}, Sup Rem: ${clientPayOnlyTest.cashFlow.supplierRemaining} (Expected: ${baseSupplierDue}), Tech Rem: ${clientPayOnlyTest.cashFlow.technicianRemaining} (Expected: ${baseTechDue})`,
    true,
    clientPayOnlyTest.cashFlow.supplierRemaining === baseSupplierDue && clientPayOnlyTest.cashFlow.technicianRemaining === baseTechDue
  );

  // NO-CROSS-SETTLEMENT-02: Supplier Payment affects ONLY Supplier Balance & Treasury OUT (Zero effect on Client Balance)
  const supPayOnlyTest = calculateProjectFinancials({
    project: finishingProject,
    purchases: samplePurchases,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-1', purchase_id: 'pur-1', amount: 8000 },
      { id: 'pp-2', purchase_id: 'pur-2', amount: 2000 },
    ],
    clientPayments: [{ id: 'cp-x', amount: 5000, project_id: 'proj-finishing-001' }],
  });

  harness.assert(
    'NO-CROSS-SETTLEMENT-02',
    'Supplier Payment changes ONLY Supplier Paid/Remaining & Treasury OUT (Zero effect on Client Balance)',
    supPayOnlyTest.cashFlow.supplierPaid === 10000 &&
    supPayOnlyTest.cashFlow.supplierRemaining === 3000 &&
    supPayOnlyTest.clientPaid === 5000 &&
    supPayOnlyTest.clientRemaining === 17000 &&
    supPayOnlyTest.clientObligation === 22000,
    `Supplier Paid: ${supPayOnlyTest.cashFlow.supplierPaid}, Client Paid: ${supPayOnlyTest.clientPaid} (Invariant 5000), Client Rem: ${supPayOnlyTest.clientRemaining} (Invariant 17000)`,
    17000,
    supPayOnlyTest.clientRemaining
  );

  // NO-CROSS-SETTLEMENT-03: Technician Payment affects ONLY Technician Balance & Treasury OUT (Zero effect on Client Balance)
  const techPayOnlyTest = calculateProjectFinancials({
    project: finishingProject,
    purchases: purchasesWithLabor,
    techProgressRecords: sampleTechProgress,
    expenses: sampleExpenses,
    purchasePayments: [
      { id: 'pp-tech', purchase_id: 'pur-lab-1', amount: 5000 },
    ],
    clientPayments: [{ id: 'cp-x', amount: 5000, project_id: 'proj-finishing-001' }],
  });

  harness.assert(
    'NO-CROSS-SETTLEMENT-03',
    'Technician Payment changes ONLY Technician Paid/Remaining & Treasury OUT (Zero effect on Client Balance)',
    techPayOnlyTest.cashFlow.technicianPaid === 5000 &&
    techPayOnlyTest.cashFlow.technicianRemaining === 0 &&
    techPayOnlyTest.clientPaid === 5000 &&
    techPayOnlyTest.clientRemaining === 17000 &&
    techPayOnlyTest.clientObligation === 22000,
    `Technician Paid: ${techPayOnlyTest.cashFlow.technicianPaid}, Client Paid: ${techPayOnlyTest.clientPaid} (Invariant 5000), Client Rem: ${techPayOnlyTest.clientRemaining} (Invariant 17000)`,
    17000,
    techPayOnlyTest.clientRemaining
  );
}
