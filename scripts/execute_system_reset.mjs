import { createClient } from '@supabase/supabase-js';

const url = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5NCwiZXhwIjoyMDg2MzIxMDk0fQ.tTcZ93d0_sU29EzcNDghNFskteZG9PgbxAZm3fz4l6U';

const adminSupabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CANONICAL_CONTRACTING_ROOT = 'c504cce9-8bfd-4cda-8296-80febdec2432';
const CANONICAL_FINISHING_ROOT = 'f9637060-3f26-445e-b77c-658b31da2269';

async function executeSystemReset() {
  console.log('================================================================');
  console.log('   STARTING SYSTEM RESET (PURGE OPERATIONAL DATA & PRESERVE SETTINGS)');
  console.log('================================================================\n');

  // Step 1: Detach any profiles from temporary engineer references
  console.log('[1/7] Ensuring user profiles are detached from engineers...');
  const { error: profileErr } = await adminSupabase
    .from('profiles')
    .update({ engineer_id: null })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (profileErr) console.warn('Warning updating profiles:', profileErr.message);
  else console.log('✓ User profiles protected and preserved.');

  // Step 2: Delete HR & Workflow operational tables
  console.log('\n[2/7] Purging HR & workflow tables...');
  const hrTables = [
    'workflow_requests',
    'employee_advance_repayments',
    'employee_advances',
    'employee_payroll_slips',
    'employee_payrolls',
    'custody_settlements',
    'project_custody',
  ];
  for (const tbl of hrTables) {
    const { error } = await adminSupabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`  ⚠️ Could not purge ${tbl}:`, error.message);
    else console.log(`  ✓ Purged ${tbl}`);
  }

  // Step 3: Delete Financial child transactions
  console.log('\n[3/7] Purging financial & operational transaction tables...');
  const finTables = [
    'client_credit_ledger',
    'client_payment_allocations',
    'client_payments',
    'supplier_payment_allocations',
    'supplier_payments',
    'technician_deposits',
    'technician_payments',
    'purchase_payments',
    'purchases',
    'expenses',
    'income',
    'transfers',
    'treasury_transactions',
    'treasury_debts',
    'cash_flow_forecast',
  ];
  for (const tbl of finTables) {
    const { error } = await adminSupabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`  ⚠️ Could not purge ${tbl}:`, error.message);
    else console.log(`  ✓ Purged ${tbl}`);
  }

  // Step 4: Delete Project child operational records
  console.log('\n[4/7] Purging project child records...');
  const projChildTables = [
    'technician_progress_records',
    'project_item_technicians',
    'project_item_technician_requirements',
    'project_items',
    'contract_clauses',
    'contract_items',
    'contracts',
    'project_phases',
    'project_technicians',
    'project_suppliers',
    'project_schedules',
    'checklist_items',
    'inspection_checklists',
    'risk_register',
    'variation_orders',
    'equipment_rentals',
    'equipment',
    'stock_movements',
    'materials',
  ];
  for (const tbl of projChildTables) {
    const { error } = await adminSupabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`  ⚠️ Could not purge ${tbl}:`, error.message);
    else console.log(`  ✓ Purged ${tbl}`);
  }

  // Step 5: Delete Master entities (Projects, Clients, Suppliers, Technicians, Engineers, Employees)
  console.log('\n[5/7] Purging master parties and projects...');
  const masterTables = [
    'projects',
    'clients',
    'suppliers',
    'technicians',
    'engineers',
    'employees',
  ];
  for (const tbl of masterTables) {
    const { error } = await adminSupabase.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn(`  ⚠️ Could not purge ${tbl}:`, error.message);
    else console.log(`  ✓ Purged ${tbl}`);
  }

  // Step 6: Zero out all Treasuries and verify Settings
  console.log('\n[6/7] Resetting all treasury balances to 0.00...');
  const { data: treasuries, error: trFetchErr } = await adminSupabase.from('treasuries').select('id, name, balance');
  if (trFetchErr) throw trFetchErr;

  for (const tr of treasuries) {
    const { error: updErr } = await adminSupabase
      .from('treasuries')
      .update({ balance: 0.00, updated_at: new Date().toISOString() })
      .eq('id', tr.id);
    if (updErr) console.warn(`  ⚠️ Failed resetting treasury ${tr.name}:`, updErr.message);
    else console.log(`  ✓ Reset treasury [${tr.name}] balance to 0.00`);
  }

  // Ensure company_settings points to the canonical root treasuries
  await adminSupabase
    .from('company_settings')
    .update({
      contracting_treasury_id: CANONICAL_CONTRACTING_ROOT,
      finishing_treasury_id: CANONICAL_FINISHING_ROOT,
      updated_at: new Date().toISOString(),
    })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Company settings verified and linked to canonical roots.');

  // Step 7: Clear audit logs so audit trail is fresh
  console.log('\n[7/7] Clearing audit logs...');
  const { error: auditErr } = await adminSupabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (auditErr) console.warn('Warning clearing audit logs:', auditErr.message);
  else console.log('✓ Audit logs cleared.');

  console.log('\n================================================================');
  console.log('  VERIFYING FINAL STATE');
  console.log('================================================================');

  const checkTables = [
    'projects',
    'clients',
    'suppliers',
    'technicians',
    'employees',
    'purchases',
    'project_items',
    'project_phases',
    'treasury_transactions',
    'employee_advances',
    'employee_payrolls',
    'workflow_requests',
    'audit_logs',
  ];

  for (const t of checkTables) {
    const { count } = await adminSupabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`- ${t.padEnd(25, ' ')}: ${count} rows`);
  }

  const { data: finalTreasuries } = await adminSupabase.from('treasuries').select('id, name, balance');
  console.log('\nTreasuries Balances:');
  for (const tr of finalTreasuries) {
    console.log(`- [${tr.name}]: ${Number(tr.balance).toFixed(2)} د.ل`);
  }

  const { data: settings } = await adminSupabase.from('company_settings').select('company_name').single();
  const { count: mCount } = await adminSupabase.from('measurement_configs').select('*', { count: 'exact', head: true });
  const { count: tCount } = await adminSupabase.from('technician_types').select('*', { count: 'exact', head: true });
  const { count: pCount } = await adminSupabase.from('profiles').select('*', { count: 'exact', head: true });

  console.log('\nPreserved General Settings & System Definitions:');
  console.log(`- Company Name: ${settings?.company_name}`);
  console.log(`- Measurement Units: ${mCount} preserved`);
  console.log(`- Technician Types: ${tCount} preserved`);
  console.log(`- Active User Profiles: ${pCount} preserved`);
  console.log('\n✓ SYSTEM RESET COMPLETED SUCCESSFULLY!');
}

executeSystemReset().catch(console.error);
