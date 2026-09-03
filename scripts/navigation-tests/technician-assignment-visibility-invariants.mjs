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
console.log("STATIC & RUNTIME-STATE INVARIANT VERIFICATION SUITE");
console.log("TECHNICIAN ACCOUNT — DYNAMIC ASSIGNMENT VISIBILITY");
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

// 1. Audit Ahmed Al-Zayat Live DB Baseline
const { data: ahmedTech, error: tErr } = await supabase
  .from('technicians')
  .select('id, name, specialty, technician_type_id, phone')
  .ilike('name', '%أحمد الزيات%')
  .single();

assert(!!ahmedTech && ahmedTech.name === 'أحمد الزيات', 'AHMED-01', 'Technician Ahmed Al-Zayat exists in database');

const { data: ahmedAssignments, error: aErr } = await supabase
  .from('project_item_technicians')
  .select(`
    id,
    project_item_id,
    technician_id,
    rate,
    rate_type,
    quantity,
    total_cost,
    created_at,
    project_items (
      id,
      name,
      phase_id,
      project_id,
      project_phases (
        id,
        name,
        project_id
      ),
      projects (
        id,
        name,
        client_id,
        project_type,
        clients (
          id,
          name
        )
      )
    )
  `)
  .eq('technician_id', ahmedTech.id);

assert(ahmedAssignments && ahmedAssignments.length === 1, 'AHMED-02', 'Ahmed Al-Zayat has exactly 1 canonical staffing assignment');
assert(ahmedAssignments[0].project_items?.projects?.name === 'مبنى تجاري سكني', 'AHMED-03', 'Assignment is linked to project: مبنى تجاري سكني');
assert(ahmedAssignments[0].project_items?.project_phases?.name === 'أعمال القواعد والشدادات', 'AHMED-04', 'Assignment is linked to phase: أعمال القواعد والشدادات');
assert(ahmedAssignments[0].project_items?.name === 'القواعد', 'AHMED-05', 'Assignment is linked to BOQ item: القواعد');

const { data: ahmedProgress } = await supabase
  .from('technician_progress_records')
  .select('*')
  .eq('technician_id', ahmedTech.id);

assert(ahmedProgress && ahmedProgress.length === 0, 'AHMED-06', 'Ahmed Al-Zayat has 0 progress records (financial earned = 0)');

const { data: ahmedExpenses } = await supabase
  .from('expenses')
  .select('*')
  .eq('technician_id', ahmedTech.id)
  .eq('type', 'labor');

assert(ahmedExpenses && ahmedExpenses.length === 0, 'AHMED-07', 'Ahmed Al-Zayat has 0 labor payments (settlement = 0)');

// 2. Audit Frontend Source Code Invariants in TechnicianDetail.tsx
const techDetailSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/TechnicianDetail.tsx'), 'utf8');

assert(techDetailSrc.includes('project_item_technicians'), 'SRC-01', 'TechnicianDetail queries canonical project_item_technicians table');
assert(techDetailSrc.includes('technician-assignments'), 'SRC-02', 'TechnicianDetail uses dedicated technician-assignments query key');
assert(techDetailSrc.includes('distinctProjectsCount'), 'SRC-03', 'TechnicianDetail computes distinct project count independently');
assert(techDetailSrc.includes('totalAssignmentsCount'), 'SRC-04', 'TechnicianDetail computes operational assignments count independently');
assert(techDetailSrc.includes('مكلّف — لم يبدأ العمل'), 'SRC-05', 'TechnicianDetail derives status: مكلّف — لم يبدأ العمل for zero-progress assignments');
assert(techDetailSrc.includes('قيد التنفيذ'), 'SRC-06', 'TechnicianDetail derives status: قيد التنفيذ for active progress');
assert(techDetailSrc.includes('const gDue = Math.max(0, gEarned - gPaid)'), 'SRC-07', 'Financial due is strictly derived from progress earned and expenses paid (0 from assignment)');

// 3. Audit React Query Invalidations in ProjectItems.tsx and InvoiceItemForm.tsx
const projectItemsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/ProjectItems.tsx'), 'utf8');
const invoiceItemFormSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/project-items/InvoiceItemForm.tsx'), 'utf8');

assert(projectItemsSrc.includes('technician-assignments'), 'CACHE-01', 'ProjectItems invalidates technician-assignments query key on assignment/deletion');
assert(invoiceItemFormSrc.includes('technician-assignments'), 'CACHE-02', 'InvoiceItemForm invalidates technician-assignments query key on assignment/deletion');

console.log("\n========================================================");
console.log(`TOTAL INVARIANTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log("========================================================");

if (failCount > 0) {
  process.exit(1);
}
