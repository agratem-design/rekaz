/**
 * Financial Core Domain Calculation Module (Single Source of Truth)
 * منظومة ركاز / الفارس الذهبي لإدارة المقاولات والتشطيبات
 * 
 * Rules:
 * 1. CONTRACTING: Client Obligation = Contract Value (or BOQ Items Total -> fallback Budget)
 * 2. FINISHING: Cost-Plus Management Model:
 *    - Eligible Direct Incurred Cost Base = Materials + Services + Technician Earned Work + Equipment Rentals + Direct Project Expenses
 *    - Company Fee = Eligible Cost Base * (Finishing Percentage / 100)
 *    - Client Obligation = Eligible Cost Base + Company Fee
 * 3. Client Payment Settlement (FC-01 & FC-02):
 *    - Cash Received: Actual money collected -> Exactly ONE Treasury IN.
 *    - Cash Applicable to Project = min(Cash Received, Project Obligation).
 *    - Excess Cash Generated = max(0, Cash Received - Project Obligation) -> Becomes Client Available Credit.
 *    - Credit Applied: Prior client credit applied manually to any future project of the SAME client.
 *    - Total Settled = Cash Applicable to Project + Client Credit Applied.
 *    - Project Remaining = max(0, Project Obligation - Total Settled).
 *    - Applying Credit creates NO Treasury movements (Treasury Delta = 0).
 * 4. Accrual / Incurred Value != Cash Flow. Cash payments to suppliers/technicians only reduce liabilities and cash balances.
 * 5. General Company Expenses (project_id IS NULL) NEVER enter project cost base.
 * 6. NO CROSS-SETTLEMENT: Collections, Supplier Payments, and Technician Payments are completely independent.
 */

export interface CostBreakdown {
  materials: number;
  supplierServices: number;
  technicianEarned: number;
  equipmentRentals: number;
  directProjectExpenses: number;
  otherEligibleDirectCosts: number;
  totalDirectIncurredCost: number;
}

export interface CashFlowSummary {
  actualCashIn: number;
  actualCashOut: number;
  netCashFlow: number;
  supplierPaid: number;
  supplierRemaining: number;
  supplierCashPaid?: number;
  supplierAllocated?: number;
  technicianPaid: number;
  technicianRemaining: number;
  paidExpenses: number;
}

export interface ProjectFinancialResult {
  projectId: string;
  projectType: "contracting" | "finishing" | string;
  
  // Accrual / Commercial Side
  eligibleCostBase: number;
  breakdown: CostBreakdown;
  finishingPercentage: number;
  companyFee: number;
  
  contractValue: number;
  clientObligation: number;
  
  // Settlement & Credit Details (FC-02 Canonical)
  cashReceived: number;
  cashApplicable: number;
  creditApplied: number;
  totalSettled: number;
  clientPaid: number; // Backward-compatible alias for totalSettled
  clientRemaining: number;
  excessCashGenerated: number;
  
  // Profitability
  projectRevenue: number;
  projectCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  
  // Cash Flow & Liabilities Side
  cashFlow: CashFlowSummary;
}

export interface ClientFinancialResult {
  clientId: string;
  totalObligations: number;
  totalCashReceived: number;
  totalCreditCreated: number;
  totalCreditApplied: number;
  clientAvailableCredit: number;
  totalSettled: number;
  netClientRemaining: number;
  projectSummaries: ProjectFinancialResult[];
}

export interface CreditApplicationRecord {
  id: string;
  client_id?: string | null;
  originating_payment_id?: string | null;
  target_project_id?: string | null;
  amount?: number | null;
  status?: "applied" | "reversed" | string | null;
  date?: string | null;
  notes?: string | null;
}

export interface CreditLedgerEntry {
  client_id?: string | null;
  source_payment_id?: string | null;
  target_project_id?: string | null;
  entry_type: string;
  amount: number;
}

