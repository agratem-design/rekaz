import { supabase } from './financial-tests/client.mjs';

async function runReadOnlyAudit() {
  console.log('========================================================');
  console.log('RAKAZ LIVE DATABASE — READ-ONLY RESIDUAL DATA AUDIT');
  console.log('========================================================\n');

  // 1. Fetch all tables in public schema dynamically via RPC / PostgREST queries
  const allKnownTables = [
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
    'variation_orders'
  ];

  const inventory = [];

  for (const t of allKnownTables) {
    try {
      const { data, count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true });
      
      let rowCount = count !== null && count !== undefined ? count : 0;
      if (error) {
        // Try selecting data directly if head count had issue
        const { data: d2, error: e2 } = await supabase.from(t).select('*');
        if (!e2 && d2) rowCount = d2.length;
      }

      let classification = 'EMPTY BUSINESS DATA';
      if (['company_settings'].includes(t)) classification = 'PRESERVED COMPANY CONFIG';
      else if (['profiles', 'user_roles'].includes(t)) classification = 'PRESERVED ADMIN/AUTH SUPPORT';
      else if (['treasuries'].includes(t)) classification = 'REQUIRED SYSTEM BOOTSTRAP';
      else if (['technician_types', 'measurement_configs'].includes(t)) classification = 'REQUIRED SYSTEM BOOTSTRAP';
      else if (rowCount > 0) classification = 'UNEXPECTED RESIDUAL DATA';

      inventory.push({ table: t, count: rowCount, classification });
    } catch (err) {
      inventory.push({ table: t, count: 'ERROR', classification: 'QUERY FAILED' });
    }
  }

  console.log('1. COMPLETE PUBLIC TABLE INVENTORY:');
  console.log('| # | Table Name | Row Count | Classification |');
  console.log('|---|---|---|---|');
  inventory.forEach((inv, idx) => {
    console.log(`| ${idx + 1} | ${inv.table} | ${inv.count} | ${inv.classification} |`);
  });

  // 2. Deep Dive on Specific Reference Tables
  console.log('\n2. MEASUREMENT CONFIGS / UNITS DEEP DIVE:');
  const { data: measurementConfigs } = await supabase.from('measurement_configs').select('*');
  console.log(`- Row Count: ${(measurementConfigs || []).length}`);
  (measurementConfigs || []).forEach(mc => {
    console.log(`  * ID: ${mc.id} | Name: "${mc.name}" | Symbol: "${mc.unit_symbol}" | Formula: "${mc.formula}" | is_default: ${mc.is_default}`);
  });

  console.log('\n3. TECHNICIAN TYPES DEEP DIVE:');
  const { data: techTypes } = await supabase.from('technician_types').select('*').order('created_at');
  console.log(`- Row Count: ${(techTypes || []).length}`);
  (techTypes || []).forEach(tt => {
    console.log(`  * ID: ${tt.id} | Code: "${tt.code}" | Name: "${tt.name}" | Active: ${tt.is_active}`);
  });

  console.log('\n4. COMPANY SETTINGS (MASKED SECRETS):');
  const { data: csRows } = await supabase.from('company_settings').select('*');
  const cs = (csRows || [])[0];
  if (cs) {
    console.log(`- ID: ${cs.id}`);
    console.log(`- Company Name: ${cs.company_name}`);
    console.log(`- Phone: ${cs.company_phone}`);
    console.log(`- Address: ${cs.company_address}`);
    console.log(`- Tagline: ${cs.company_tagline}`);
    console.log(`- Theme Color: ${cs.theme_color}`);
    console.log(`- Storage Provider: ${cs.image_upload_provider}`);
    console.log(`- IMGBB API Key: ${cs.imgbb_api_key ? '***MASKED***' : 'null'}`);
    console.log(`- Cloudinary Cloud Name: ${cs.cloudinary_cloud_name ? '***MASKED***' : 'null'}`);
    console.log(`- Contracting Treasury ID: ${cs.contracting_treasury_id}`);
    console.log(`- Finishing Treasury ID: ${cs.finishing_treasury_id}`);
  }

  console.log('\n5. TREASURIES EXACT STATE & RECONCILIATION:');
  const { data: treasuries } = await supabase.from('treasuries').select('*').order('name');
  const { data: treasuryTx } = await supabase.from('treasury_transactions').select('*');
  console.log('| ID | Name | Type | Category | Parent ID | Active | Balance |');
  console.log('|---|---|---|---|---|---|---|');
  (treasuries || []).forEach(tr => {
    console.log(`| ${tr.id} | ${tr.name} | ${tr.treasury_type} | ${tr.project_category} | ${tr.parent_id || 'null'} | ${tr.is_active} | ${Number(tr.balance).toFixed(2)} LYD |`);
  });
  console.log(`- Total Treasury Transactions: ${(treasuryTx || []).length}`);

  // 6. Forensic Fixture Scan across Text Columns
  console.log('\n6. FORENSIC FIXTURE PATTERN SCAN:');
  const fixturePatterns = ['P4-SRV', 'E2E', 'FIXTURE', 'TEST-', 'NAVCFG', 'STPS', 'STPT', 'FTC-', 'CTS-', 'TRD-', 'UX-', 'P4-'];
  let fixtureHits = 0;

  for (const t of allKnownTables) {
    if (['measurement_configs', 'technician_types'].includes(t)) continue; // system constants
    try {
      const { data: rows } = await supabase.from(t).select('*');
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const str = JSON.stringify(row);
          for (const pat of fixturePatterns) {
            if (str.toUpperCase().includes(pat.toUpperCase())) {
              console.log(`  [HIT] Table: ${t}, Pattern: "${pat}", Row: ${str.slice(0, 100)}...`);
              fixtureHits++;
            }
          }
        }
      }
    } catch (e) {}
  }
  console.log(`- Total Controlled Fixture Hits Found: ${fixtureHits}`);

  // 7. Demo Identity Scan
  console.log('\n7. KNOWN DEMO IDENTITIES SCAN:');
  const demoNames = ['محمد اشميلة', 'عبدالملك قراطم', 'مسجد الرحمة', 'عيادة الشفاء', 'مؤسسة الوارد', 'شركة الأفق', 'أحمد مصطفى', 'سالم الترهوني'];
  let demoHits = 0;

  for (const t of allKnownTables) {
    try {
      const { data: rows } = await supabase.from(t).select('*');
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const str = JSON.stringify(row);
          for (const name of demoNames) {
            if (str.includes(name)) {
              console.log(`  [HIT] Table: ${t}, Demo Identity: "${name}", Row: ${str.slice(0, 100)}...`);
              demoHits++;
            }
          }
        }
      }
    } catch (e) {}
  }
  console.log(`- Total Demo Identity Hits Found: ${demoHits}`);
}

runReadOnlyAudit().catch(console.error);
