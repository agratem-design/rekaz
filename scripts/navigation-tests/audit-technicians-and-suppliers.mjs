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

console.log("=== 1. AUDITING ALL TECHNICIANS ===");
const { data: technicians, error: techErr } = await supabase
  .from('technicians')
  .select('id, name, specialty, technician_type_id');

console.log("Technicians count:", technicians?.length);
for (const t of (technicians || [])) {
  const { data: asgs } = await supabase
    .from('project_item_technicians')
    .select('id, project_item_id, rate, total_cost, created_at, project_items(id, name, project_id, projects(id, name))')
    .eq('technician_id', t.id);

  const { data: progs } = await supabase
    .from('technician_progress_records')
    .select('id, project_id, earned_amount, date, notes, projects(id, name)')
    .eq('technician_id', t.id);

  const { data: exps } = await supabase
    .from('expenses')
    .select('id, project_id, amount, date, description, type, projects(id, name)')
    .eq('technician_id', t.id);

  console.log(`\nTechnician: [${t.name}] (ID: ${t.id})`);
  console.log(`- Assignments (${asgs?.length || 0}):`, asgs);
  console.log(`- Progress Records (${progs?.length || 0}):`, progs);
  console.log(`- Expenses / Payments (${exps?.length || 0}):`, exps);
}

console.log("\n=== 2. AUDITING ALL SUPPLIERS ===");
const { data: suppliers, error: supErr } = await supabase
  .from('suppliers')
  .select('id, name');

console.log("Suppliers count:", suppliers?.length);
for (const s of (suppliers || [])) {
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, project_id, total_amount, paid_amount, payment_status, item_name, projects(id, name)')
    .eq('supplier_id', s.id);

  let totalPurchases = 0;
  let totalPayments = 0;
  if (purchases && purchases.length > 0) {
    const purchaseIds = purchases.map(p => p.id);
    totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

    const { data: payments } = await supabase
      .from('purchase_payments')
      .select('id, purchase_id, amount, payment_date')
      .in('purchase_id', purchaseIds);

    totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  }

  console.log(`\nSupplier: [${s.name}] (ID: ${s.id})`);
  console.log(`- Purchases (${purchases?.length || 0}): Total = ${totalPurchases}, Paid = ${totalPayments}, Due = ${totalPurchases - totalPayments}`);
}