export function availableClientCredit(entries: CreditLedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum +
    (['CREDIT_CREATED', 'CREDIT_APPLICATION_REVERSED'].includes(entry.entry_type) ? 1 : -1) * Number(entry.amount || 0), 0);
}

export interface RawFinancialData {
  project: {
    id: string;
    client_id?: string | null;
    project_type?: string | null;
    finishing_percentage?: number | null;
    budget?: number | null;
  };
  contracts?: Array<{ amount?: number | null; status?: string | null; project_id?: string | null }>;
  projectItems?: Array<{ total_price?: number | null; progress?: number | null }>;
  projectItemTechnicians?: Array<{
    id?: string | null;
    project_item_id?: string | null;
    rate?: number | null;
    quantity?: number | null;
    total_cost?: number | null;
    technician_id?: string | null;
  }>;
  purchases?: Array<{
    id: string;
    total_amount?: number | null;
    paid_amount?: number | null;
    purchase_type?: string | null;
    supplier_id?: string | null;
    technician_id?: string | null;
    rental_id?: string | null;
    phase_id?: string | null;
  }>;
  purchasePayments?: Array<{
    id: string;
    purchase_id?: string | null;
    amount?: number | null;
  }>;
  supplierPaymentAllocations?: Array<{ purchase_id: string; amount: number }>;
  creditLedger?: CreditLedgerEntry[];
  techProgressRecords?: Array<{
    id: string;
    earned_amount?: number | null;
  }>;
  rentals?: Array<{
    id: string;
    total_amount?: number | null;
  }>;
  expenses?: Array<{
    id: string;
    amount?: number | null;
    project_id?: string | null;
    type?: string | null;
    technician_id?: string | null;
  }>;
  clientPayments?: Array<{
    id: string;
    amount?: number | null;
    project_id?: string | null;
    client_id?: string | null;
  }>;
  creditApplications?: CreditApplicationRecord[];
  phases?: Array<{
    id: string;
    has_percentage?: boolean | null;
    percentage_value?: number | null;
  }>;
}

export interface RawClientData {
  creditLedger?: CreditLedgerEntry[];
  client: { id: string; name?: string | null };
  projects: Array<{
    id: string;
    client_id?: string | null;
    project_type?: string | null;
    finishing_percentage?: number | null;
    budget?: number | null;
  }>;
  contracts?: Array<{ id?: string; project_id?: string | null; amount?: number | null; status?: string | null }>;
  projectItems?: Array<{ id?: string; project_id?: string | null; total_price?: number | null; progress?: number | null }>;
  purchases?: Array<{
    id: string;
    project_id?: string | null;
    total_amount?: number | null;
    purchase_type?: string | null;
    supplier_id?: string | null;
    technician_id?: string | null;
    rental_id?: string | null;
  }>;
  purchasePayments?: Array<{
    id: string;
    purchase_id?: string | null;
    amount?: number | null;
  }>;
  techProgressRecords?: Array<{
    id: string;
    project_id?: string | null;
    earned_amount?: number | null;
  }>;
  rentals?: Array<{
    id: string;
    project_id?: string | null;
    total_amount?: number | null;
  }>;
  expenses?: Array<{
    id: string;
    project_id?: string | null;
    amount?: number | null;
  }>;
  clientPayments?: Array<{
    id: string;
    client_id?: string | null;
    project_id?: string | null;
    amount?: number | null;
    date?: string | null;
  }>;
  creditApplications?: CreditApplicationRecord[];
}

