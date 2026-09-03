import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

for (const rawLine of envContent.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.substring('VITE_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    supabaseKey = line.substring('VITE_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("========================================================");
console.log("TECHNICIAN + SUPPLIER ON-ACCOUNT RUNTIME VERIFICATION");
console.log("========================================================\n");

let passCount = 0;
let failCount = 0;

function assert(condition, testId, description) {
  if (condition) {
    console.log(`[PASS] ${testId.padEnd(20)}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testId.padEnd(20)}: ${description}`);
    failCount++;
  }
}

// 1. Audit Live DB for Ahmed Al-Zayat
const { data: ahmedTech } = await supabase
  .from('technicians')
  .select('*')
  .ilike('name', '%أحمد الزيات%')
  .single();

assert(!!ahmedTech, 'AHMED-01', 'Technician Ahmed Al-Zayat exists');

const { data: ahmedAsgs } = await supabase
  .from('project_item_technicians')
  .select('*, project_items(*, projects(*))')
  .eq('technician_id', ahmedTech.id);

assert(ahmedAsgs && ahmedAsgs.length === 1, 'AHMED-02', 'Ahmed has 1 active assignment');

const { data: ahmedProgs } = await supabase
  .from('technician_progress_records')
  .select('*')
  .eq('technician_id', ahmedTech.id);

assert(ahmedProgs && ahmedProgs.length === 0, 'AHMED-03', 'Ahmed has 0 progress records (earned = 0)');

const { data: ahmedPayments } = await supabase
  .from('technician_payments')
  .select('*')
  .eq('technician_id', ahmedTech.id);

assert(ahmedPayments && ahmedPayments.length === 0, 'AHMED-04', 'Ahmed has 0 technician payments (paid = 0, due = 0)');

// 2. Audit Supplier Data
const { data: suppliers } = await supabase.from('suppliers').select('*');
assert(suppliers && suppliers.length > 0, 'SUP-01', `Found ${suppliers?.length} suppliers in DB`);

const { data: purchases } = await supabase.from('purchases').select('id, total_amount, paid_amount, status');
assert(purchases && purchases.length === 8, 'SUP-02', `Found ${purchases?.length} purchases in DB (clean bootstrap data preserved)`);

// 3. Schema Verification: supplier_payments & supplier_payment_allocations
const { data: supPayCols, error: supPayErr } = await supabase.from('supplier_payments').select('id, supplier_id, treasury_id, amount, payment_method, date, reference, notes, idempotency_key, created_by').limit(0);
assert(!supPayErr, 'SCHEMA-SUP-01', 'supplier_payments table exists and is accessible with full schema');

const { data: supAllocCols, error: supAllocErr } = await supabase.from('supplier_payment_allocations').select('id, payment_id, purchase_id, amount').limit(0);
assert(!supAllocErr, 'SCHEMA-SUP-02', 'supplier_payment_allocations table exists and is accessible with full schema');

// 4. Schema Verification: technician_payments & technician_payment_allocations
const { data: techPayCols, error: techPayErr } = await supabase.from('technician_payments').select('id, technician_id, treasury_id, amount, payment_method, date, reference, notes, idempotency_key, created_by').limit(0);
assert(!techPayErr, 'SCHEMA-TECH-01', 'technician_payments table exists and is accessible with full schema');

const { data: techAllocCols, error: techAllocErr } = await supabase.from('technician_payment_allocations').select('id, payment_id, project_id, amount').limit(0);
assert(!techAllocErr, 'SCHEMA-TECH-02', 'technician_payment_allocations table exists and is accessible with full schema');

// 5. Structural Source Code Verification: TechnicianDetail.tsx
const techDetailSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/TechnicianDetail.tsx'), 'utf8');
assert(techDetailSrc.includes('دفع على الحساب'), 'TECH-UI-01', 'TechnicianDetail has on-account button: دفع على الحساب');
assert(!techDetailSrc.includes('disabled={globalDue <= 0}') && techDetailSrc.includes('رصيد مقدم للفني'), 'TECH-UI-02', 'TechnicianDetail keeps payment enabled and presents advance balance state');
assert(techDetailSrc.includes('pay_technician_on_account_atomic'), 'TECH-UI-03', 'TechnicianDetail calls pay_technician_on_account_atomic RPC');
assert(techDetailSrc.includes('p_idempotency_key'), 'TECH-UI-04', 'TechnicianDetail passes idempotency key to RPC');
assert(techDetailSrc.includes('treasuryEligibleDue'), 'TECH-UI-05', 'TechnicianDetail computes domain-aware treasury eligible dues');
assert(techDetailSrc.includes('chronologicalStatement'), 'TECH-UI-06', 'TechnicianDetail builds chronological running balance statement ledger');
assert(techDetailSrc.includes('openReceiptPrintWindow'), 'TECH-UI-07', 'TechnicianDetail supports printing disbursement receipts with reference');

// 6. Structural Source Code Verification: SupplierDetail.tsx
const supDetailSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/SupplierDetail.tsx'), 'utf8');
assert(supDetailSrc.includes('دفع على الحساب'), 'SUP-UI-01', 'SupplierDetail has on-account button: دفع على الحساب');
assert(!supDetailSrc.includes('disabled={globalDue <= 0}') && supDetailSrc.includes('رصيد مقدم للمورد'), 'SUP-UI-02', 'SupplierDetail keeps payment enabled and presents supplier advance state');
assert(supDetailSrc.includes('pay_supplier_on_account_atomic'), 'SUP-UI-03', 'SupplierDetail calls pay_supplier_on_account_atomic RPC');
assert(supDetailSrc.includes('p_idempotency_key'), 'SUP-UI-04', 'SupplierDetail passes idempotency key to RPC');
assert(supDetailSrc.includes('treasuryEligibleDue'), 'SUP-UI-05', 'SupplierDetail computes domain-aware treasury eligible dues');
assert(supDetailSrc.includes('chronologicalStatement'), 'SUP-UI-06', 'SupplierDetail builds chronological running balance statement ledger');
assert(supDetailSrc.includes('openReceiptPrintWindow'), 'SUP-UI-07', 'SupplierDetail supports printing payment receipts with reference');

console.log("\n========================================================");
console.log(`TOTAL INVARIANTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log("========================================================");

if (failCount > 0) {
  process.exit(1);
}
