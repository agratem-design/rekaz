/**
 * FC-02: Client Advance / Credit Ledger Invariants Test Suite (CREDIT-01 to CREDIT-14)
 * Single Source of Truth Automated Invariant Verification
 */

import {
  calculateProjectFinancials,
  calculateClientFinancials,
  validateCreditApplication,
  validateCashPaymentReversal,
} from './financialCore.mjs';

export async function runClientCreditInvariants(harness) {
  console.log('\n--- EXECUTING FC-02 CLIENT CREDIT & CROSS-PROJECT SETTLEMENT INVARIANTS ---');

  // DATASET: Client X with Project A (Finishing) and Project B (Contracting) and Project C (Finishing)
  const clientX = { id: 'client-x', name: 'العميل الفاضل X' };
  const clientY = { id: 'client-y', name: 'العميل الآخر Y' };

  const projectA = {
    id: 'proj-A',
    client_id: 'client-x',
    project_type: 'finishing',
    finishing_percentage: 10,
  };

  const projectB = {
    id: 'proj-B',
    client_id: 'client-x',
    project_type: 'contracting',
    budget: 12000,
  };

  const projectC = {
    id: 'proj-C',
    client_id: 'client-x',
    project_type: 'finishing',
    finishing_percentage: 10,
  };

  const projectY = {
    id: 'proj-Y-other',
    client_id: 'client-y',
    project_type: 'contracting',
    budget: 15000,
  };

  // Project A has 20,000 LYD obligation (18,181.82 base + 10% or explicit direct cost)
  const projectAPurchases = [
    { id: 'pur-A-1', project_id: 'proj-A', total_amount: 15000, purchase_type: 'material' },
  ];
  const projectAExpenses = [
    { id: 'exp-A-1', project_id: 'proj-A', amount: 5000 }, // 15k + 5k = 20k base -> 22,000 obligation
  ];

  // For testing exact 20,000 obligation, let's use contracting contract on project A or specific finishing base:
  // Base = 18,181.818... OR let's use fixed contract of 20,000 on Project A
  const projectAContract = [{ id: 'cnt-A', project_id: 'proj-A', amount: 20000, status: 'active' }];
  const projectA_contracting = { id: 'proj-A', client_id: 'client-x', project_type: 'contracting' };

  // --------------------------------------------------------------------------
  // CREDIT-01: Overpayment creates exact client credit
  // Project A: Obligation = 20,000, Cash Payment = 25,000
  // Expected: Project A Remaining = 0, Available Credit = 5,000, Treasury IN = 25,000
  // --------------------------------------------------------------------------
  const clientDataInitial = {
    client: clientX,
    projects: [projectA_contracting, projectB, projectC],
    contracts: [
      { id: 'cnt-A', project_id: 'proj-A', amount: 20000, status: 'active' },
      { id: 'cnt-B', project_id: 'proj-B', amount: 12000, status: 'active' },
    ],
    clientPayments: [
      { id: 'cp-A-1', client_id: 'client-x', project_id: 'proj-A', amount: 25000, date: '2026-08-16' },
    ],
    creditApplications: [],
  };

  const clientFin01 = calculateClientFinancials(clientDataInitial);
  const projASummary01 = clientFin01.projectSummaries.find(p => p.projectId === 'proj-A');

  harness.assert(
    'CREDIT-01',
    'Overpayment on Project A Creates Exact Client Credit (5,000 LYD) and Closes Project (Remaining: 0)',
    projASummary01.clientRemaining === 0 &&
    projASummary01.excessCashGenerated === 5000 &&
    clientFin01.clientAvailableCredit === 5000 &&
    projASummary01.cashReceived === 25000,
    `Project A Remaining: ${projASummary01.clientRemaining} LYD, Excess Generated: ${projASummary01.excessCashGenerated} LYD, Client Available Credit: ${clientFin01.clientAvailableCredit} LYD`,
    5000,
    clientFin01.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-02: Apply 5,000 credit to future same-client project (Project B)
  // Project B: Obligation = 12,000. Apply 5,000 credit.
  // Expected: Project B Credit Applied = 5,000, Remaining = 7,000, Client Credit = 0, Treasury Delta = 0
  // --------------------------------------------------------------------------
  const clientDataWithApp = {
    ...clientDataInitial,
    creditApplications: [
      {
        id: 'ca-1',
        client_id: 'client-x',
        originating_payment_id: 'cp-A-1',
        target_project_id: 'proj-B',
        amount: 5000,
        status: 'applied',
        date: '2026-08-16',
      },
    ],
  };

  const clientFin02 = calculateClientFinancials(clientDataWithApp);
  const projBSummary02 = clientFin02.projectSummaries.find(p => p.projectId === 'proj-B');

  harness.assert(
    'CREDIT-02',
    'Apply Credit to Future Same-Client Project B (Credit Applied: 5,000, Remaining: 7,000, Available: 0)',
    projBSummary02.creditApplied === 5000 &&
    projBSummary02.clientRemaining === 7000 &&
    projBSummary02.cashReceived === 0 &&
    clientFin02.clientAvailableCredit === 0,
    `Project B Credit Applied: ${projBSummary02.creditApplied} LYD, Project B Remaining: ${projBSummary02.clientRemaining} LYD, Client Available Credit: ${clientFin02.clientAvailableCredit} LYD`,
    7000,
    projBSummary02.clientRemaining
  );

  // --------------------------------------------------------------------------
  // CREDIT-03: Cross-client credit application is blocked
  // Try to apply Client X credit to Project Y owned by Client Y
  // --------------------------------------------------------------------------
  const crossClientValidation = validateCreditApplication({
    clientId: 'client-x',
    targetProjectId: 'proj-Y-other',
    amount: 5000,
    clientData: {
      client: clientX,
      projects: [projectA_contracting, projectB, projectY],
      contracts: clientDataInitial.contracts,
      clientPayments: clientDataInitial.clientPayments,
      creditApplications: [],
    },
  });

  harness.assert(
    'CREDIT-03',
    'Cross-Client Credit Application is Strictly Blocked (Different Client ID)',
    crossClientValidation.isValid === false && Boolean(crossClientValidation.error?.includes('حظر')),
    `Validation Result: isValid=${crossClientValidation.isValid}, Error: ${crossClientValidation.error}`,
    false,
    crossClientValidation.isValid
  );

  // --------------------------------------------------------------------------
  // CREDIT-04: Partial application across multiple projects
  // Total Credit = 10,000. Apply 4,000 to Project B, then 3,000 to Project C.
  // Expected: Available Credit = 3,000
  // --------------------------------------------------------------------------
  const clientDataPartial = {
    client: clientX,
    projects: [
      projectA_contracting,
      projectB,
      { id: 'proj-C', client_id: 'client-x', project_type: 'contracting' },
    ],
    contracts: [
      { id: 'cnt-A', project_id: 'proj-A', amount: 20000, status: 'active' },
      { id: 'cnt-B', project_id: 'proj-B', amount: 12000, status: 'active' },
      { id: 'cnt-C', project_id: 'proj-C', amount: 8000, status: 'active' },
    ],
    clientPayments: [
      { id: 'cp-A-10k', client_id: 'client-x', project_id: 'proj-A', amount: 30000, date: '2026-08-16' }, // 10k excess
    ],
    creditApplications: [
      { id: 'ca-part-1', client_id: 'client-x', target_project_id: 'proj-B', amount: 4000, status: 'applied' },
      { id: 'ca-part-2', client_id: 'client-x', target_project_id: 'proj-C', amount: 3000, status: 'applied' },
    ],
  };

  const clientFin04 = calculateClientFinancials(clientDataPartial);
  const projBSummary04 = clientFin04.projectSummaries.find(p => p.projectId === 'proj-B');
  const projCSummary04 = clientFin04.projectSummaries.find(p => p.projectId === 'proj-C');

  harness.assert(
    'CREDIT-04',
    'Partial Credit Applications (4,000 to B + 3,000 to C -> Exactly 3,000 Available Credit Left)',
    clientFin04.totalCreditCreated === 10000 &&
    clientFin04.totalCreditApplied === 7000 &&
    clientFin04.clientAvailableCredit === 3000 &&
    projBSummary04.clientRemaining === 8000 &&
    projCSummary04.clientRemaining === 5000,
    `Total Created: ${clientFin04.totalCreditCreated} LYD, Applied: ${clientFin04.totalCreditApplied} LYD, Available: ${clientFin04.clientAvailableCredit} LYD`,
    3000,
    clientFin04.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-05: Reversal of credit application restores exact credit
  // Reverse 3,000 application to Project C
  // Expected: Project C remaining increases by 3,000 (to 8,000), Available returns to 6,000
  // --------------------------------------------------------------------------
  const clientDataReversed = {
    ...clientDataPartial,
    creditApplications: [
      { id: 'ca-part-1', client_id: 'client-x', target_project_id: 'proj-B', amount: 4000, status: 'applied' },
      { id: 'ca-part-2', client_id: 'client-x', target_project_id: 'proj-C', amount: 3000, status: 'reversed' }, // REVERSED
    ],
  };

  const clientFin05 = calculateClientFinancials(clientDataReversed);
  const projCSummary05 = clientFin05.projectSummaries.find(p => p.projectId === 'proj-C');

  harness.assert(
    'CREDIT-05',
    'Credit Application Reversal Restores Exact Available Credit (6,000 LYD) and Unsettles Project C',
    clientFin05.totalCreditApplied === 4000 &&
    clientFin05.clientAvailableCredit === 6000 &&
    projCSummary05.clientRemaining === 8000 &&
    projCSummary05.creditApplied === 0,
    `Project C Remaining: ${projCSummary05.clientRemaining} LYD, Client Available Credit: ${clientFin05.clientAvailableCredit} LYD`,
    6000,
    clientFin05.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-06: Credit application creates zero Treasury transaction (Pure Accrual / No Cash Delta)
  // --------------------------------------------------------------------------
  const projBSummaryCash = projBSummary02.cashFlow;

  harness.assert(
    'CREDIT-06',
    'Credit Application Generates Zero Cash Inflow on Target Project (Cash In: 0 LYD)',
    projBSummaryCash.actualCashIn === 0 && projBSummary02.cashReceived === 0,
    `Project B Cash In: ${projBSummaryCash.actualCashIn} LYD, Cash Received: ${projBSummary02.cashReceived} LYD`,
    0,
    projBSummaryCash.actualCashIn
  );

  // --------------------------------------------------------------------------
  // CREDIT-07: Credit application does not alter Supplier or Technician liabilities
  // --------------------------------------------------------------------------
  const projBWithPurchases = calculateProjectFinancials({
    project: projectB,
    contracts: [{ amount: 12000, status: 'active' }],
    purchases: [{ id: 'pur-B-1', total_amount: 4000, purchase_type: 'material' }],
    creditApplications: [{ id: 'ca-1', target_project_id: 'proj-B', amount: 5000, status: 'applied' }],
  });

  harness.assert(
    'CREDIT-07',
    'Credit Application Leaves Supplier Remaining Liabilities 100% Invariant (4,000 LYD)',
    projBWithPurchases.cashFlow.supplierRemaining === 4000 && projBWithPurchases.clientRemaining === 7000,
    `Supplier Remaining: ${projBWithPurchases.cashFlow.supplierRemaining} LYD, Project B Client Remaining: ${projBWithPurchases.clientRemaining} LYD`,
    4000,
    projBWithPurchases.cashFlow.supplierRemaining
  );

  // --------------------------------------------------------------------------
  // CREDIT-08: Supplier/Technician payments do not change Client Credit
  // --------------------------------------------------------------------------
  const clientDataWithSupPay = {
    ...clientDataInitial,
    purchasePayments: [{ id: 'pp-sup-1', purchase_id: 'pur-A-1', amount: 5000 }],
  };
  const clientFin08 = calculateClientFinancials(clientDataWithSupPay);

  harness.assert(
    'CREDIT-08',
    'Supplier/Technician Cash Payment Leaves Client Available Credit 100% Invariant (5,000 LYD)',
    clientFin08.clientAvailableCredit === 5000,
    `Client Available Credit: ${clientFin08.clientAvailableCredit} LYD`,
    5000,
    clientFin08.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-09: General expenses do not change Client Credit
  // --------------------------------------------------------------------------
  const clientDataWithGenExp = {
    ...clientDataInitial,
    expenses: [{ id: 'exp-gen-1', project_id: null, amount: 2500 }],
  };
  const clientFin09 = calculateClientFinancials(clientDataWithGenExp);

  harness.assert(
    'CREDIT-09',
    'General Company Overhead Expense (project_id IS NULL) Leaves Client Credit 100% Invariant (5,000 LYD)',
    clientFin09.clientAvailableCredit === 5000,
    `Client Available Credit: ${clientFin09.clientAvailableCredit} LYD`,
    5000,
    clientFin09.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-10: Protection against unsafe original receipt deletion when credit consumed
  // Try to delete cp-A-1 (25k cash, 5k excess) while 5k has already been applied to Project B
  // --------------------------------------------------------------------------
  const unsafeReversalCheck = validateCashPaymentReversal({
    paymentId: 'cp-A-1',
    clientData: clientDataWithApp, // where ca-1 has consumed 5,000 credit on proj-B
  });

  harness.assert(
    'CREDIT-10',
    'Original Cash Receipt Deletion Blocked when Generated Credit is Already Consumed Downstream',
    unsafeReversalCheck.canReverse === false && Boolean(unsafeReversalCheck.error?.includes('حظر أمان')),
    `Can Reverse: ${unsafeReversalCheck.canReverse}, Error Message: ${unsafeReversalCheck.error}`,
    false,
    unsafeReversalCheck.canReverse
  );

  // --------------------------------------------------------------------------
  // CREDIT-11: Contracting target project can consume same-client credit
  // --------------------------------------------------------------------------
  harness.assert(
    'CREDIT-11',
    'Contracting Target Project Successfully Settled by Applied Credit (Project B Remaining: 7,000 LYD)',
    projBSummary02.projectType === 'contracting' && projBSummary02.clientRemaining === 7000,
    `Target Type: ${projBSummary02.projectType}, Remaining: ${projBSummary02.clientRemaining} LYD`,
    7000,
    projBSummary02.clientRemaining
  );

  // --------------------------------------------------------------------------
  // CREDIT-12: Finishing target project can consume same-client credit
  // Target Project C is Finishing with 5,000 direct cost + 10% = 5,500 obligation.
  // Apply 3,000 credit -> Remaining = 2,500
  // --------------------------------------------------------------------------
  const clientDataFinishingTarget = {
    client: clientX,
    projects: [
      projectA_contracting,
      { id: 'proj-C-fin', client_id: 'client-x', project_type: 'finishing', finishing_percentage: 10 },
    ],
    contracts: [{ id: 'cnt-A', project_id: 'proj-A', amount: 20000, status: 'active' }],
    purchases: [{ id: 'pur-C-1', project_id: 'proj-C-fin', total_amount: 5000, purchase_type: 'material' }],
    clientPayments: [
      { id: 'cp-A-1', client_id: 'client-x', project_id: 'proj-A', amount: 25000, date: '2026-08-16' },
    ],
    creditApplications: [
      { id: 'ca-to-fin', client_id: 'client-x', target_project_id: 'proj-C-fin', amount: 3000, status: 'applied' },
    ],
  };

  const clientFin12 = calculateClientFinancials(clientDataFinishingTarget);
  const projCFinSummary = clientFin12.projectSummaries.find(p => p.projectId === 'proj-C-fin');

  harness.assert(
    'CREDIT-12',
    'Finishing Target Project Consumes Client Credit (Obligation: 5,500, Applied: 3,000 -> Remaining: 2,500)',
    projCFinSummary.clientObligation === 5500 &&
    projCFinSummary.creditApplied === 3000 &&
    projCFinSummary.clientRemaining === 2500,
    `Obligation: ${projCFinSummary.clientObligation} LYD, Credit Applied: ${projCFinSummary.creditApplied} LYD, Remaining: ${projCFinSummary.clientRemaining} LYD`,
    2500,
    projCFinSummary.clientRemaining
  );

  // --------------------------------------------------------------------------
  // CREDIT-13: Client aggregate credit equals created minus applied plus reversed
  // --------------------------------------------------------------------------
  const creditBalanceFormulaCheck =
    clientFin04.clientAvailableCredit === (clientFin04.totalCreditCreated - clientFin04.totalCreditApplied);

  harness.assert(
    'CREDIT-13',
    'Client Available Credit Exact Formula: Available = Created (10,000) - Applied (7,000) = 3,000 LYD',
    creditBalanceFormulaCheck && clientFin04.clientAvailableCredit === 3000,
    `Available: ${clientFin04.clientAvailableCredit} LYD = Created: ${clientFin04.totalCreditCreated} - Applied: ${clientFin04.totalCreditApplied}`,
    3000,
    clientFin04.clientAvailableCredit
  );

  // --------------------------------------------------------------------------
  // CREDIT-14: Cross-project cash non-duplication / Golden Cash Invariance
  // Original cash receipt: 25,000 LYD.
  // Apply 5,000 credit to Project B.
  // Total cash collected across all client projects must equal 25,000 LYD (NOT 30,000 LYD).
  // --------------------------------------------------------------------------
  const totalClientCash = clientFin02.totalCashReceived;
  const sumOfProjectCash = clientFin02.projectSummaries.reduce((sum, ps) => sum + ps.cashReceived, 0);

  harness.assert(
    'CREDIT-14',
    'Golden Cash Invariance: Total Company Cash Received = Exact 25,000 LYD (Zero Double-Count)',
    totalClientCash === 25000 && sumOfProjectCash === 25000,
    `Total Client Cash: ${totalClientCash} LYD, Sum of Project Cash: ${sumOfProjectCash} LYD (NOT 30,000 LYD)`,
    25000,
    totalClientCash
  );
}