export function calculateProjectFinancials(data: RawFinancialData): ProjectFinancialResult {
  const projectId = data.project.id;
  const projectType = (data.project.project_type || "contracting") as "contracting" | "finishing";
  const finishingPercentage = Number(data.project.finishing_percentage || 0);

  // 1. Client Receipts (Authoritative: client_payments where project_id = projectId)
  const cashReceived = (data.clientPayments || [])
    .filter(cp => cp.project_id === projectId)
    .reduce((sum, cp) => sum + Number(cp.amount || 0), 0);

  // Credit Applied: client_credit_applications where target_project_id = projectId and status !== 'reversed'
  const creditApplied = data.creditLedger !== undefined
    ? data.creditLedger.filter(e => e.target_project_id === projectId).reduce((sum, e) => sum +
      (e.entry_type === 'CREDIT_APPLIED' ? Number(e.amount) : e.entry_type === 'CREDIT_APPLICATION_REVERSED' ? -Number(e.amount) : 0), 0)
    : (data.creditApplications || [])
    .filter(ca => ca.target_project_id === projectId && ca.status !== "reversed")
    .reduce((sum, ca) => sum + Number(ca.amount || 0), 0);

  // 2. Purchases Classification & Deduplication (Mutually Exclusive)
  const allPurchases = data.purchases || [];
  
  const rentalPurchasesRows = allPurchases.filter(
    p => p.purchase_type === "rental" || Boolean(p.rental_id)
  );
  const laborPurchasesRows = allPurchases.filter(
    p => (p.purchase_type === "labor" || Boolean(p.technician_id)) && !p.rental_id && p.purchase_type !== "rental"
  );
  const servicePurchasesRows = allPurchases.filter(
    p => p.purchase_type === "service" && !p.rental_id && !p.technician_id
  );
  const materialPurchasesRows = allPurchases.filter(
    p => (p.purchase_type === "material" || !p.purchase_type) && !p.rental_id && !p.technician_id && p.purchase_type !== "service" && p.purchase_type !== "labor"
  );

  const materials = materialPurchasesRows.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const supplierServices = servicePurchasesRows.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  
  // Equipment Rentals: use rentalPurchasesRows total OR data.rentals (deduplicated)
  const rentalPurchasesTotal = rentalPurchasesRows.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const standaloneRentalsTotal = (data.rentals || []).reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  const equipmentRentals = rentalPurchasesTotal > 0 ? rentalPurchasesTotal : standaloneRentalsTotal;

  // Technician Work (Accrual): projectItemTechnicians (contracting) AND/OR labor purchases (finishing)
  const itemTechAssigned = (data.projectItemTechnicians || []).reduce(
    (sum, t) => sum + (Number(t.total_cost) > 0 ? Number(t.total_cost) : (Number(t.rate || 0) * Number(t.quantity ?? 1))),
    0
  );
  const techProgressEarned = (data.techProgressRecords || []).reduce(
    (sum, r) => sum + Number(r.earned_amount || 0),
    0
  );
  const laborPurchasesTotal = laborPurchasesRows.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const techEffectiveLabor = techProgressEarned > 0 ? techProgressEarned : laborPurchasesTotal;
  const technicianEarned = itemTechAssigned + techEffectiveLabor;

  // Direct Project Expenses: project expenses strictly belonging to this project (excluding technician settlements)
  const directProjectExpenses = (data.expenses || [])
    .filter(e => (e.project_id === projectId || (Boolean(e.project_id) && !projectId)) && !(e.type === "labor" && Boolean(e.technician_id)))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const otherEligibleDirectCosts = 0;

  const totalDirectIncurredCost = materials + supplierServices + technicianEarned + equipmentRentals + directProjectExpenses + otherEligibleDirectCosts;

  const breakdown: CostBreakdown = {
    materials,
    supplierServices,
    technicianEarned,
    equipmentRentals,
    directProjectExpenses,
    otherEligibleDirectCosts,
    totalDirectIncurredCost,
  };

  // 3. Cash Flow / Liabilities Calculations (Strictly from Payment Tables)
  const supplierPurchaseIds = new Set([...materialPurchasesRows, ...servicePurchasesRows, ...rentalPurchasesRows].map(p => p.id));
  const laborPurchaseIds = new Set(laborPurchasesRows.map(p => p.id));

  const allPurchasePayments = data.purchasePayments || [];
  const directSupplierCashPaid = allPurchasePayments
    .filter(pp => supplierPurchaseIds.has(pp.purchase_id || ""))
    .reduce((sum, pp) => sum + Number(pp.amount || 0), 0);
  const supplierAllocations = (data.supplierPaymentAllocations || [])
    .filter(a => supplierPurchaseIds.has(a.purchase_id))
    .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const supplierPaid = directSupplierCashPaid + supplierAllocations;

  const totalSupplierPurchases = materials + supplierServices + rentalPurchasesTotal;
  const supplierRemaining = totalSupplierPurchases - supplierPaid;

  const techExpensesPaid = (data.expenses || [])
    .filter(e => (e.project_id === projectId || (Boolean(e.project_id) && !projectId)) && e.type === "labor" && Boolean(e.technician_id))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const techPurchasePaymentsPaid = allPurchasePayments
    .filter(pp => laborPurchaseIds.has(pp.purchase_id || ""))
    .reduce((sum, pp) => sum + Number(pp.amount || 0), 0);

  const technicianPaid = techExpensesPaid + techPurchasePaymentsPaid;
  const technicianRemaining = technicianEarned - technicianPaid;
  const paidExpenses = (data.expenses || [])
    .filter(e => e.project_id === projectId || (Boolean(e.project_id) && !projectId))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Pure Cash Flow: actual Cash In is strictly actual cash payments (credit applied does not enter cash flow)
  // Actual Cash Out is strictly cash disbursements (allocations of advance payments do not draw treasury cash again)
  const actualCashIn = cashReceived;
  const actualCashOut = directSupplierCashPaid + techExpensesPaid + techPurchasePaymentsPaid + directProjectExpenses;
  const netCashFlow = actualCashIn - actualCashOut;

  const cashFlow: CashFlowSummary = {
    actualCashIn,
    actualCashOut,
    netCashFlow,
    supplierPaid,
    supplierRemaining,
    supplierCashPaid: directSupplierCashPaid,
    supplierAllocated: supplierAllocations,
    technicianPaid,
    technicianRemaining,
    paidExpenses,
  };

  // 4. Commercial & Client Obligation Model
  let contractValue = 0;
  let clientObligation = 0;
  let companyFee = 0;
  let projectRevenue = 0;
  let projectCost = 0;
  let grossProfit = 0;
  let profitMarginPercent = 0;
  let eligibleCostBase = 0;

  if (projectType === "finishing") {
    // FINISHING (Cost Plus / Management Fee):
    eligibleCostBase = totalDirectIncurredCost;
    
    // Calculate company fee based on finishing percentage
    companyFee = (eligibleCostBase * finishingPercentage) / 100;
    clientObligation = eligibleCostBase + companyFee;
    contractValue = clientObligation;
    
    projectRevenue = clientObligation;
    projectCost = eligibleCostBase;
    grossProfit = companyFee;
    profitMarginPercent = projectRevenue > 0 ? (grossProfit / projectRevenue) * 100 : 0;
  } else {
    // CONTRACTING (Fixed Contract / BOQ Items):
    eligibleCostBase = totalDirectIncurredCost;
    
    const contractsTotal = (data.contracts || [])
      .filter(c => c.status !== "cancelled")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const itemsTotal = (data.projectItems || []).reduce(
      (sum, i) => sum + Number(i.total_price || 0),
      0
    );
    
    contractValue = contractsTotal > 0 ? contractsTotal : (itemsTotal > 0 ? itemsTotal : Number(data.project.budget || 0));
    clientObligation = contractValue;
    companyFee = 0;
    
    projectRevenue = contractValue;
    projectCost = totalDirectIncurredCost;
    grossProfit = projectRevenue - projectCost;
    profitMarginPercent = projectRevenue > 0 ? (grossProfit / projectRevenue) * 100 : 0;
  }

  // 5. Settlement & Remaining (FC-02 Canonical Model)
  const paymentIds = new Set((data.clientPayments || []).filter(p => p.project_id === projectId).map(p => p.id));
  const recordedExcess = data.creditLedger?.filter(e => paymentIds.has(e.source_payment_id || '')).reduce((sum, e) => sum +
    (e.entry_type === 'CREDIT_CREATED' ? Number(e.amount) : e.entry_type === 'CREDIT_CREATION_REVERSED' ? -Number(e.amount) : 0), 0);
  // Once cash has become client credit it cannot settle its original project again.
  const cashApplicable = Math.min(Math.max(0, cashReceived - (recordedExcess || 0)), clientObligation);
  const totalSettled = cashApplicable + creditApplied;
  const clientRemaining = Math.max(0, clientObligation - totalSettled);
  const excessCashGenerated = recordedExcess ?? Math.max(0, cashReceived - clientObligation);

  return {
    projectId,
    projectType,
    eligibleCostBase,
    breakdown,
    finishingPercentage,
    companyFee,
    contractValue,
    clientObligation,
    cashReceived,
    cashApplicable,
    creditApplied,
    totalSettled,
    clientPaid: totalSettled, // Backward-compatible alias
    clientRemaining,
    excessCashGenerated,
    projectRevenue,
    projectCost,
    grossProfit,
    profitMarginPercent,
    cashFlow,
  };
}

