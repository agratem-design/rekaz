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

console.log("=== INSPECTING AHMED AL-ZAYAT (READ-ONLY) ===");

const { data: techs, error: tErr } = await supabase
  .from('technicians')
  .select('id, name, specialty, technician_type_id, phone')
  .ilike('name', '%أحمد الزيات%');

console.log("Technicians matching 'أحمد الزيات':", techs, tErr);

if (techs && techs.length > 0) {
  const techId = techs[0].id;
  
  const { data: assignments, error: aErr } = await supabase
    .from('project_item_technicians')
    .select(`
      id,
      project_item_id,
      technician_id,
      rate,
      rate_type,
      quantity,
      total_cost,
      notes,
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
    .eq('technician_id', techId);
    
  console.log("\nProject Item Assignments (project_item_technicians):", JSON.stringify(assignments, null, 2), aErr);
  
  const { data: progress, error: pErr } = await supabase
    .from('technician_progress_records')
    .select('*')
    .eq('technician_id', techId);
    
  console.log("\nProgress Records (technician_progress_records):", progress, pErr);
  
  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('*')
    .eq('technician_id', techId);
    
  console.log("\nExpenses / Payments (expenses):", expenses, eErr);
}
