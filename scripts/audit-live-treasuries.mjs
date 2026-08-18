import { supabase } from './financial-tests/client.mjs';

async function forensicAudit() {
  console.log('========================================================');
  console.log('PART A: LIVE TREASURY FORENSIC AUDIT');
  console.log('========================================================\n');

  // 1. Company Settings
  const { data: settings, error: settingsErr } = await supabase
    .from('company_settings')
    .select('*');
  
  if (settingsErr) {
    console.error('Error fetching company_settings:', settingsErr);
  } else {
    console.log('COMPANY SETTINGS:');
    console.log(JSON.stringify(settings, null, 2));
  }

  // 2. All Treasuries
  const { data: treasuries, error: treasuriesErr } = await supabase
    .from('treasuries')
    .select('id, name, balance, treasury_type, parent_id, project_category, is_active, created_at')
    .order('created_at', { ascending: true });

  if (treasuriesErr) {
    console.error('Error fetching treasuries:', treasuriesErr);
    return;
  }

  console.log('\nALL TREASURIES IN DATABASE:');
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  console.log('ID                                   | Name                                | Category    | Type | Active | Balance   | Parent ID');
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  for (const t of treasuries) {
    const idStr = t.id;
    const nameStr = (t.name || '').padEnd(35, ' ');
    const catStr = (t.project_category || 'NULL').padEnd(11, ' ');
    const typeStr = (t.treasury_type || 'cash').padEnd(4, ' ');
    const actStr = String(t.is_active).padEnd(6, ' ');
    const balStr = String(t.balance || 0).padStart(9, ' ');
    const parStr = t.parent_id || 'ROOT';
    console.log(`${idStr} | ${nameStr} | ${catStr} | ${typeStr} | ${actStr} | ${balStr} | ${parStr}`);
  }
  console.log('-----------------------------------------------------------------------------------------------------------------------------\n');

  // 3. Check for Suspicious / Test Treasuries and their references
  console.log('SUSPICIOUS / TEST-LIKE TREASURIES DETAILED AUDIT:');
  const testPatterns = ['P4-SRV', 'P4-', 'TEST', 'FIXTURE', 'NAV', 'UX', 'SRV-', 'Contracting Root', 'Finishing Root'];

  for (const t of treasuries) {
    const isSuspicious = testPatterns.some(p => (t.name || '').toUpperCase().includes(p.toUpperCase())) ||
                         t.name.includes('17870') || t.name.includes('Root P4');

    if (isSuspicious) {
      console.log(`\nAnalyzing suspicious treasury: [${t.id}] "${t.name}"`);
      console.log(`  Category: ${t.project_category}, Type: ${t.treasury_type}, Active: ${t.is_active}, Balance: ${t.balance}, Created: ${t.created_at}`);

      // Count transactions
      const { count: txCount } = await supabase
        .from('treasury_transactions')
        .select('*', { count: 'exact', head: true })
        .or(`treasury_id.eq.${t.id},destination_treasury_id.eq.${t.id}`);
      console.log(`  -> Treasury Transactions count: ${txCount || 0}`);

      // Count expenses
      const { count: expCount } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('treasury_id', t.id);
      console.log(`  -> Expenses references: ${expCount || 0}`);

      // Count client_payments
      const { count: cpCount } = await supabase
        .from('client_payments')
        .select('*', { count: 'exact', head: true })
        .eq('treasury_id', t.id);
      console.log(`  -> Client Payments references: ${cpCount || 0}`);

      // Count purchase_payments
      const { count: ppCount } = await supabase
        .from('purchase_payments')
        .select('*', { count: 'exact', head: true })
        .eq('treasury_id', t.id);
      console.log(`  -> Purchase Payments references: ${ppCount || 0}`);

      // Count child branches
      const { count: childCount } = await supabase
        .from('treasuries')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', t.id);
      console.log(`  -> Child Treasuries count: ${childCount || 0}`);

      // Check if configured in company_settings
      const isConfiguredContracting = settings?.some(s => s.contracting_treasury_id === t.id);
      const isConfiguredFinishing = settings?.some(s => s.finishing_treasury_id === t.id);
      console.log(`  -> Configured as Contracting Main: ${isConfiguredContracting}`);
      console.log(`  -> Configured as Finishing Main: ${isConfiguredFinishing}`);
    }
  }

  // 4. Identify Legitimate Real Business Treasuries
  console.log('\nLEGITIMATE REAL BUSINESS TREASURIES AUDIT:');
  const legitimateNames = ['خزينة المقاولات الرئيسية', 'خزينة التشطيبات الرئيسية', 'الخزينة العامة للشركة', 'حساب مصرف الوحدة', 'حساب مصرف التجاري'];
  for (const t of treasuries) {
    if (legitimateNames.some(ln => (t.name || '').includes(ln))) {
      console.log(`\nLegitimate Treasury: [${t.id}] "${t.name}"`);
      console.log(`  Category: ${t.project_category}, Type: ${t.treasury_type}, Active: ${t.is_active}, Balance: ${t.balance}`);
      
      const isConfiguredContracting = settings?.some(s => s.contracting_treasury_id === t.id);
      const isConfiguredFinishing = settings?.some(s => s.finishing_treasury_id === t.id);
      console.log(`  -> Currently configured as Contracting Main: ${isConfiguredContracting}`);
      console.log(`  -> Currently configured as Finishing Main: ${isConfiguredFinishing}`);
    }
  }
}

forensicAudit().catch(console.error);