/**
 * Calculate Client-Level Aggregate Financials & Available Credit (FC-02)
 */
export function calculateClientFinancials(clientData: RawClientData): ClientFinancialResult {
  const clientId = clientData.client.id;
  const projects = clientData.projects || [];
  
  // 1. Calculate each project's financials
  const projectSummaries: ProjectFinancialResult[] = projects.map(project => {
    const projContracts = (clientData.contracts || []).filter(c => c.project_id === project.id);
    const projItems = (clientData.projectItems || []).filter(i => (i as any).project_id === project.id);
    const projPurchases = (clientData.purchases || []).filter(p => p.project_id === project.id);
    const projPayments = (clientData.purchasePayments || []);
    const projProgress = (clientData.techProgressRecords || []).filter(t => t.project_id === project.id);
    const projRentals = (clientData.rentals || []).filter(r => r.project_id === project.id);
    const projExpenses = (clientData.expenses || []).filter(e => e.project_id === project.id);
    const projClientPayments = (clientData.clientPayments || []).filter(cp => cp.project_id === project.id);
    const projCreditApps = (clientData.creditApplications || []).filter(ca => ca.target_project_id === project.id);

    return calculateProjectFinancials({
      project,
      contracts: projContracts,
      projectItems: projItems,
      purchases: projPurchases,
      purchasePayments: projPayments,
      techProgressRecords: projProgress,
      rentals: projRentals,
      expenses: projExpenses,
      clientPayments: projClientPayments,
      creditApplications: projCreditApps,
      creditLedger: clientData.creditLedger,
    });
  });

  // 2. Client-level Cash & Overpayment Credit Calculation
  const directClientCash = (clientData.clientPayments || [])
    .filter(cp => cp.client_id === clientId && !cp.project_id)
    .reduce((sum, cp) => sum + Number(cp.amount || 0), 0);

  const totalProjectCashReceived = projectSummaries.reduce((sum, ps) => sum + ps.cashReceived, 0);
  const totalCashReceived = directClientCash + totalProjectCashReceived;

  const totalOverpaymentCredit = projectSummaries.reduce((sum, ps) => sum + ps.excessCashGenerated, 0);
  const clientLedger = clientData.creditLedger?.filter(e => !e.client_id || e.client_id === clientId);
  const totalCreditCreated = clientLedger ? clientLedger.reduce((sum, e) => sum +
    (e.entry_type === 'CREDIT_CREATED' ? Number(e.amount) : e.entry_type === 'CREDIT_CREATION_REVERSED' ? -Number(e.amount) : 0), 0) : directClientCash + totalOverpaymentCredit;

  const totalCreditApplied = clientLedger ? clientLedger.reduce((sum, e) => sum +
    (e.entry_type === 'CREDIT_APPLIED' ? Number(e.amount) : e.entry_type === 'CREDIT_APPLICATION_REVERSED' ? -Number(e.amount) : 0), 0) : (clientData.creditApplications || [])
    .filter(ca => ca.client_id === clientId && ca.status !== "reversed")
    .reduce((sum, ca) => sum + Number(ca.amount || 0), 0);

  const clientAvailableCredit = clientLedger ? availableClientCredit(clientLedger) : Math.max(0, totalCreditCreated - totalCreditApplied);

  const totalObligations = projectSummaries.reduce((sum, ps) => sum + ps.clientObligation, 0);
  const totalSettled = projectSummaries.reduce((sum, ps) => sum + ps.totalSettled, 0);
  const netClientRemaining = projectSummaries.reduce((sum, project) => sum + project.clientRemaining, 0);

  return {
    clientId,
    totalObligations,
    totalCashReceived,
    totalCreditCreated,
    totalCreditApplied,
    clientAvailableCredit,
    totalSettled,
    netClientRemaining,
    projectSummaries,
  };
}

