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

const { data: purchases, error: pErr } = await supabase.from('purchases').select('*');
console.log("Purchases:", purchases?.length, "Error:", pErr);
for (const p of (purchases || [])) {
  console.log(`Purchase ID: ${p.id}, supplier_id: ${p.supplier_id}, item: ${p.item_name}, total: ${p.total_amount}, paid: ${p.paid_amount}, project_id: ${p.project_id}`);
}
