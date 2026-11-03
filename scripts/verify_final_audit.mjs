import { createClient } from '@supabase/supabase-js';

const url = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5NCwiZXhwIjoyMDg2MzIxMDk0fQ.tTcZ93d0_sU29EzcNDghNFskteZG9PgbxAZm3fz4l6U';

const adminSupabase = createClient(url, serviceKey);

const allTables = [
  'audit_logs',
  'cash_flow_forecast',
  'checklist_items',
  'client_credit_ledger',
  'client_payment_allocations',
  'client_payments',
  'clients',
  'company_settings',
  'contract_clause_templates',
  'contract_clauses',
  'contract_items',
  'contracts',
  'custody_settlements',
  'employee_advance_repayments',
  'employee_advances',
  'employee_payroll_slips',
  'employee_payrolls',
  'employees',
  'engineers',
  'equipment',
  'equipment_rentals',
  'expenses',
  'general_item_technician_requirements',
  'general_project_items',
  'income',
  'inspection_checklists',
  'materials',
  'measurement_configs',
  'phase_reference_seq',
  'profiles',
  'project_custody',
  'project_item_technician_requirements',
  'project_item_technicians',
  'project_items',
  'project_phases',
  'project_schedules',
  'project_suppliers',
  'project_technicians',
  'projects',
  'purchase_payments',
  'purchases',
  'risk_register',
  'stock_movements',
  'supplier_payment_allocations',
  'supplier_payments',
  'suppliers',
  'technician_deposits',
  'technician_payments',
  'technician_progress_records',
  'technician_types',
  'technicians',
  'transfers',
  'treasuries',
  'treasury_debts',
  'treasury_transactions',
  'user_roles',
  'variation_orders',
  'workflow_requests'
];

async function finalAudit() {
  const tableCounts = {};
  for (const t of allTables) {
    const { count, error } = await adminSupabase.from(t).select('*', { count: 'exact', head: true });
    if (error) tableCounts[t] = 'Error: ' + error.message;
    else if (count > 0) tableCounts[t] = count;
  }
  console.log('TABLES WITH DATA (> 0):');
  console.log(JSON.stringify(tableCounts, null, 2));

  const { data: treasuries } = await adminSupabase.from('treasuries').select('*').order('name');
  console.log('\nTREASURIES AUDIT:');
  for (const tr of treasuries) {
    console.log(`- ${tr.name} (${tr.project_category}, ${tr.treasury_type}): Balance = ${tr.balance}`);
  }

  const { data: cs } = await adminSupabase.from('company_settings').select('*').single();
  console.log('\nCOMPANY SETTINGS:');
  console.log('- Company Name:', cs.company_name);
  console.log('- Contracting Treasury:', cs.contracting_treasury_id);
  console.log('- Finishing Treasury:', cs.finishing_treasury_id);
  console.log('- Phone:', cs.company_phone);
  console.log('- Address:', cs.company_address);
  console.log('- Signee:', cs.signee_name, '(' + cs.signee_title + ')');
}

finalAudit().catch(console.error);