/**
 * Validate Client Credit Application
 */
export function validateCreditApplication(params: {
  clientId: string;
  targetProjectId: string;
  amount: number;
  clientData: RawClientData;
}): { isValid: boolean; error?: string } {
  const { clientId, targetProjectId, amount, clientData } = params;

  if (!amount || amount <= 0) {
    return { isValid: false, error: "المبلغ المطلوب تطبيقه يجب أن يكون أكبر من الصفر." };
  }

  // 1. Same-client check
  const targetProject = (clientData.projects || []).find(p => p.id === targetProjectId);
  if (!targetProject) {
    return { isValid: false, error: "المشروع المستهدف غير موجود." };
  }
  if (targetProject.client_id !== clientId) {
    return { isValid: false, error: "حظر تطبيقي: لا يمكن استخدام رصيد العميل لصالح مشروع يتبع عميلاً آخر." };
  }

  // 2. Client available credit check
  const clientFinancials = calculateClientFinancials(clientData);
  if (amount > clientFinancials.clientAvailableCredit) {
    return {
      isValid: false,
      error: `المبلغ المطلوب (${amount} د.ل) يتجاوز الرصيد الدائن المتاح للزبون (${clientFinancials.clientAvailableCredit} د.ل).`,
    };
  }

  // 3. Target project remaining check
  const targetProjSummary = clientFinancials.projectSummaries.find(ps => ps.projectId === targetProjectId);
  if (targetProjSummary && amount > targetProjSummary.clientRemaining) {
    return {
      isValid: false,
      error: `المبلغ المطلوب (${amount} د.ل) يتجاوز المتبقي المستحق على المشروع المستهدف (${targetProjSummary.clientRemaining} د.ل).`,
    };
  }

  return { isValid: true };
}

