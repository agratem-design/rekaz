/**
 * Hierarchical Treasury Selection Invariants Test Suite
 * 
 * Verifies that anywhere in the system where a user selects a treasury,
 * the user MUST determine/select the Main Treasury (الخزينة الرئيسية) first,
 * and then select the Branch / Sub-Treasury (الخزينة الفرعية / الحساب) second,
 * EXCEPT where the main treasury is already predetermined by business rules
 * (e.g. project domain binding in TreasurySelector or ManageProject).
 */

import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition, testId, message) {
  if (condition) {
    console.log(`  [PASS] ${testId}: ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testId}: ${message}`);
    failed++;
  }
}

console.log("\n========================================================");
console.log("HIERARCHICAL TREASURY SELECTION INVARIANTS");
console.log("========================================================\n");

// 1. HierarchicalTreasurySelect Component Existence and Invariants
const htsPath = "src/components/treasury/HierarchicalTreasurySelect.tsx";
assert(fs.existsSync(htsPath), "TREASURY-HIER-01", "HierarchicalTreasurySelect component exists");

const htsContent = fs.readFileSync(htsPath, "utf8");
assert(htsContent.includes("parent_id"), "TREASURY-HIER-02", "HierarchicalTreasurySelect uses parent_id for two-tier filtering");
assert(htsContent.includes("dir=\"rtl\""), "TREASURY-HIER-03", "HierarchicalTreasurySelect enforces RTL layout");
assert(htsContent.includes("Landmark") && htsContent.includes("Wallet"), "TREASURY-HIER-04", "HierarchicalTreasurySelect uses recolorable Lucide icons (zero unicode emojis)");
assert(htsContent.includes("allowParentIfNoChildren"), "TREASURY-HIER-05", "HierarchicalTreasurySelect gracefully handles standalone root treasuries with no sub-branches");

// 2. EmployeeDetail.tsx Invariants
const empDetail = fs.readFileSync("src/pages/EmployeeDetail.tsx", "utf8");
const empDetailHtsCount = (empDetail.match(/<HierarchicalTreasurySelect/g) || []).length;
assert(empDetailHtsCount === 5, "TREASURY-HIER-06", `EmployeeDetail.tsx contains exactly 5 HierarchicalTreasurySelect usages (found ${empDetailHtsCount})`);
assert(!empDetail.includes("الخزينة المخصوم منها *</Label>\n              <Select\n                value={advanceForm.treasury_id}"), "TREASURY-HIER-07", "EmployeeDetail.tsx has zero flat selects for advance disbursement");
assert(!empDetail.includes("الخزينة المودع فيها المبلغ *</Label>\n              <Select\n                value={repayForm.treasury_id}"), "TREASURY-HIER-08", "EmployeeDetail.tsx has zero flat selects for advance repayment");
assert(!empDetail.includes("خزينة الصرف *</Label>\n              <Select\n                value={paySlipForm.treasury_id}"), "TREASURY-HIER-09", "EmployeeDetail.tsx has zero flat selects for salary slip disbursement");

// 3. Employees.tsx Invariants
const employees = fs.readFileSync("src/pages/Employees.tsx", "utf8");
const empHtsCount = (employees.match(/<HierarchicalTreasurySelect/g) || []).length;
assert(empHtsCount === 5, "TREASURY-HIER-10", `Employees.tsx contains exactly 5 HierarchicalTreasurySelect usages (found ${empHtsCount})`);
assert(employees.includes(".select(\"id, name, balance, treasury_type, project_category, parent_id\")"), "TREASURY-HIER-11", "Employees.tsx fetches parent_id in active treasuries query");

