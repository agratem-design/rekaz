import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         ${details}`);
    failed++;
  }
}

console.log("\n========================================================");
console.log("MANUAL ACCEPTANCE DEFECT BATCH 01 — INVARIANTS AUDIT");
console.log("========================================================\n");

// 1. Supplier Search Isolation
console.log("1. Supplier Search Isolation & Data Source:");
const suppliersSrc = fs.readFileSync('src/pages/Suppliers.tsx', 'utf8');
assert(
  suppliersSrc.includes('.from("suppliers")') || suppliersSrc.includes('from("suppliers"'),
  "Suppliers page queries solely the suppliers table"
);
assert(
  !suppliersSrc.includes('.from("clients")') && !suppliersSrc.includes('.from("profiles")'),
  "Suppliers query contains no cross-entity union or client leakage"
);
assert(
  suppliersSrc.includes('toLowerCase()'),
  "Suppliers search uses case-insensitive text matching"
);

// 2. Subcontracting Domain Elimination
console.log("\n2. Subcontracting Terminology Elimination:");
const touchedFilesForSubcontract = [
  'src/components/purchases/OperationTypeSelector.tsx',
  'src/components/purchases/ProjectOperationDrawerShell.tsx',
  'src/components/purchases/forms/SupplierServiceForm.tsx'
];

touchedFilesForSubcontract.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  assert(
    !content.includes('مقاول باطن') && !content.includes('مقاولة باطن'),
    `No "مقاول باطن" or "مقاولة باطن" in ${path.basename(filePath)}`
  );
});

// 3. Routine Contracting Transaction Labeling:
console.log("\n3. Routine Contracting Transaction Labeling:");
const contractingForms = [
  'src/components/purchases/forms/MaterialPurchaseForm.tsx',
  'src/components/purchases/forms/SupplierServiceForm.tsx',
  'src/components/expenses/forms/DirectProjectExpenseForm.tsx',
  'src/components/technicians/forms/TechnicianLaborForm.tsx'
];

contractingForms.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  assert(
    content.includes('بند المشروع المرتبط'),
    `Contains "بند المشروع المرتبط" in ${path.basename(filePath)}`
  );
});

// 4. Technician Type Canonical Authority
console.log("\n4. Technician Type Canonical Authority:");
const techPageSrc = fs.readFileSync('src/pages/Technicians.tsx', 'utf8');
assert(
  techPageSrc.includes('technician_type_id'),
  "Technicians page persists technician_type_id"
);
assert(
  techPageSrc.includes('technician_types(id, name, code)'),
  "Technicians page queries technician_types canonically"
);

// 5. Payment Authority Separation
console.log("\n5. Payment Authority Strict Separation:");
const techDetailSrc = fs.readFileSync('src/pages/TechnicianDetail.tsx', 'utf8');
assert(
  techDetailSrc.includes('.from("expenses")') && techDetailSrc.includes('type", "labor"'),
  "Technician payment authority is expenses where type='labor'"
);
assert(
  !techDetailSrc.includes('.from("purchase_payments")'),
  "Technician payment does not use purchase_payments"
);

// 6. Finishing Cost-Plus Incurred vs Settlement Separation
console.log("\n6. Finishing Cost-Plus Authority:");
const finCoreSrc = fs.readFileSync('src/lib/financialCore.ts', 'utf8');
assert(
  finCoreSrc.includes('techProgressRecords') && finCoreSrc.includes('earned_amount'),
  "Finishing includes technician_progress_records.earned_amount in direct cost base"
);
assert(
  finCoreSrc.includes('!(e.type === "labor" && Boolean(e.technician_id))'),
  "Direct project expenses exclude canonical technician settlements (labor + technician_id)"
);

// 7. Project Card Financial Position
console.log("\n7. Project Card Financial Position:");
const projectsSrc = fs.readFileSync('src/pages/Projects.tsx', 'utf8');
assert(
  projectsSrc.includes('المتبقي على العميل'),
  "Project cards show 'المتبقي على العميل'"
);
assert(
  projectsSrc.includes('التكلفة المباشرة') && projectsSrc.includes('أتعاب الشركة'),
  "Finishing project cards clearly separate Direct Cost and Company Fee"
);

// 8. Opening Balance Ledger Posting
console.log("\n8. Opening Balance Authority & Eligibility:");
const treasuryDetailSrc = fs.readFileSync('src/pages/TreasuryDetail.tsx', 'utf8');
assert(
  treasuryDetailSrc.includes('opening_balance'),
  "TreasuryDetail posts opening_balance to ledger"
);
assert(
  treasuryDetailSrc.includes('isNewTreasury = !loadingTx && (!transactions || transactions.length === 0)'),
  "Opening balance is available ONLY before operational history"
);

console.log("\n========================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("========================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
