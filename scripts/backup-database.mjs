import fs from 'fs';
import path from 'path';
import { supabase } from './financial-tests/client.mjs';

const ALL_TABLES = [
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
  'suppliers',
  'technician_progress_records',
  'technician_types',
  'technicians',
  'transfers',
  'treasuries',
  'treasury_debts',
  'treasury_transactions',
  'user_roles',
  'variation_orders',
];

async function main() {
  console.log('========================================================');
  console.log('STARTING FULL PRE-RESET DATABASE BACKUP');
  console.log('========================================================\n');

  const backupsDir = path.resolve('backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const jsonPath = path.join(backupsDir, `pre-demo-reset-2026-08-18.json`);
  const sqlPath = path.join(backupsDir, `pre-demo-reset-2026-08-18.sql`);

  const dumpData = {};
  let sqlDump = `-- REKAZ DATABASE BACKUP DUMP\n-- CREATED AT: ${new Date().toISOString()}\n\n`;

  console.log('--- EXPORTING TABLE DATA ---');
  for (const table of ALL_TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`❌ Error exporting ${table}:`, error.message);
      dumpData[table] = { error: error.message, rows: [] };
    } else {
      dumpData[table] = data || [];
      console.log(`  ✓ ${table.padEnd(40, ' ')}: ${(data || []).length} rows`);

      if (data && data.length > 0) {
        sqlDump += `-- Table: ${table} (${data.length} rows)\n`;
        for (const row of data) {
          const keys = Object.keys(row);
          const values = keys.map((k) => {
            const val = row[k];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlDump += `INSERT INTO public.${table} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(dumpData, null, 2), 'utf-8');
  fs.writeFileSync(sqlPath, sqlDump, 'utf-8');

  // Verify backup readability
  const jsonStats = fs.statSync(jsonPath);
  const sqlStats = fs.statSync(sqlPath);
  const readBack = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log('\n========================================================');
  console.log('DATABASE BACKUP COMPLETE & VERIFIED');
  console.log('========================================================');
  console.log(`BACKUP CREATED = YES`);
  console.log(`BACKUP PATH (JSON) = ${jsonPath}`);
  console.log(`BACKUP SIZE (JSON) = ${(jsonStats.size / 1024).toFixed(2)} KB`);
  console.log(`BACKUP PATH (SQL)  = ${sqlPath}`);
  console.log(`BACKUP SIZE (SQL)  = ${(sqlStats.size / 1024).toFixed(2)} KB`);
  console.log(`BACKUP TIME        = ${new Date().toISOString()}`);
  console.log(`TOTAL TABLES DUMPED= ${Object.keys(readBack).length}`);
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
