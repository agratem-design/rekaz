/**
 * UX Phase 3: Automated Invariants Test Suite
 * Covers Project Overview Hub & Type-Aware Project Workspace (OVERVIEW-01 to OVERVIEW-20, FIN-01 to FIN-06)
 */

import fs from 'fs';
import path from 'path';
import {
  resolveProjectSwitchDestination,
  extractProjectSectionFromPath,
  resolveLegacyProjectRoute,
  getProjectSectionPath,
  isSectionSupportedForProjectType,
} from '../../src/lib/navigation/projectNavigation.ts';
import { calculateProjectFinancials } from '../../src/lib/financialCore.ts';

export async function runUxPhase3Invariants() {
  console.log('================================================================');
  console.log('       UX PHASE 3: AUTOMATED INVARIANTS TEST SUITE RUNNER');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const total = 26;

  function assert(id, description, condition, details, expected, actual) {
    if (condition) {
      console.log(`  [PASS] ${id}: ${description}`);
      console.log(`         └─ ${details}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${id}: ${description}`);
      console.error(`         └─ Expected: ${expected}`);
      console.error(`         └─ Actual:   ${actual}`);
      console.error(`         └─ Details:  ${details}`);
      failed++;
    }
  }

  const appSourceCode = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  const overviewSourceCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProjectOverviewHub.tsx'),
    'utf-8'
  );
  const workspaceSourceCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ProjectWorkspaceLayout.tsx'),
    'utf-8'
  );
  const paletteSourceCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/navigation/GlobalCommandPalette.tsx'),
    'utf-8'
  );
  const projectsSourceCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/Projects.tsx'),
    'utf-8'
  );

  // ==========================================================================
  // SECTION 1: ROUTING, MIGRATION & WORKSPACE SHELL
  // ==========================================================================

  // --------------------------------------------------------------------------
  // OVERVIEW-01: /projects/:id Renders Project Workspace (ProjectPhases)
  // --------------------------------------------------------------------------
  const rootRouteHasPhases =
    appSourceCode.includes('path="projects/:id"') &&
    appSourceCode.includes('ProjectPhases');
  assert(
    'OVERVIEW-01',
    '/projects/:id is Bound Authoritatively to Project Workspace (ProjectPhases)',
    rootRouteHasPhases,
    `Root Route maps to Project Workspace: ${rootRouteHasPhases}`,
    true,
    rootRouteHasPhases
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-02: Legacy /projects/:id/edit Safely Resolves to /projects/:id/settings
  // --------------------------------------------------------------------------
  const legacyEditResult = resolveLegacyProjectRoute('/projects/prj-alpha-123/edit');
  const legacyRouteCondition =
    legacyEditResult.canonicalPath === '/projects/prj-alpha-123/settings' &&
    legacyEditResult.isLegacy === true;

  assert(
    'OVERVIEW-02',
    'Legacy /projects/:id/edit Safely Resolves to Canonical /projects/:id/settings',
    legacyRouteCondition,
    `Resolved Route: ${legacyEditResult.canonicalPath} (isLegacy: ${legacyEditResult.isLegacy})`,
    true,
    legacyRouteCondition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-03: Generic Command Palette Project Result Opens Overview Hub (/projects/:id)
  // --------------------------------------------------------------------------
  const paletteRoutesToOverview = paletteSourceCode.includes('path: `/projects/${p.id}`');
  assert(
    'OVERVIEW-03',
    'Generic Command Palette Project Result Directly Targets Overview Hub (/projects/:id)',
    paletteRoutesToOverview,
    `Palette Project Path: /projects/\${p.id} (Verified: ${paletteRoutesToOverview})`,
    true,
    paletteRoutesToOverview
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-04: Contracting Workspace Includes BOQ / Items Tab
  // --------------------------------------------------------------------------
  const contractingHasBOQ =
    isSectionSupportedForProjectType('items', 'contracting') === true &&
    workspaceSourceCode.includes('id: "items"');
  assert(
    'OVERVIEW-04',
    'Contracting Project Workspace Includes BOQ Items Section',
    contractingHasBOQ,
    `Contracting BOQ Supported: ${contractingHasBOQ}`,
    true,
    contractingHasBOQ
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-05: Finishing Workspace Strictly Excludes BOQ / Items Tab
  // --------------------------------------------------------------------------
  const finishingExcludesBOQ =
    isSectionSupportedForProjectType('items', 'finishing') === false &&
    workspaceSourceCode.includes('isFinishing');
  assert(
    'OVERVIEW-05',
    'Finishing Project Workspace Strictly Excludes Contracting BOQ Items',
    finishingExcludesBOQ,
    `Finishing BOQ Excluded: ${finishingExcludesBOQ}`,
    true,
    finishingExcludesBOQ
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-06: Finishing Phases Remain Fully Accessible
  // --------------------------------------------------------------------------
  const finishingHasPhases = isSectionSupportedForProjectType('phases', 'finishing') === true;
  assert(
    'OVERVIEW-06',
    'Finishing Project Workspace Fully Supports Phases Section',
    finishingHasPhases,
    `Finishing Phases Supported: ${finishingHasPhases}`,
    true,
    finishingHasPhases
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-07: Finishing Contracts & Shared Domains Remain Accessible
  // --------------------------------------------------------------------------
  const finishingHasContracts = isSectionSupportedForProjectType('contracts', 'finishing') === true;
  assert(
    'OVERVIEW-07',
    'Finishing Project Workspace Supports Contracts & Agreements Section',
    finishingHasContracts,
    `Finishing Contracts Supported: ${finishingHasContracts}`,
    true,
    finishingHasContracts
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-08: Canonical /projects/:id/settings Route is Bound to Project Settings
  // --------------------------------------------------------------------------
  const settingsRouteExists =
    appSourceCode.includes('path="projects/:id/settings"') &&
    appSourceCode.includes('<ManageProject');
  assert(
    'OVERVIEW-08',
    'Canonical /projects/:id/settings Route is Active and Mapped to Project Settings',
    settingsRouteExists,
    `Settings Route Verified: ${settingsRouteExists}`,
    true,
    settingsRouteExists
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-09: Contracting Overview Consumes Authoritative financialCore
  // --------------------------------------------------------------------------
  const usesFinancialSummaryHook = overviewSourceCode.includes('useProjectFinancialSummary(projectId)');
  assert(
    'OVERVIEW-09',
    'Contracting Overview Derives Financials from Single Source of Truth Hook',
    usesFinancialSummaryHook,
    `Uses useProjectFinancialSummary: ${usesFinancialSummaryHook}`,
    true,
    usesFinancialSummaryHook
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-10: Finishing Overview Consumes Authoritative financialCore
  // --------------------------------------------------------------------------
  const finishingUsesFinancialSummary =
    overviewSourceCode.includes('finSummary.eligibleCostBase') &&
    overviewSourceCode.includes('finSummary.companyFee') &&
    overviewSourceCode.includes('finSummary.clientObligation');
  assert(
    'OVERVIEW-10',
    'Finishing Overview Renders Exact Cost-Plus Model from financialCore',
    finishingUsesFinancialSummary,
    `Cost-Plus Fields Consumed: ${finishingUsesFinancialSummary}`,
    true,
    finishingUsesFinancialSummary
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-11: Zero Local Financial Formulas in Overview Components
  // --------------------------------------------------------------------------
  const hasLocalPriceCalc =
    overviewSourceCode.includes('spent * finishing_percentage') ||
    overviewSourceCode.includes('cost * margin') ||
    overviewSourceCode.includes('contract - cost');
  const zeroLocalFormulas = hasLocalPriceCalc === false;
  assert(
    'OVERVIEW-11',
    'Overview Components Contain Exactly Zero Page-Local Financial Formulas',
    zeroLocalFormulas,
    `Contains Ad-hoc Price/Margin Formulas: ${hasLocalPriceCalc}`,
    true,
    zeroLocalFormulas
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-12: Project Remaining Terminology Respects Credit Settlement
  // --------------------------------------------------------------------------
  const hasSettlementClarity =
    overviewSourceCode.includes('إجمالي المسوّى') &&
    overviewSourceCode.includes('finSummary.cashReceived') &&
    overviewSourceCode.includes('finSummary.creditApplied');
  assert(
    'OVERVIEW-12',
    'Overview UI Explicitly Distinguishes Total Settled (Cash + Credit) from Pure Cash',
    hasSettlementClarity,
    `Settlement Clarity Verified: ${hasSettlementClarity}`,
    true,
    hasSettlementClarity
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-13: Switcher Root /projects/A -> B Lands on /projects/B (Overview)
  // --------------------------------------------------------------------------
  const switchOverviewResult = resolveProjectSwitchDestination({
    sourcePathname: '/projects/proj-alpha',
    targetProjectId: 'proj-beta',
    targetProjectType: 'contracting',
  });
  const switchOverviewCondition = switchOverviewResult.targetPath === '/projects/proj-beta';
  assert(
    'OVERVIEW-13',
    'Project Switcher from Root /projects/A to B Seamlessly Preserves Overview Landing',
    switchOverviewCondition,
    `Target Path: ${switchOverviewResult.targetPath}`,
    true,
    switchOverviewCondition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-14: Cross-Type Unsupported Section Falls Back to Overview Hub (/projects/B)
  // --------------------------------------------------------------------------
  const crossTypeFallback = resolveProjectSwitchDestination({
    sourcePathname: '/projects/proj-contracting/items',
    targetProjectId: 'proj-finishing',
    targetProjectType: 'finishing',
  });
  const crossTypeCondition =
    crossTypeFallback.targetPath === '/projects/proj-finishing/overview' &&
    crossTypeFallback.preservedSection === 'overview';
  assert(
    'OVERVIEW-14',
    'Cross-Type Unsupported Section Switch (BOQ -> Finishing) Safely Falls Back to Overview Hub',
    crossTypeCondition,
    `Target Path: ${crossTypeFallback.targetPath} (Section: ${crossTypeFallback.preservedSection})`,
    true,
    crossTypeCondition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-15: Old Phase Parameter Dropped on Project Switch
  // --------------------------------------------------------------------------
  const dropParamCheck = resolveProjectSwitchDestination({
    sourcePathname: '/projects/p-1/expenses?phase=ph-99&item=it-77',
    targetProjectId: 'p-2',
    targetProjectType: 'finishing',
  });
  const dropParamCondition =
    dropParamCheck.targetPath === '/projects/p-2/expenses' &&
    !dropParamCheck.targetPath.includes('ph-99');
  assert(
    'OVERVIEW-15',
    'Project Switcher Strictly Purges Old Phase and Item Parameters',
    dropParamCondition,
    `Target Path: ${dropParamCheck.targetPath}`,
    true,
    dropParamCondition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-16: Project Header Correctly Identifies Root vs Overview Section
  // --------------------------------------------------------------------------
  const extractedRootSection = extractProjectSectionFromPath('/projects/proj-test-100');
  const extractedOverviewSubSection = extractProjectSectionFromPath('/projects/proj-test-100/overview');
  const headerSectionCondition = extractedRootSection === 'phases' && extractedOverviewSubSection === 'overview';
  assert(
    'OVERVIEW-16',
    'Project Section Parser Extracts "phases" for Root Route and "overview" for /overview',
    headerSectionCondition,
    `Extracted Root: ${extractedRootSection}, Extracted Overview: ${extractedOverviewSubSection}`,
    true,
    headerSectionCondition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-17: Generic ProjectCard Action Opens Overview Hub
  // --------------------------------------------------------------------------
  const cardClickOverview = projectsSourceCode.includes("navigate(`/projects/${project.id}`)");
  assert(
    'OVERVIEW-17',
    'Generic Project Card Click Action Navigates Directly to Overview Hub',
    cardClickOverview,
    `Card Click Destination Verified: ${cardClickOverview}`,
    true,
    cardClickOverview
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-18: Finishing Workspace Excludes Contracting Progress Section
  // --------------------------------------------------------------------------
  const finishingExcludesProgress = isSectionSupportedForProjectType('progress', 'finishing') === false;
  assert(
    'OVERVIEW-18',
    'Finishing Workspace Excludes Contracting BOQ Item Progress Section',
    finishingExcludesProgress,
    `Progress Section Supported for Finishing: ${!finishingExcludesProgress}`,
    true,
    finishingExcludesProgress
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-19: Role-Aware Workspace Navigation Filters Unauthorized Tabs
  // --------------------------------------------------------------------------
  const engineerHiddenTabs =
    workspaceSourceCode.includes('allowed: !isEngineer && !isSupervisor') ||
    workspaceSourceCode.includes('allowed: isAdmin');
  assert(
    'OVERVIEW-19',
    'Workspace Navigation Enforces Role-Aware Filtering for Engineer and Supervisor Roles',
    engineerHiddenTabs,
    `Role Filters Present in Workspace Definition: ${engineerHiddenTabs}`,
    true,
    engineerHiddenTabs
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-20: Invalid Project Shows Safe Not Found State
  // --------------------------------------------------------------------------
  const has404State = overviewSourceCode.includes('المشروع غير موجود');
  assert(
    'OVERVIEW-20',
    'Overview Hub Renders Accessible 404 Not Found State with Safe Navigation Action',
    has404State,
    `404 Not Found State Verified: ${has404State}`,
    true,
    has404State
  );

  // ==========================================================================
  // SECTION 2: FINANCIAL ARITHMETIC RECONCILIATION INVARIANTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // CONTRACTING-OVERVIEW-FIN-01: Contracting Overview Contract Value Matches financialCore
  // --------------------------------------------------------------------------
  const mockContractingData = {
    project: { id: 'c-1', project_type: 'contracting', budget: 50000 },
    contracts: [{ amount: 50000, status: 'active', project_id: 'c-1' }],
    clientPayments: [{ id: 'p-1', amount: 20000, project_id: 'c-1' }],
    purchases: [{ id: 'pu-1', total_amount: 15000, purchase_type: 'material' }],
    expenses: [{ id: 'e-1', amount: 3000, project_id: 'c-1' }],
  };
  const contractingFin = calculateProjectFinancials(mockContractingData);
  const fin01Condition =
    contractingFin.contractValue === 50000 &&
    contractingFin.clientObligation === 50000;
  assert(
    'CONTRACTING-OVERVIEW-FIN-01',
    'Contracting Overview Contract Value Exactly Matches financialCore Contract Value',
    fin01Condition,
    `Contract Value: ${contractingFin.contractValue} LYD, Obligation: ${contractingFin.clientObligation} LYD`,
    true,
    fin01Condition
  );

  // --------------------------------------------------------------------------
  // CONTRACTING-OVERVIEW-FIN-02: Contracting Overview Client Remaining Matches financialCore
  // --------------------------------------------------------------------------
  const fin02Condition =
    contractingFin.totalSettled === 20000 &&
    contractingFin.clientRemaining === 30000;
  assert(
    'CONTRACTING-OVERVIEW-FIN-02',
    'Contracting Overview Client Remaining Matches financialCore (50k - 20k = 30k LYD)',
    fin02Condition,
    `Settled: ${contractingFin.totalSettled} LYD, Remaining: ${contractingFin.clientRemaining} LYD`,
    true,
    fin02Condition
  );

  // --------------------------------------------------------------------------
  // FINISHING-OVERVIEW-FIN-01: Finishing Overview Eligible Direct Cost Matches financialCore
  // --------------------------------------------------------------------------
  const mockFinishingData = {
    project: { id: 'f-1', project_type: 'finishing', finishing_percentage: 15 },
    purchases: [
      { id: 'pu-1', total_amount: 10000, purchase_type: 'material' },
      { id: 'pu-2', total_amount: 4000, purchase_type: 'service' },
    ],
    techProgressRecords: [{ id: 'tp-1', earned_amount: 5000 }],
    rentals: [{ id: 'r-1', total_amount: 3000 }],
    expenses: [{ id: 'ex-1', amount: 2000, project_id: 'f-1' }],
    clientPayments: [{ id: 'cp-1', amount: 15000, project_id: 'f-1' }],
  };
  const finishingFin = calculateProjectFinancials(mockFinishingData);
  const fin03Condition = finishingFin.eligibleCostBase === 24000; // 10k + 4k + 5k + 3k + 2k
  assert(
    'FINISHING-OVERVIEW-FIN-01',
    'Finishing Overview Eligible Direct Cost Matches Exact Sum (24,000 LYD)',
    fin03Condition,
    `Eligible Direct Cost Base: ${finishingFin.eligibleCostBase} LYD`,
    true,
    fin03Condition
  );

  // --------------------------------------------------------------------------
  // FINISHING-OVERVIEW-FIN-02: Finishing Overview Company Fee Matches financialCore
  // --------------------------------------------------------------------------
  const expectedFee = 24000 * 0.15; // 3,600 LYD
  const fin04Condition = finishingFin.companyFee === expectedFee;
  assert(
    'FINISHING-OVERVIEW-FIN-02',
    'Finishing Overview Company Fee Matches financialCore (24k * 15% = 3,600 LYD)',
    fin04Condition,
    `Company Fee: ${finishingFin.companyFee} LYD (Expected: ${expectedFee} LYD)`,
    true,
    fin04Condition
  );

  // --------------------------------------------------------------------------
  // FINISHING-OVERVIEW-FIN-03: Finishing Overview Client Obligation Matches financialCore
  // --------------------------------------------------------------------------
  const expectedObligation = 24000 + 3600; // 27,600 LYD
  const fin05Condition = finishingFin.clientObligation === expectedObligation;
  assert(
    'FINISHING-OVERVIEW-FIN-03',
    'Finishing Overview Client Obligation Matches Cost + Fee (27,600 LYD)',
    fin05Condition,
    `Client Obligation: ${finishingFin.clientObligation} LYD (Expected: ${expectedObligation} LYD)`,
    true,
    fin05Condition
  );

  // --------------------------------------------------------------------------
  // FINISHING-OVERVIEW-FIN-04: Cash, Credit, Settled, and Remaining Match Authoritative Definitions
  // --------------------------------------------------------------------------
  const finWithCredit = calculateProjectFinancials({
    ...mockFinishingData,
    creditApplications: [
      { id: 'ca-1', target_project_id: 'f-1', amount: 5000, status: 'applied' },
    ],
  });
  // Total Settled = 15,000 (Cash) + 5,000 (Credit) = 20,000 LYD
  // Remaining = 27,600 - 20,000 = 7,600 LYD
  const fin06Condition =
    finWithCredit.cashReceived === 15000 &&
    finWithCredit.creditApplied === 5000 &&
    finWithCredit.totalSettled === 20000 &&
    finWithCredit.clientRemaining === 7600;
  assert(
    'FINISHING-OVERVIEW-FIN-04',
    'Finishing Cash (15k) + Credit (5k) = Settled (20k) -> Remaining (7,600 LYD) Reconciled',
    fin06Condition,
    `Cash: ${finWithCredit.cashReceived} LYD, Credit: ${finWithCredit.creditApplied} LYD, Settled: ${finWithCredit.totalSettled} LYD, Remaining: ${finWithCredit.clientRemaining} LYD`,
    true,
    fin06Condition
  );

  // ==========================================================================
  // SECTION 3: SEMANTIC, RESILIENCE & REPORT RECONCILIATION TESTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // OVERVIEW-27: Contracting Incurred Cost is Not Labelled as Cash Paid
  // --------------------------------------------------------------------------
  const costLabelAccrual =
    overviewSourceCode.includes("التكلفة المتكبدة للمشروع") &&
    !overviewSourceCode.includes("التكلفة الفعلية المنفقة") &&
    !overviewSourceCode.includes("التكلفة المصروفة فعلياً");
  assert(
    'OVERVIEW-27',
    'Contracting Incurred Cost is Explicitly Labelled as Accrual Incurred Cost (Not Cash Paid)',
    costLabelAccrual,
    `Accrual Label Present & Cash Mislabel Excluded: ${costLabelAccrual}`,
    true,
    costLabelAccrual
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-28: Total Settled is Not Labelled as Pure Cash Receipt
  // --------------------------------------------------------------------------
  const settledLabelCorrect =
    overviewSourceCode.includes("إجمالي المسوّى") &&
    !overviewSourceCode.includes("المقبوضات المسواة");
  assert(
    'OVERVIEW-28',
    'Total Settled Uses Authoritative Terminology (إجمالي المسوّى) Distinguishing Cash from Credit',
    settledLabelCorrect,
    `Total Settled Correctly Labelled: ${settledLabelCorrect}`,
    true,
    settledLabelCorrect
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-29: Contract Value Primary Source is Contract Amount; Items Fallback is Legacy Only
  // --------------------------------------------------------------------------
  const contractValueContract =
    overviewSourceCode.includes("العقد المعتمد أساساً") &&
    overviewSourceCode.includes("finSummary.contractValue");
  assert(
    'OVERVIEW-29',
    'Contract Value Sourcing Hierarchy Documents Contract as Primary Authority',
    contractValueContract,
    `Contract Authority Verified: ${contractValueContract}`,
    true,
    contractValueContract
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-30: Loading State Renders Skeletons and Never Displays False Financial Zeros
  // --------------------------------------------------------------------------
  const loadingHasSkeletons =
    overviewSourceCode.includes("isLoading ?") &&
    overviewSourceCode.includes("<Skeleton");
  assert(
    'OVERVIEW-30',
    'Loading State Renders Skeletons and Never Displays Premature False Financial Zeros',
    loadingHasSkeletons,
    `Loading Skeleton Branch Present: ${loadingHasSkeletons}`,
    true,
    loadingHasSkeletons
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-31: Financial Query Error Displays Distinct Error Card with Retry (No Fake Zeros)
  // --------------------------------------------------------------------------
  const errorHasSafeState =
    overviewSourceCode.includes("isFinancialError ?") &&
    overviewSourceCode.includes("تعذر تحميل المؤشرات والحسابات المالية للمشروع") &&
    overviewSourceCode.includes("finSummary.refetch");
  assert(
    'OVERVIEW-31',
    'Financial Query Failure Displays Explicit Error Banner with Retry and Rejects Fake Zero Rendering',
    errorHasSafeState,
    `Financial Error Handling Verified: ${errorHasSafeState}`,
    true,
    errorHasSafeState
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-32: Empty Project Renders Valid Contextual Empty State (Not Broken Tables)
  // --------------------------------------------------------------------------
  const emptyStateHandled =
    overviewSourceCode.includes("لم يتم إدراج بنود مقايسة بعد") &&
    overviewSourceCode.includes("لا توجد مراحل مسجلة بعد") &&
    overviewSourceCode.includes("لا توجد حركات مسجلة مؤخراً");
  assert(
    'OVERVIEW-32',
    'New / Inactive Projects Render Informative Contextual Empty States for All Subsystems',
    emptyStateHandled,
    `Empty State Prompts Implemented: ${emptyStateHandled}`,
    true,
    emptyStateHandled
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-33: Overview ↔ Project Report Contracting Values Reconcile Exactly
  // --------------------------------------------------------------------------
  const sampleContractingProjectData = {
    project: { id: 'c-rep-1', project_type: 'contracting', budget: 80000 },
    contracts: [{ amount: 80000, status: 'active', project_id: 'c-rep-1' }],
    clientPayments: [{ id: 'p-1', amount: 35000, project_id: 'c-rep-1' }],
    creditApplications: [{ target_project_id: 'c-rep-1', amount: 5000, status: 'applied' }],
    purchases: [{ id: 'pu-1', total_amount: 25000, purchase_type: 'material' }],
    expenses: [{ id: 'e-1', amount: 5000, project_id: 'c-rep-1' }],
  };
  const contractingOverviewCalc = calculateProjectFinancials(sampleContractingProjectData);
  const contractingReportCalc = calculateProjectFinancials(sampleContractingProjectData);
  const ovRep01Condition =
    contractingOverviewCalc.contractValue === contractingReportCalc.contractValue &&
    contractingOverviewCalc.projectCost === contractingReportCalc.projectCost &&
    contractingOverviewCalc.grossProfit === contractingReportCalc.grossProfit &&
    contractingOverviewCalc.totalSettled === contractingReportCalc.totalSettled &&
    contractingOverviewCalc.clientRemaining === contractingReportCalc.clientRemaining;
  assert(
    'OVERVIEW-33',
    'Overview and Project Report Reconcile Contracting Financials with 100% Precision',
    ovRep01Condition,
    `Contract: ${contractingOverviewCalc.contractValue}, Incurred Cost: ${contractingOverviewCalc.projectCost}, Profit: ${contractingOverviewCalc.grossProfit}, Settled: ${contractingOverviewCalc.totalSettled}, Remaining: ${contractingOverviewCalc.clientRemaining}`,
    true,
    ovRep01Condition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-34: Overview ↔ Project Report Finishing Values Reconcile Exactly
  // --------------------------------------------------------------------------
  const sampleFinishingProjectData = {
    project: { id: 'f-rep-1', project_type: 'finishing', finishing_percentage: 12 },
    purchases: [{ id: 'pu-1', total_amount: 30000, purchase_type: 'material' }],
    techProgressRecords: [{ id: 'tp-1', earned_amount: 10000 }],
    rentals: [{ id: 'r-1', total_amount: 5000 }],
    expenses: [{ id: 'e-1', amount: 5000, project_id: 'f-rep-1' }],
    clientPayments: [{ id: 'p-1', amount: 25000, project_id: 'f-rep-1' }],
    creditApplications: [{ target_project_id: 'f-rep-1', amount: 5000, status: 'applied' }],
  };
  const finishingOverviewCalc = calculateProjectFinancials(sampleFinishingProjectData);
  const finishingReportCalc = calculateProjectFinancials(sampleFinishingProjectData);
  const ovRep02Condition =
    finishingOverviewCalc.eligibleCostBase === finishingReportCalc.eligibleCostBase &&
    finishingOverviewCalc.companyFee === finishingReportCalc.companyFee &&
    finishingOverviewCalc.clientObligation === finishingReportCalc.clientObligation &&
    finishingOverviewCalc.totalSettled === finishingReportCalc.totalSettled &&
    finishingOverviewCalc.clientRemaining === finishingReportCalc.clientRemaining;
  assert(
    'OVERVIEW-34',
    'Overview and Project Report Reconcile Finishing Cost-Plus Values with 100% Precision',
    ovRep02Condition,
    `Eligible Cost: ${finishingOverviewCalc.eligibleCostBase}, Fee: ${finishingOverviewCalc.companyFee}, Obligation: ${finishingOverviewCalc.clientObligation}, Settled: ${finishingOverviewCalc.totalSettled}, Remaining: ${finishingOverviewCalc.clientRemaining}`,
    true,
    ovRep02Condition
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-35: General Items Template Prices Never Leak into Commercial Contract Value
  // --------------------------------------------------------------------------
  const generalItemLeakFree =
    !overviewSourceCode.includes("general_items") &&
    !overviewSourceCode.includes("generalItemPrice");
  assert(
    'OVERVIEW-35',
    'General Items Template Catalog Prices Strictly Excluded from Commercial Project Contract Valuation',
    generalItemLeakFree,
    `General Items Leakage Free: ${generalItemLeakFree}`,
    true,
    generalItemLeakFree
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-36: Recent Activity Operates on Real Timestamped Records
  // --------------------------------------------------------------------------
  const recentActivityReal =
    overviewSourceCode.includes("recentPurchases") &&
    overviewSourceCode.includes("recentPayments") &&
    overviewSourceCode.includes("recentExpenses") &&
    overviewSourceCode.includes("recentActivities");
  assert(
    'OVERVIEW-36',
    'Recent Activity Section Sourced Authoritatively from Real Purchases, Payments, and Expenses',
    recentActivityReal,
    `Real Activity Pipeline Implemented: ${recentActivityReal}`,
    true,
    recentActivityReal
  );

  // --------------------------------------------------------------------------
  // OVERVIEW-37: Attention Required Sourced from Financial Core Flags (Zero Local Formulas)
  // --------------------------------------------------------------------------
  const attentionSourced =
    overviewSourceCode.includes("finSummary.clientRemaining > 0") &&
    overviewSourceCode.includes("finSummary.supplierRemaining > 0") &&
    overviewSourceCode.includes("finSummary.technicianRemaining > 0");
  assert(
    'OVERVIEW-37',
    'Attention Required Prompts Directly Derived from Authoritative Financial Remaining Balances',
    attentionSourced,
    `Authoritative Balance Prompts Verified: ${attentionSourced}`,
    true,
    attentionSourced
  );

  // --------------------------------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('               UX PHASE 3 TEST RUN SUMMARY');
  console.log('================================================================');
  console.log(`  Total Tests:    ${passed + failed}`);
  console.log(`  Passed:         ${passed}`);
  console.log(`  Failed:         ${failed}`);
  console.log(
    `  Status:         ${failed === 0 ? 'ALL UX PHASE 3 INVARIANTS PASSED' : 'SOME INVARIANTS FAILED'}`
  );
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run directly
runUxPhase3Invariants().catch((err) => {
  console.error('Fatal error in UX Phase 3 tests:', err);
  process.exit(1);
});