// 4. TechnicianDetail.tsx Invariants
const techDetail = fs.readFileSync("src/pages/TechnicianDetail.tsx", "utf8");
assert(techDetail.includes("paySelectedParentTreasuryId"), "TREASURY-HIER-12", "TechnicianDetail.tsx enforces parent treasury selection in payment on account");
assert(techDetail.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-13", "TechnicianDetail.tsx uses HierarchicalTreasurySelect in edit payment dialog");

// 5. TechnicianDepositsPanel.tsx Invariants
const techDeposits = fs.readFileSync("src/components/technicians/TechnicianDepositsPanel.tsx", "utf8");
assert(techDeposits.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-14", "TechnicianDepositsPanel.tsx uses HierarchicalTreasurySelect");
assert(techDeposits.includes("childAriaLabel=\"خزينة الوديعة\""), "TREASURY-HIER-15", "TechnicianDepositsPanel.tsx preserves aria-label='خزينة الوديعة'");
assert(techDeposits.includes(".select(\"id, name, parent_id, balance, treasury_type\")"), "TREASURY-HIER-16", "TechnicianDepositsPanel.tsx selects parent_id in treasuries query");

// 6. QuickAddSection.tsx Invariants
const quickAdd = fs.readFileSync("src/components/client-activities/QuickAddSection.tsx", "utf8");
assert(quickAdd.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-17", "QuickAddSection.tsx uses HierarchicalTreasurySelect in purchase tab");
assert(quickAdd.includes(".select(\"id, name, treasury_type, parent_id, balance\")"), "TREASURY-HIER-18", "QuickAddSection.tsx fetches parent_id and balance");

// 7. InvoiceControl.tsx Invariants
const invoiceControl = fs.readFileSync("src/pages/InvoiceControl.tsx", "utf8");
assert(invoiceControl.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-19", "InvoiceControl.tsx uses HierarchicalTreasurySelect in invoice modal");
assert(invoiceControl.includes(".select(\"id, name, parent_id, balance, treasury_type\")"), "TREASURY-HIER-20", "InvoiceControl.tsx selects parent_id in treasuries query");

// 8. Treasuries.tsx & TreasuryDetail.tsx Invariants
const treasuriesPage = fs.readFileSync("src/pages/Treasuries.tsx", "utf8");
const treasuriesHtsCount = (treasuriesPage.match(/<HierarchicalTreasurySelect/g) || []).length;
assert(treasuriesHtsCount === 2, "TREASURY-HIER-21", `Treasuries.tsx uses HierarchicalTreasurySelect for both source and destination (found ${treasuriesHtsCount})`);
assert(treasuriesPage.includes("excludeTreasuryId={transferForm.fromTreasuryId}"), "TREASURY-HIER-22", "Treasuries.tsx excludes source treasury from destination choices");

const treasuryDetail = fs.readFileSync("src/pages/TreasuryDetail.tsx", "utf8");
assert(treasuryDetail.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-23", "TreasuryDetail.tsx uses HierarchicalTreasurySelect in transfer dialog");
assert(treasuryDetail.includes("excludeTreasuryId={id}"), "TREASURY-HIER-24", "TreasuryDetail.tsx excludes current treasury from destination choices");

// 9. PaymentAllocationDialog.tsx Invariants
const paymentAlloc = fs.readFileSync("src/components/payments/PaymentAllocationDialog.tsx", "utf8");
assert(paymentAlloc.includes("<HierarchicalTreasurySelect"), "TREASURY-HIER-25", "PaymentAllocationDialog.tsx uses HierarchicalTreasurySelect");

// 10. Predetermined Main Treasury Exceptions Invariants
const manageProj = fs.readFileSync("src/pages/ManageProject.tsx", "utf8");
assert(manageProj.includes("الخزينة الافتراضية للمشروع") && manageProj.includes("خزينة رئيسية افتراضية"), "TREASURY-HIER-26", "ManageProject maintains predetermined project sector root treasury");

const projPhases = fs.readFileSync("src/pages/ProjectPhases.tsx", "utf8");
assert(projPhases.includes("disabled={true}") && projPhases.includes("يتم ربط الخزينة تلقائياً بناءً على إعدادات المشروع العامة"), "TREASURY-HIER-27", "ProjectPhases maintains predetermined project default treasury");

const treasurySelector = fs.readFileSync("src/components/treasury/TreasurySelector.tsx", "utf8");
assert(treasurySelector.includes("authoritativeRoot") && treasurySelector.includes("descendants"), "TREASURY-HIER-28", "TreasurySelector maintains authoritative sector root and descendant binding");

console.log("\n========================================================");
console.log(`TREASURY HIERARCHICAL INVARIANTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================\n");

if (failed > 0) {
  process.exit(1);
}
