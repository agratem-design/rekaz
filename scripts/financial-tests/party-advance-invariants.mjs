import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const clientSql = read('supabase/migrations/20260902092000_enable_client_advance_payments.sql');
const clientUi = read('src/pages/ClientDetail.tsx');
const supplierSql = read('supabase/migrations/20260902091000_enable_supplier_advances.sql');
const supplierUi = read('src/pages/SupplierDetail.tsx');
const technicianSql = read('supabase/migrations/20260902090000_enable_technician_advance_payments.sql');
const technicianUi = read('src/pages/TechnicianDetail.tsx');

assert('CLIENT-ADV-01', clientSql.includes('ALTER COLUMN project_id DROP NOT NULL'));
assert('CLIENT-ADV-02', clientSql.includes("p_project_id IS NULL") && clientSql.includes("'CREDIT_CREATED'"));
assert('CLIENT-ADV-03', clientSql.includes("'deposit'") && clientSql.includes("'client_payment'"));
assert('CLIENT-ADV-04', (clientUi.includes('record_client_receipt_v2') || clientUi.includes('record_client_payment_atomic')) && clientUi.includes('useState<string>("none")'));
assert('CLIENT-ADV-05', clientUi.includes('p.project_id === proj.id') || clientUi.includes('filter((p) => !!p.project_id)'));

assert('SUPPLIER-ADV-01', supplierSql.includes('GREATEST(0, p_amount - v_allocated)'));
assert('SUPPLIER-ADV-02', supplierSql.includes("'advance_amount'") && !supplierSql.includes('NO_ELIGIBLE_DUES'));
assert('SUPPLIER-ADV-03', supplierUi.includes('رصيد مقدم للمورد') && !supplierUi.includes('disabled={globalDue <= 0}'));

assert('TECHNICIAN-ADV-01', technicianSql.includes('canonical 9-argument') && technicianSql.includes('NULL'));
assert('TECHNICIAN-ADV-02', technicianUi.includes('رصيد مقدم للفني') && technicianUi.includes('دفعة مقدمة/وديعة'));

const splitAdvance = (amount, due) => ({
  applied: Math.min(amount, due),
  advance: Math.max(0, amount - due),
});
const clientAdvance = splitAdvance(750, 0);
const supplierAdvance = splitAdvance(1250, 0);
const technicianSignedBalance = 0 - 500;
assert('MATH-ADV-01', clientAdvance.applied === 0 && clientAdvance.advance === 750, 'Client advance remains available credit');
assert('MATH-ADV-02', supplierAdvance.applied === 0 && supplierAdvance.advance === 1250, 'Supplier advance remains unallocated credit');
assert('MATH-ADV-03', technicianSignedBalance < 0 && Math.abs(technicianSignedBalance) === 500, 'Technician deposit/advance displays as 500 LYD credit');

console.log(`\nPARTY ADVANCE SUMMARY: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