/**
 * Validate Cash Payment Deletion/Reversal for Credit Safety
 */
export function validateCashPaymentReversal(params: {
  paymentId: string;
  clientData: RawClientData;
}): { canReverse: boolean; error?: string } {
  const { paymentId, clientData } = params;
  const payment = (clientData.clientPayments || []).find(cp => cp.id === paymentId);
  if (!payment) {
    return { canReverse: true };
  }

  const currentFinancials = calculateClientFinancials(clientData);
  
  let excessFromThisPayment = 0;
  if (!payment.project_id) {
    excessFromThisPayment = Number(payment.amount || 0);
  } else {
    const projSummary = currentFinancials.projectSummaries.find(ps => ps.projectId === payment.project_id);
    if (projSummary) {
      excessFromThisPayment = projSummary.excessCashGenerated;
    }
  }

  if (excessFromThisPayment > 0) {
    if (currentFinancials.clientAvailableCredit < excessFromThisPayment) {
      const consumedCredit = excessFromThisPayment - currentFinancials.clientAvailableCredit;
      return {
        canReverse: false,
        error: `حظر أمان: لا يمكن حذف أو عكس سند القبض لأن رصيداً بقيمة (${consumedCredit} د.ل) تم استخدامه مسبقاً في تسديد مشاريع أخرى. يجب إلغاء استخدام الرصيد في تلك المشاريع أولاً.`,
      };
    }
  }

  return { canReverse: true };
}

