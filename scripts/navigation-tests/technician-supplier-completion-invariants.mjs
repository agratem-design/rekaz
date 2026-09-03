import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

for (const rawLine of envContent.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.substring('VITE_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    supabaseKey = line.substring('VITE_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("========================================================");
console.log("TECHNICIAN + SUPPLIER RUNTIME & STRUCTURAL AUDIT SUITE");
console.log("========================================================\n");

let passCount = 0;
let failCount = 0;

function assert(condition, testId, description) {
  if (condition) {
    console.log(`[PASS] ${testId.padEnd(20)} : ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testId.padEnd(20)} : ${description}`);
    failCount++;
  }
}

// 1. Audit Live DB for Ahmed Al-Zayat
const { data: ahmedTech } = await supabase
  .from('technicians')
  .select('*')
  .ilike('name', '%أحمد الزيات%')
  .single();

assert(!!ahmedTech, 'AHMED-01', 'Technician Ahmed Al-Zayat exists');

const { data: ahmedAsgs } = await supabase
  .from('project_item_technicians')
  .select('*, project_items(*, projects(*))')
  .eq('technician_id', ahmedTech.id);

assert(ahmedAsgs && ahmedAsgs.length === 1, 'AHMED-02', 'Ahmed has 1 active assignment');

const { data: ahmedProgs } = await supabase
  .from('technician_progress_records')
  .select('*')
  .eq('technician_id', ahmedTech.id);

assert(ahmedProgs && ahmedProgs.length === 0, 'AHMED-03', 'Ahmed has 0 progress records (earned = 0)');

const { data: ahmedExps } = await supabase
  .from('expenses')
  .select('*')
  .eq('technician_id', ahmedTech.id)
  .eq('type', 'labor');

assert(ahmedExps && ahmedExps.length === 0, 'AHMED-04', 'Ahmed has 0 expenses/payments (paid = 0, due = 0)');

// 2. Audit 17 Baseline Specialties in Live DB
const { data: techTypes } = await supabase.from('technician_types').select('*').order('name');
assert(techTypes && techTypes.length >= 17, 'SPEC-01', `Found ${techTypes?.length} canonical specialties in live database (>= 17 required)`);

const baselineCodes = [
  'daily_worker', 'reinforced_carpenter', 'rebar_blacksmith', 'builder_mason',
  'electrician', 'plumber', 'hvac_technician', 'gypsum_technician',
  'painter', 'tile_ceramic_mason', 'aluminum_technician', 'welder',
  'insulation_technician', 'glass_technician', 'carpenter', 'door_installer',
  'stone_marble_mason'
];
const liveCodes = new Set(techTypes?.map(t => t.code).filter(Boolean));
const allBaselinesPresent = baselineCodes.every(code => liveCodes.has(code));
assert(allBaselinesPresent, 'SPEC-02', 'All 17 canonical specialty codes installed cleanly in DB');

// 3. Audit Suppliers & Purchases in Live DB
const { data: suppliers } = await supabase.from('suppliers').select('*');
assert(suppliers && suppliers.length > 0, 'SUP-01', `Found ${suppliers?.length} suppliers in DB`);

const { data: purchases } = await supabase.from('purchases').select('*');
assert(purchases && purchases.length === 8, 'SUP-02', `Found ${purchases?.length} purchases in DB`);

// 4. Structural Source Code Verification: Technicians.tsx
const techniciansSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Technicians.tsx'), 'utf8');
assert(techniciansSrc.includes('isAddTypeDialogOpen'), 'TECH-SPEC-01', 'Technicians page has inline add specialty dialog state');
assert(techniciansSrc.includes('إضافة تخصص جديد'), 'TECH-SPEC-02', 'Technicians page has inline [+ إضافة تخصص جديد] trigger');
assert(techniciansSrc.includes('createTypeMutation'), 'TECH-SPEC-03', 'Technicians page has createTypeMutation for technician_types');

// 5. Structural Source Code Verification: QuickAddTechnicianDialog.tsx
const quickAddTechSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/technicians/QuickAddTechnicianDialog.tsx'), 'utf8');
assert(quickAddTechSrc.includes('isAddTypeOpen'), 'QUICK-SPEC-01', 'QuickAddTechnicianDialog has inline add specialty dialog state');
assert(quickAddTechSrc.includes('إضافة تخصص'), 'QUICK-SPEC-02', 'QuickAddTechnicianDialog has inline [+ إضافة تخصص] button');

// 6. Structural Source Code Verification: Settings.tsx
const settingsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/Settings.tsx'), 'utf8');
assert(settingsSrc.includes('value="technician-types"'), 'SETTINGS-SPEC-01', 'Settings page has technician-types tab trigger & content');
assert(settingsSrc.includes('دليل تخصصات الفنيين المعتمدة'), 'SETTINGS-SPEC-02', 'Settings page has technician specialties master table');
assert(settingsSrc.includes('toggleSpecialtyActiveMutation'), 'SETTINGS-SPEC-03', 'Settings page supports activating/deactivating specialties');

// 7. Structural Source Code Verification: TechnicianDetail.tsx (Simplified On-Account Payment)
const techDetailSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/TechnicianDetail.tsx'), 'utf8');
assert(techDetailSrc.includes('دفع على الحساب'), 'TECH-UI-01', 'TechnicianDetail has on-account button: دفع على الحساب');
assert(!techDetailSrc.includes('disabled={globalDue <= 0}') && techDetailSrc.includes('رصيد مقدم للفني'), 'TECH-UI-02', 'TechnicianDetail keeps payment enabled and presents advance balance state');
assert(techDetailSrc.includes('pay_technician_on_account_atomic'), 'TECH-UI-03', 'TechnicianDetail calls pay_technician_on_account_atomic RPC');
assert(techDetailSrc.includes('chronologicalStatement'), 'TECH-UI-04', 'TechnicianDetail builds chronological running balance statement ledger');
assert(techDetailSrc.includes('openPrintWindow'), 'TECH-UI-05', 'TechnicianDetail supports printing account statement');
assert(techDetailSrc.includes('openReceiptPrintWindow'), 'TECH-UI-06', 'TechnicianDetail supports printing disbursement receipts');

// 8. Structural Source Code Verification: SupplierDetail.tsx (Simplified On-Account Payment)
const supDetailSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/SupplierDetail.tsx'), 'utf8');
assert(supDetailSrc.includes('دفع على الحساب'), 'SUP-UI-01', 'SupplierDetail has on-account button: دفع على الحساب');
assert(!supDetailSrc.includes('disabled={globalDue <= 0}') && supDetailSrc.includes('رصيد مقدم للمورد'), 'SUP-UI-02', 'SupplierDetail keeps payment enabled and presents supplier advance state');
assert(supDetailSrc.includes('pay_supplier_on_account_atomic'), 'SUP-UI-03', 'SupplierDetail calls pay_supplier_on_account_atomic RPC');
assert(supDetailSrc.includes('chronologicalStatement'), 'SUP-UI-04', 'SupplierDetail builds chronological running balance statement ledger');
assert(supDetailSrc.includes('openPrintWindow'), 'SUP-UI-05', 'SupplierDetail supports printing supplier statement');
assert(supDetailSrc.includes('openReceiptPrintWindow'), 'SUP-UI-06', 'SupplierDetail supports printing payment receipts');

console.log("\n========================================================");
console.log(`TOTAL INVARIANTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log("========================================================");

if (failCount > 0) {
  process.exit(1);
}
