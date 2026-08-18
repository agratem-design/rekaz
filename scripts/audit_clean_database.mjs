import { supabase } from './financial-tests/client.mjs';

async function auditCleanDatabase() {
  console.log('========================================================');
  console.log('RAKAZ MANUAL ACCEPTANCE DATABASE — CLEAN AUDIT VERIFICATION');
  console.log('========================================================\n');

  const { data: clients } = await supabase.from('clients').select('id');
  const { data: projects } = await supabase.from('projects').select('id');
  const { data: phases } = await supabase.from('project_phases').select('id');
  const { data: contracts } = await supabase.from('contracts').select('id');
  const { data: generalItems } = await supabase.from('general_project_items').select('id');
  const { data: projectItems } = await supabase.from('project_items').select('id');
  const { data: suppliers } = await supabase.from('suppliers').select('id');
  const { data: purchases } = await supabase.from('purchases').select('id');
  const { data: purchasePayments } = await supabase.from('purchase_payments').select('id');
  const { data: technicians } = await supabase.from('technicians').select('id');
  const { data: techProgress } = await supabase.from('technician_progress_records').select('id');
  const { data: expenses } = await supabase.from('expenses').select('id');
  const { data: equipment } = await supabase.from('equipment').select('id');
  const { data: eqRentals } = await supabase.from('equipment_rentals').select('id');
  const { data: clientPayments } = await supabase.from('client_payments').select('id');
  const { data: clientCredits } = await supabase.from('client_credit_ledger').select('id');
  const { data: transfers } = await supabase.from('transfers').select('id');
  const { data: treasuries } = await supabase.from('treasuries').select('*').order('name');
  const { data: treasuryTx } = await supabase.from('treasury_transactions').select('*');
  const { data: companySettings } = await supabase.from('company_settings').select('*');

  console.log('1. BUSINESS MASTER & TRANSACTIONAL COUNTS:');
  console.log(`- CLIENTS COUNT: ${(clients || []).length}`);
  console.log(`- PROJECTS COUNT: ${(projects || []).length}`);
  console.log(`- PROJECT_PHASES COUNT: ${(phases || []).length}`);
  console.log(`- CONTRACTS COUNT: ${(contracts || []).length}`);
  console.log(`- GENERAL_ITEMS COUNT: ${(generalItems || []).length}`);
  console.log(`- PROJECT_ITEMS (BOQ) COUNT: ${(projectItems || []).length}`);
  console.log(`- SUPPLIERS COUNT: ${(suppliers || []).length}`);
  console.log(`- PURCHASES COUNT: ${(purchases || []).length}`);
  console.log(`- PURCHASE_PAYMENTS COUNT: ${(purchasePayments || []).length}`);
  console.log(`- TECHNICIANS COUNT: ${(technicians || []).length}`);
  console.log(`- TECHNICIAN_PROGRESS COUNT: ${(techProgress || []).length}`);
  console.log(`- EXPENSES (ALL) COUNT: ${(expenses || []).length}`);
  console.log(`- CLIENT_PAYMENTS COUNT: ${(clientPayments || []).length}`);
  console.log(`- CLIENT_CREDIT_LEDGER COUNT: ${(clientCredits || []).length}`);
  console.log(`- TRANSFERS COUNT: ${(transfers || []).length}`);
  console.log(`- EQUIPMENT COUNT: ${(equipment || []).length}`);
  console.log(`- EQUIPMENT_RENTALS COUNT: ${(eqRentals || []).length}`);
  console.log(`- TREASURY_TRANSACTIONS COUNT: ${(treasuryTx || []).length}`);

  console.log('\n2. TREASURY BALANCES & LEDGER RECONCILIATION:');
  console.log('| Treasury Name | Type | Category | Stored Balance | Reconstructed Ledger | Discrepancy |');
  console.log('|---|---|---|---|---|---|');
  let totalDiscrepancy = 0;
  for (const tr of treasuries || []) {
    const txForTr = (treasuryTx || []).filter(tx => tx.treasury_id === tr.id);
    const ledgerBalance = txForTr.reduce((s, tx) => s + (tx.type === 'deposit' ? Number(tx.amount) : -Number(tx.amount)), 0);
    const diff = Math.abs(Number(tr.balance) - ledgerBalance);
    totalDiscrepancy += diff;
    console.log(`| ${tr.name} | ${tr.treasury_type} | ${tr.project_category} | ${Number(tr.balance).toFixed(2)} د.ل | ${ledgerBalance.toFixed(2)} د.ل | ${diff.toFixed(2)} د.ل |`);
  }
  console.log(`\n- TOTAL DISCREPANCY ACROSS ALL TREASURIES: ${totalDiscrepancy.toFixed(2)} د.ل`);

  console.log('\n3. COMPANY SETTINGS BOOTSTRAP:');
  const cs = (companySettings || [])[0];
  console.log(`- Company Settings Row Exists: ${Boolean(cs)}`);
  console.log(`- Company Name: ${cs?.company_name}`);
  console.log(`- Contracting Treasury ID: ${cs?.contracting_treasury_id} (Valid: ${treasuries?.some(t => t.id === cs?.contracting_treasury_id)})`);
  console.log(`- Finishing Treasury ID: ${cs?.finishing_treasury_id} (Valid: ${treasuries?.some(t => t.id === cs?.finishing_treasury_id)})`);

  console.log('\n4. CLEAN STATE CONCLUSION:');
  const allClean = 
    (clients || []).length === 0 &&
    (projects || []).length === 0 &&
    (phases || []).length === 0 &&
    (contracts || []).length === 0 &&
    (generalItems || []).length === 0 &&
    (projectItems || []).length === 0 &&
    (suppliers || []).length === 0 &&
    (purchases || []).length === 0 &&
    (purchasePayments || []).length === 0 &&
    (technicians || []).length === 0 &&
    (expenses || []).length === 0 &&
    (clientPayments || []).length === 0 &&
    (transfers || []).length === 0 &&
    (equipment || []).length === 0 &&
    (treasuryTx || []).length === 0 &&
    totalDiscrepancy === 0;

  console.log(`- ALL BUSINESS DATA ZERO: ${allClean}`);
  console.log(`- READY FOR MANUAL USER TESTING: ${allClean}`);
}

auditCleanDatabase().catch(console.error);
