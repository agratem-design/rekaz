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

console.log("=== ALL PURCHASES IN DB ===");
const { data: purchases } = await supabase
  .from('purchases')
  .select('id, item_name, supplier_id, technician_id, total_amount, paid_amount, payment_status, project_id, suppliers(id, name)');

console.log("Purchases:", purchases);

console.log("\n=== ALL EXPENSES IN DB ===");
const { data: expenses } = await supabase
  .from('expenses')
  .select('id, description, amount, type, technician_id, project_id');

console.log("Expenses:", expenses);

console.log("\n=== ALL PROGRESS RECORDS IN DB ===");
const { data: progress } = await supabase
  .from('technician_progress_records')
  .select('*');

console.log("Progress:", progress);