/**
 * CONTRACTING BOQ ITEM PROFITABILITY INTERFACES & HELPER
 * Single Source of Truth for item-level profitability calculations.
 * Adheres strictly to Accrual / Incurred accounting and FC-01 purchase classification.
 */

export interface ContractingItemProfitabilityInput {
  item: {
    id: string;
    name?: string | null;
    total_price?: number | null;
    quantity?: number | null;
    unit_price?: number | null;
    progress?: number | null; // Approved progress percentage (0 - 100)
  };
  techProgressRecords?: Array<{
    id: string;
    project_item_id?: string | null;
    quantity_completed?: number | null;
    rate?: number | null;
    earned_amount?: number | null;
    technician_id?: string | null;
  }>;
  projectItemTechnicians?: Array<{
    id?: string;
    project_item_id?: string | null;
    rate?: number | null;
    quantity?: number | null;
    total_cost?: number | null;
    technician_id?: string | null;
  }>;
  purchases?: Array<{
    id: string;
    project_item_id?: string | null;
    total_amount?: number | null;
    purchase_type?: string | null;
    rental_id?: string | null;
    technician_id?: string | null;
  }>;
  expenses?: Array<{
    id: string;
    project_item_id?: string | null;
    amount?: number | null;
    type?: string | null;
  }>;
}

export interface ContractingItemProfitabilityResult {
  itemId: string;
  itemName: string;

  // 1. Commercial Customer Value (Project-specific, NEVER general template price)
  commercialValue: number;

  // 2. Authoritative Progress & Earned Commercial Value To Date
  approvedProgressPercent: number; // Clamped [0, 100]
  approvedCompletionRatio: number; // [0, 1]
  earnedCommercialValueToDate: number; // commercialValue * approvedCompletionRatio

  // 3. Attributed Incurred Direct Costs (Accrual basis)
  laborIncurred: number;
  materialPurchasesIncurred: number;
  supplierServicesIncurred: number;
  directExpensesIncurred: number;
  totalAttributedItemIncurred: number;

  // 4. Actual-to-Date Profitability (Realized based on Earned Value)
  actualToDateGrossProfit: number; // earnedCommercialValueToDate - totalAttributedItemIncurred
  actualToDateMarginPercent: number | null; // null when earnedCommercialValueToDate <= 0

  // 5. Unearned Contract Value (Commercial balance remaining)
  unearnedContractValue: number;

  // 6. Labor Breakdown by Worker (Cost basis: Work value)
  technicianBreakdown: Array<{
    technicianId: string;
    earnedAmount: number;
  }>;
}

