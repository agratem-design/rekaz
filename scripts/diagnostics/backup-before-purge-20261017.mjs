import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc0NTA5NCwiZXhwIjoyMDg2MzIxMDk0fQ.tTcZ93d0_sU29EzcNDghNFskteZG9PgbxAZm3fz4l6U';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tables = [
  'company_settings',
  'measurement_units',
  'technician_types',
  'expense_categories',
  'profiles',
  'user_roles',
  'catalog_items',
  'catalog_item_requirements',
  'clause_templates',
  'treasuries',
  'treasury_entries',
  'transfers',
  'clients',
  'suppliers',
  'technicians',
  'engineers',
  'employees',
  'projects',
  'project_phases',
  'project_items',
  'project_item_assignments',
  'project_item_requirements',
  'technician_work',
  'technician_payments',
  'technician_receipts',
  'purchases',
  'supplier_payments',
  'supplier_payment_allocations',
  'contracts',
  'contract_items',
  'contract_clauses',
  'customer_invoices',
  'client_receipts',
  'client_credit_entries',
  'expenses',
  'custodies',
  'custody_returns',
  'payroll_runs',
  'payroll_slips',
  'payroll_payments',
  'employee_advances',
  'warehouses',
  'stock_products',
  'stock_movements',
  'stock_counts',
  'equipment',
  'equipment_rentals',
  'phase_reference_counters',
  'business_requests',
  'audit_log'
];

async function backup() {
  console.log('Starting full database backup before purge...');
  const data = {};
  for (const table of tables) {
    try {
      const { data: rows, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`Error querying ${table}: ${error.message}`);
        data[table] = [];
      } else {
        data[table] = rows || [];
        console.log(`✓ Backed up ${table}: ${rows?.length || 0} rows`);
      }
    } catch (err) {
      console.warn(`Exception on ${table}: ${err.message}`);
      data[table] = [];
    }
  }

  const backupDir = 'backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `${backupDir}/full-pre-purge-backup-2026-10-17.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nBackup successfully written to: ${filename}`);
}

backup().catch(console.error);
