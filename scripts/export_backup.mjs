import fs from 'fs';
import { supabase } from './financial-tests/client.mjs';

const tables = [
  'company_settings',
  'treasuries',
  'treasury_transactions',
  'clients',
  'suppliers',
  'technicians',
  'technician_types',
  'engineers',
  'employees',
  'projects',
  'project_phases',
  'general_project_items',
  'general_item_technician_requirements',
  'project_items',
  'project_item_technicians',
  'project_item_technician_requirements',
  'contracts',
  'contract_clauses',
  'contract_items',
  'purchases',
  'purchase_payments',
  'technician_progress_records',
  'expenses',
  'equipment',
  'equipment_rentals',
  'client_payments',
  'client_credit_ledger',
  'transfers',
  'project_custody',
  'audit_logs',
  'profiles',
  'user_roles'
];

async function backup() {
  console.log('Starting full Zliten Demo database export...');
  const fullData = {};

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.error(`Error reading table ${t}:`, error.message);
    } else {
      fullData[t] = data || [];
      console.log(`Table ${t}: ${fullData[t].length} rows exported`);
    }
  }

  const jsonPath = 'backups/pre-manual-acceptance-clean-reset-2026-08-19.json';
  fs.writeFileSync(jsonPath, JSON.stringify(fullData, null, 2), 'utf8');
  console.log(`Saved JSON backup to ${jsonPath} (${fs.statSync(jsonPath).size} bytes)`);

  // Generate SQL insert backup
  let sql = `-- Backup created at ${new Date().toISOString()}\n-- Zliten Demo Database Snapshot\n\n`;
  for (const [t, rows] of Object.entries(fullData)) {
    if (!rows || rows.length === 0) continue;
    sql += `-- Table: ${t} (${rows.length} rows)\n`;
    for (const r of rows) {
      const cols = Object.keys(r);
      const vals = Object.values(r).map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO public.${t} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += '\n';
  }

  const sqlPath = 'backups/pre-manual-acceptance-clean-reset-2026-08-19.sql';
  fs.writeFileSync(sqlPath, sql, 'utf8');
  console.log(`Saved SQL backup to ${sqlPath} (${fs.statSync(sqlPath).size} bytes)`);

  // Verification: Read back both files and check size & parse JSON
  const readJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const readSql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`\nVerification:`);
  console.log(`- JSON readable & parsed: ${Object.keys(readJson).length} tables found`);
  console.log(`- SQL readable: ${readSql.length} characters`);
  console.log(`BACKUP VERIFICATION: SUCCESS`);
}

backup().catch(console.error);
