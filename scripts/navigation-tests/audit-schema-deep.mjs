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

console.log("=== 1. TECHNICIAN TYPES ===");
const { data: techTypes, error: ttErr } = await supabase
  .from('technician_types')
  .select('*');
console.log("technician_types:", techTypes, "Error:", ttErr);

console.log("\n=== 2. EXPENSES COLUMNS & CONSTRAINTS ===");
const { data: expCols, error: expErr } = await supabase
  .from('expenses')
  .select('*')
  .limit(1);
console.log("expenses sample/columns:", expCols, "Error:", expErr);

console.log("\n=== 3. PURCHASE PAYMENTS COLUMNS ===");
const { data: payCols, error: payErr } = await supabase
  .from('purchase_payments')
  .select('*')
  .limit(1);
console.log("purchase_payments sample/columns:", payCols, "Error:", payErr);

console.log("\n=== 4. TREASURY TRANSACTIONS COLUMNS ===");
const { data: ttCols, error: ttErr2 } = await supabase
  .from('treasury_transactions')
  .select('*')
  .limit(1);
console.log("treasury_transactions sample/columns:", ttCols, "Error:", ttErr2);