export function calculateContractingItemProfitability(
  input: ContractingItemProfitabilityInput
): ContractingItemProfitabilityResult {
  const itemId = input.item.id;
  const itemName = input.item.name || "بند مقايسة";

  // 1. Commercial Customer Value (Explicit nullish authority: total_price if not null, else qty * unit_price)
  const commercialValue =
    input.item.total_price !== null && input.item.total_price !== undefined
      ? Number(input.item.total_price)
      : Number(input.item.quantity || 0) * Number(input.item.unit_price || 0);

  // 2. Single Commercial Progress Authority (project_items.progress only)
  const rawProgress = Number(input.item.progress || 0);
  const approvedProgressPercent = Math.max(0, Math.min(100, isNaN(rawProgress) ? 0 : rawProgress));
  const approvedCompletionRatio = approvedProgressPercent / 100;
  const earnedCommercialValueToDate = commercialValue * approvedCompletionRatio;

  // 3. Labor Incurred: project_item_technicians.total_cost (or fallback to techProgressRecords)
  const itemAssignedTechs = (input.projectItemTechnicians || []).filter(
    t => t.project_item_id === itemId
  );
  const itemTechRecords = (input.techProgressRecords || []).filter(
    r => r.project_item_id === itemId
  );

  const techMap = new Map<string, number>();
  let laborIncurred = 0;

  if (itemAssignedTechs.length > 0) {
    for (const t of itemAssignedTechs) {
      const cost = Number(t.total_cost) > 0 ? Number(t.total_cost) : (Number(t.rate || 0) * Number(t.quantity || 1));
      laborIncurred += cost;
      const techId = t.technician_id || "unknown";
      techMap.set(techId, (techMap.get(techId) || 0) + cost);
    }
  } else {
    for (const r of itemTechRecords) {
      const rawEarned = Number(r.earned_amount || 0);
      const earned = rawEarned > 0 ? rawEarned : Number(r.quantity_completed || 0) * Number(r.rate || 0);
      laborIncurred += earned;
      const techId = r.technician_id || "unknown";
      techMap.set(techId, (techMap.get(techId) || 0) + earned);
    }
  }

  const technicianBreakdown: Array<{ technicianId: string; earnedAmount: number }> = [];
  for (const [technicianId, earnedAmount] of techMap.entries()) {
    technicianBreakdown.push({ technicianId, earnedAmount });
  }

  // 4. Material & Service Purchases Incurred (Matching FC-01 classification)
  const itemPurchases = (input.purchases || []).filter(
    p => p.project_item_id === itemId
  );

  const materialPurchasesRows = itemPurchases.filter(
    p =>
      (p.purchase_type === "material" || !p.purchase_type) &&
      !p.rental_id &&
      !p.technician_id &&
      p.purchase_type !== "service" &&
      p.purchase_type !== "labor"
  );
  const servicePurchasesRows = itemPurchases.filter(
    p => p.purchase_type === "service" && !p.rental_id && !p.technician_id
  );

  const materialPurchasesIncurred = materialPurchasesRows.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );
  const supplierServicesIncurred = servicePurchasesRows.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );

  // 5. Direct Expenses Incurred: SUM(expenses.amount WHERE project_item_id = item.id)
  const itemExpenses = (input.expenses || []).filter(
    e => e.project_item_id === itemId
  );
  const directExpensesIncurred = itemExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  // 6. Total Attributed Direct Incurred Cost
  const totalAttributedItemIncurred =
    laborIncurred +
    materialPurchasesIncurred +
    supplierServicesIncurred +
    directExpensesIncurred;

  // 7. Actual-to-Date Gross Profit
  const actualToDateGrossProfit = earnedCommercialValueToDate - totalAttributedItemIncurred;

  // 8. Actual-to-Date Margin % (N/A / null when earned value <= 0)
  const actualToDateMarginPercent =
    earnedCommercialValueToDate > 0
      ? (actualToDateGrossProfit / earnedCommercialValueToDate) * 100
      : null;

  // 9. Unearned Commercial Contract Value
  const unearnedContractValue = Math.max(0, commercialValue - earnedCommercialValueToDate);

  return {
    itemId,
    itemName,
    commercialValue,
    approvedProgressPercent,
    approvedCompletionRatio,
    earnedCommercialValueToDate,
    laborIncurred,
    materialPurchasesIncurred,
    supplierServicesIncurred,
    directExpensesIncurred,
    totalAttributedItemIncurred,
    actualToDateGrossProfit,
    actualToDateMarginPercent,
    unearnedContractValue,
    technicianBreakdown,
  };
}
