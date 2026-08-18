import { supabase } from './financial-tests/client.mjs';

async function runAudit() {
  console.log('========================================================');
  console.log('ZLITEN DEMO DATABASE — MACHINE-DERIVED EVIDENCE AUDIT');
  console.log('========================================================\n');

  // Fetch all tables
  const { data: projects } = await supabase.from('projects').select('*').order('name');
  const { data: clients } = await supabase.from('clients').select('*');
  const { data: suppliers } = await supabase.from('suppliers').select('*');
  const { data: technicians } = await supabase.from('technicians').select('*');
  const { data: engineers } = await supabase.from('engineers').select('*');
  const { data: employees } = await supabase.from('employees').select('*');
  const { data: phases } = await supabase.from('project_phases').select('*').order('project_id, order_index');
  const { data: items } = await supabase.from('project_items').select('*');
  const { data: contracts } = await supabase.from('contracts').select('*');
  const { data: purchases } = await supabase.from('purchases').select('*');
  const { data: purchasePayments } = await supabase.from('purchase_payments').select('*');
  const { data: techProgress } = await supabase.from('technician_progress_records').select('*');
  const { data: expenses } = await supabase.from('expenses').select('*');
  const { data: equipment } = await supabase.from('equipment').select('*');
  const { data: eqRentals } = await supabase.from('equipment_rentals').select('*');
  const { data: clientPayments } = await supabase.from('client_payments').select('*');
  const { data: creditLedger } = await supabase.from('client_credit_ledger').select('*');
  const { data: treasuries } = await supabase.from('treasuries').select('*').order('name');
  const { data: treasuryTx } = await supabase.from('treasury_transactions').select('*');

  const clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.name]));
  const supplierMap = Object.fromEntries((suppliers || []).map(s => [s.id, s.name]));
  const techMap = Object.fromEntries((technicians || []).map(t => [t.id, t.name]));
  const phaseMap = Object.fromEntries((phases || []).map(ph => [ph.id, ph.name]));
  const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p.name]));

  const contractingProjects = (projects || []).filter(p => p.project_type === 'contracting');
  const finishingProjects = (projects || []).filter(p => p.project_type === 'finishing');

  console.log('1. CORE TOTALS:');
  console.log(`- TOTAL PROJECTS: ${projects.length}`);
  console.log(`- CONTRACTING PROJECTS: ${contractingProjects.length}`);
  console.log(`- FINISHING PROJECTS: ${finishingProjects.length}`);
  console.log(`- TOTAL PROJECT_PHASES: ${phases.length}`);
  console.log(`- TOTAL PROJECT_ITEMS (BOQ): ${items.length} (Contracting: ${items.filter(i => contractingProjects.some(cp => cp.id === i.project_id)).length}, Finishing: ${items.filter(i => finishingProjects.some(fp => fp.id === i.project_id)).length})`);
  console.log(`- TOTAL CONTRACTS: ${contracts.length}`);
  console.log(`- TOTAL PURCHASES: ${purchases.length}`);
  console.log(`- TOTAL PURCHASE PAYMENTS: ${purchasePayments.length}`);
  console.log(`- TOTAL TECHNICIAN PROGRESS RECORDS: ${techProgress.length}`);
  console.log(`- TOTAL EXPENSES: ${expenses.length}`);
  console.log(`- TOTAL EQUIPMENT: ${equipment.length}`);
  console.log(`- TOTAL EQUIPMENT RENTALS: ${eqRentals.length}`);
  console.log(`- TOTAL CLIENT PAYMENTS: ${clientPayments.length}`);
  console.log(`- TOTAL CLIENT CREDIT LEDGER ENTRIES: ${creditLedger.length}`);
  console.log(`- TOTAL CANONICAL TREASURIES: ${treasuries.length}`);
  console.log(`- TOTAL TREASURY TRANSACTIONS: ${treasuryTx.length}`);

  // Zero-Phase Audit
  const activeNoPhases = projects.filter(p => p.status === 'active' && !phases.some(ph => ph.project_id === p.id)).length;
  const completedNoPhases = projects.filter(p => p.status === 'completed' && !phases.some(ph => ph.project_id === p.id)).length;
  const progressNoPhases = projects.filter(p => (p.progress || 0) > 0 && !phases.some(ph => ph.project_id === p.id)).length;

  console.log('\n2. ZERO-PHASE AUDIT:');
  console.log(`- ACTIVE PROJECTS WITH ZERO PHASES: ${activeNoPhases}`);
  console.log(`- COMPLETED PROJECTS WITH ZERO PHASES: ${completedNoPhases}`);
  console.log(`- PROJECTS WITH PROGRESS > 0 AND ZERO PHASES: ${progressNoPhases}`);

  // Phase Order Audit
  const invalidOrderPhases = phases.filter(ph => ph.order_index <= 0);
  const duplicateOrderMap = {};
  phases.forEach(ph => {
    const k = `${ph.project_id}_${ph.order_index}`;
    duplicateOrderMap[k] = (duplicateOrderMap[k] || 0) + 1;
  });
  const duplicateOrderCount = Object.values(duplicateOrderMap).filter(v => v > 1).length;

  console.log('\n3. PHASE ORDER AUDIT:');
  console.log(`- PHASES WITH order_index <= 0: ${invalidOrderPhases.length}`);
  console.log(`- DUPLICATE order_index WITHIN SAME PROJECT: ${duplicateOrderCount}`);

  // Cross-project / phase integrity
  const wrongPurchasePhases = purchases.filter(pu => pu.phase_id && !phases.some(ph => ph.id === pu.phase_id && ph.project_id === pu.project_id));
  const wrongTechPhases = techProgress.filter(tp => tp.phase_id && !phases.some(ph => ph.id === tp.phase_id && ph.project_id === tp.project_id));
  const wrongExpensePhases = expenses.filter(ex => ex.phase_id && !phases.some(ph => ph.id === ex.phase_id && ph.project_id === ex.project_id));

  console.log('\n4. PHASE WRONG-PROJECT INTEGRITY AUDIT:');
  console.log(`- PURCHASES ATTRIBUTED TO WRONG PROJECT PHASES: ${wrongPurchasePhases.length}`);
  console.log(`- TECH PROGRESS ATTRIBUTED TO WRONG PROJECT PHASES: ${wrongTechPhases.length}`);
  console.log(`- EXPENSES ATTRIBUTED TO WRONG PROJECT PHASES: ${wrongExpensePhases.length}`);

  // Phase Activity Coverage
  const phasesWithPurchases = new Set(purchases.filter(pu => pu.phase_id).map(pu => pu.phase_id)).size;
  const phasesWithTechProgress = new Set(techProgress.filter(tp => tp.phase_id).map(tp => tp.phase_id)).size;
  const phasesWithExpenses = new Set(expenses.filter(ex => ex.phase_id).map(ex => ex.phase_id)).size;

  console.log('\n5. PHASE ACTIVITY COVERAGE:');
  console.log(`- PROJECTS WITH PHASES: ${new Set(phases.map(ph => ph.project_id)).size} / ${projects.length}`);
  console.log(`- PHASES WITH ASSOCIATED PURCHASES: ${phasesWithPurchases}`);
  console.log(`- PHASES WITH ASSOCIATED TECHNICIAN PROGRESS: ${phasesWithTechProgress}`);
  console.log(`- PHASES WITH ASSOCIATED EXPENSES: ${phasesWithExpenses}`);

  // Project Table
  console.log('\n6. COMPLETE PROJECT TABLE:');
  console.log('| # | Project Name | Type | Status | Progress % | Total Phases | Completed | In Progress | Pending | BOQ Items |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  projects.forEach((p, idx) => {
    const pPhases = phases.filter(ph => ph.project_id === p.id);
    const completed = pPhases.filter(ph => ph.status === 'completed').length;
    const inProgress = pPhases.filter(ph => ph.status === 'in_progress').length;
    const pending = pPhases.filter(ph => ph.status === 'pending').length;
    const pItems = items.filter(it => it.project_id === p.id).length;
    console.log(`| ${idx + 1} | ${p.name} | ${p.project_type} | ${p.status} | ${p.progress}% | ${pPhases.length} | ${completed} | ${inProgress} | ${pending} | ${pItems} |`);
  });

  // Specific Scenarios
  console.log('\n7. SPECIFIC SCENARIOS:');
  
  // Supplier Al-Wared
  const alWaredId = 'c1000000-0000-0000-0000-000000000001';
  const alWaredPurchases = purchases.filter(pu => pu.supplier_id === alWaredId);
  const alWaredProjects = new Set(alWaredPurchases.map(pu => pu.project_id));
  const alWaredTotal = alWaredPurchases.reduce((s, pu) => s + Number(pu.total_amount || 0), 0);
  const alWaredPaid = alWaredPurchases.reduce((s, pu) => s + Number(pu.paid_amount || 0), 0);
  console.log(`- Supplier 'مؤسسة الوارد لمواد البناء والخرسانة': Purchases=${alWaredPurchases.length}, Projects=${alWaredProjects.size}, Total=${alWaredTotal.toLocaleString()} LYD, Paid=${alWaredPaid.toLocaleString()} LYD, Due=${(alWaredTotal - alWaredPaid).toLocaleString()} LYD`);

  // Technician Ahmed Mostafa
  const techAhmedId = 'd1000000-0000-0000-0000-000000000001';
  const techAhmedProgress = techProgress.filter(tp => tp.technician_id === techAhmedId);
  const techAhmedProjects = [...new Set(techAhmedProgress.map(tp => tp.project_id))];
  const techAhmedEarned = techAhmedProgress.reduce((s, tp) => s + Number(tp.earned_amount || 0), 0);
  const techAhmedPaid = expenses.filter(ex => ex.technician_id === techAhmedId).reduce((s, ex) => s + Number(ex.amount || 0), 0);
  console.log(`- Technician 'أحمد مصطفى محمود' (كهربائي عام): Projects=${techAhmedProjects.length} (${techAhmedProjects.map(pid => projectMap[pid]).join(', ')}), Total Earned=${techAhmedEarned.toLocaleString()} LYD, Total Paid=${techAhmedPaid.toLocaleString()} LYD, Total Due=${(techAhmedEarned - techAhmedPaid).toLocaleString()} LYD`);
  techAhmedProjects.forEach(pid => {
    const pEarned = techProgress.filter(tp => tp.technician_id === techAhmedId && tp.project_id === pid).reduce((s, tp) => s + Number(tp.earned_amount || 0), 0);
    const pPaid = expenses.filter(ex => ex.technician_id === techAhmedId && ex.project_id === pid).reduce((s, ex) => s + Number(ex.amount || 0), 0);
    console.log(`  * ${projectMap[pid]}: Earned=${pEarned.toLocaleString()} LYD, Paid=${pPaid.toLocaleString()} LYD, Due=${(pEarned - pPaid).toLocaleString()} LYD`);
  });

  // Ashmila Credit Lifecycle
  const ashmilaId = 'b1000000-0000-0000-0000-000000000001';
  const ashmilaCreditCreated = creditLedger.filter(cl => cl.client_id === ashmilaId && cl.entry_type === 'CREDIT_CREATED').reduce((s, cl) => s + Number(cl.amount || 0), 0);
  const ashmilaCreditApplied = creditLedger.filter(cl => cl.client_id === ashmilaId && cl.entry_type === 'CREDIT_APPLIED').reduce((s, cl) => s + Number(cl.amount || 0), 0);
  console.log(`- Mohamed Ashmila Credit Lifecycle: Credit Created=${ashmilaCreditCreated.toLocaleString()} LYD, Credit Applied=${ashmilaCreditApplied.toLocaleString()} LYD, Remaining Available Credit=${(ashmilaCreditCreated - ashmilaCreditApplied).toLocaleString()} LYD`);

  // Canonical Treasuries Balance
  console.log('\n8. CANONICAL TREASURIES BALANCE:');
  treasuries.forEach(t => {
    console.log(`- ${t.name} (${t.project_category} / ${t.treasury_type}): ${Number(t.balance).toLocaleString()} LYD`);
  });
}

runAudit().catch(console.error);
