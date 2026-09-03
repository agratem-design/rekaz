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

console.log("=== STEP 1: AUDIT LIVE TECHNICIANS & SUPPLIERS DATA ===");

// 1. Technicians
const { data: technicians } = await supabase
  .from('technicians')
  .select('id, name, specialty');

for (const t of (technicians || [])) {
  const { data: progs } = await supabase.from('technician_progress_records').select('earned_amount, project_id').eq('technician_id', t.id);
  const { data: exps } = await supabase.from('expenses').select('amount, project_id, type').eq('technician_id', t.id).eq('type', 'labor');
  const totalEarned = (progs || []).reduce((sum, p) => sum + Number(p.earned_amount || 0), 0);
  const totalPaid = (exps || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const due = totalEarned - totalPaid;
  console.log(`Technician: ${t.name} (id: ${t.id}) | Earned: ${totalEarned} | Paid: ${totalPaid} | Due: ${due}`);
}

// 2. Suppliers
const { data: suppliers } = await supabase
  .from('suppliers')
  .select('id, name');

for (const s of (suppliers || [])) {
  const { data: purchases } = await supabase.from('purchases').select('id, invoice_number, total_amount, paid_amount, status').eq('supplier_id', s.id);
  const totalPurchases = (purchases || []).reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const totalPaid = (purchases || []).reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const due = totalPurchases - totalPaid;
  console.log(`Supplier: ${s.name} (id: ${s.id}) | Total: ${totalPurchases} | Paid: ${totalPaid} | Due: ${due} | Purchases Count: ${purchases?.length}`);
  if (purchases && purchases.length > 0) {
    for (const pur of purchases) {
      console.log(`  - Purchase #${pur.invoice_number} | Total: ${pur.total_amount} | Paid: ${pur.paid_amount} | Status: ${pur.status}`);
    }
  }
}

// 3. Treasuries
const { data: treasuries } = await supabase.from('treasuries').select('id, name, treasury_type, balance, is_active');
console.log("\n=== TREASURIES ===");
for (const tr of (treasuries || [])) {
  console.log(`Treasury: ${tr.name} (${tr.id}) | Type: ${tr.treasury_type} | Balance: ${tr.balance} | Active: ${tr.is_active}`);
}

console.log("\n=== STEP 2: TEST CALLING RPCs TO CAPTURE REAL RUNTIME ERROR ===");

// Let's test calling pay_supplier_on_account_atomic
const testSupplierId = '9ccae955-17b4-4448-b780-7b89bb17607c'; // عريبي
const testTreasuryId = treasuries[0]?.id;

console.log("\n1. Calling pay_supplier_on_account_atomic with anon client:");
const res1 = await supabase.rpc('pay_supplier_on_account_atomic', {
  p_supplier_id: testSupplierId,
  p_treasury_id: testTreasuryId,
  p_amount: 100,
  p_payment_method: 'cash',
  p_date: '2026-08-31',
  p_notes: 'Test on account payment',
  p_reference: 'REF-TEST-01'
});
console.log("Result 1 (Anon):", JSON.stringify(res1, null, 2));

// Let's test calling pay_technician_on_account_atomic
const testTechId = 'f71cd19a-5bed-4687-aaf9-a6d3c70697b6'; // أحمد الزيات
console.log("\n2. Calling pay_technician_on_account_atomic with anon client:");
const res2 = await supabase.rpc('pay_technician_on_account_atomic', {
  p_technician_id: testTechId,
  p_treasury_id: testTreasuryId,
  p_amount: 100,
  p_payment_method: 'cash',
  p_date: '2026-08-31',
  p_notes: 'Test on account payment',
  p_reference: 'REF-TEST-02'
});
console.log("Result 2 (Anon):", JSON.stringify(res2, null, 2));

