import { supabase } from './financial-tests/client.mjs';

async function auditTreasuries() {
  console.log('=== LIVE DATABASE TREASURIES AUDIT ===\n');

  // 1. Fetch all treasuries
  const { data: treasuries, error: tErr } = await supabase
    .from('treasuries')
    .select('*')
    .order('created_at', { ascending: true });

  if (tErr) {
    console.error('Error fetching treasuries:', tErr);
    return;
  }

  console.log(`Total Treasuries in DB: ${treasuries.length}\n`);

  // Group by category
  const categories = ['contracting', 'finishing', 'general', null];

  for (const cat of ['contracting', 'finishing']) {
    console.log(`--------------------------------------------------`);
    console.log(`DOMAIN: ${cat.toUpperCase()}`);
    console.log(`--------------------------------------------------`);
    const domainTreasuries = treasuries.filter(t => t.project_category === cat);
    const roots = domainTreasuries.filter(t => t.parent_id === null);
    const activeRoots = roots.filter(t => t.is_active !== false);
    const inactiveRoots = roots.filter(t => t.is_active === false);

    console.log(`Total records with project_category='${cat}': ${domainTreasuries.length}`);
    console.log(`Roots (parent_id IS NULL): ${roots.length}`);
    console.log(`  - Active Roots:   ${activeRoots.length}`);
    console.log(`  - Inactive Roots: ${inactiveRoots.length}`);

    roots.forEach(r => {
      const branches = domainTreasuries.filter(t => t.parent_id === r.id);
      const activeBranches = branches.filter(t => t.is_active !== false);
      console.log(`\n  ROOT ID: ${r.id}`);
      console.log(`  ROOT NAME: "${r.name}"`);
      console.log(`  IS ACTIVE: ${r.is_active !== false}`);
      console.log(`  TREASURY TYPE: ${r.treasury_type}`);
      console.log(`  BALANCE: ${r.balance}`);
      console.log(`  ACTIVE BRANCH COUNT: ${activeBranches.length}`);
      activeBranches.forEach(b => {
        console.log(`    └─ Branch: [${b.id}] "${b.name}" (${b.treasury_type}) - Balance: ${b.balance}`);
      });
    });
    console.log('\n');
  }

  // 2. Fetch company_settings
  console.log(`--------------------------------------------------`);
  console.log(`COMPANY SETTINGS AUDIT`);
  console.log(`--------------------------------------------------`);
  const { data: settings, error: sErr } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (sErr) {
    console.error('Error fetching company_settings:', sErr);
  } else {
    console.log('company_settings row:');
    console.log('  contracting_treasury_id:', settings?.contracting_treasury_id);
    console.log('  finishing_treasury_id:', settings?.finishing_treasury_id);
    console.log('  default_treasury_id:', settings?.default_treasury_id);
  }

  // 3. Check for NULL/General Treasuries
  console.log(`\n--------------------------------------------------`);
  console.log(`NULL / GENERAL TREASURIES AUDIT`);
  console.log(`--------------------------------------------------`);
  const nullCatTreasuries = treasuries.filter(t => !t.project_category);
  console.log(`Treasuries with project_category IS NULL: ${nullCatTreasuries.length}`);
  nullCatTreasuries.forEach(t => {
    console.log(`  [${t.id}] "${t.name}" (parent_id: ${t.parent_id}, active: ${t.is_active !== false}, balance: ${t.balance})`);
  });
}

auditTreasuries();
