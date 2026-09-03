import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectEntities() {
  console.log("=== SUPPLIERS AUDIT ===");
  const { data: suppliers } = await supabase.from('suppliers').select('id, name');
  const { data: purchases } = await supabase.from('purchases').select('id, supplier_id, invoice_number, total_amount, paid_amount, status, project_id, projects(name, project_type)');
  
  for (const s of suppliers) {
    const sPurchases = purchases.filter(p => p.supplier_id === s.id);
    const totalInvoices = sPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const totalPaid = sPurchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
    const due = totalInvoices - totalPaid;
    console.log(`Supplier [${s.name}] (ID: ${s.id}): Purchases = ${sPurchases.length}, Total = ${totalInvoices}, Paid = ${totalPaid}, Due = ${due}`);
    sPurchases.forEach(p => {
      console.log(`  - Inv: ${p.invoice_number}, Total: ${p.total_amount}, Paid: ${p.paid_amount}, Status: ${p.status}, Project: ${p.projects?.name} (${p.projects?.project_type})`);
    });
  }

  console.log("\n=== TECHNICIANS AUDIT ===");
  const { data: technicians } = await supabase.from('technicians').select('id, name');
  const { data: progress } = await supabase.from('technician_progress_records').select('id, technician_id, earned_amount, project_id, projects(name, project_type)');
  const { data: expenses } = await supabase.from('expenses').select('id, technician_id, amount, project_id').eq('type', 'labor');
  const { data: techPayments } = await supabase.from('technician_payments').select('id, technician_id, amount');

  for (const t of technicians) {
    const tProgress = progress.filter(p => p.technician_id === t.id);
    const tExpenses = expenses.filter(e => e.technician_id === t.id);
    const tPays = techPayments.filter(tp => tp.technician_id === t.id);
    const totalEarned = tProgress.reduce((sum, p) => sum + Number(p.earned_amount || 0), 0);
    const totalPaid = tExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) + tPays.reduce((sum, tp) => sum + Number(tp.amount || 0), 0);
    const due = totalEarned - totalPaid;
    console.log(`Technician [${t.name}] (ID: ${t.id}): Progress = ${tProgress.length}, Earned = ${totalEarned}, Paid = ${totalPaid}, Due = ${due}`);
  }

  console.log("\n=== TREASURIES AUDIT ===");
  const { data: treasuries } = await supabase.from('treasuries').select('id, name, treasury_type, project_category, balance, is_active');
  treasuries.forEach(tr => {
    console.log(`Treasury [${tr.name}] (ID: ${tr.id}): Category = ${tr.project_category}, Balance = ${tr.balance}, Active = ${tr.is_active}`);
  });
}

inspectEntities();
