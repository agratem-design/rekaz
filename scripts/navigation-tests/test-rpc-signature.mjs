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

// Call supabase with a dummy test to inspect behavior
const { data, error } = await supabase.rpc('settle_supplier_project_invoices_atomic', {
  p_supplier_id: '9ccae955-17b4-4448-b780-7b89bb17607c',
  p_project_id: 'aa55be07-8a68-465e-933f-78ed0f359a0c',
  p_treasury_id: 'f0357f4d-d783-4345-ae1e-d9ab802263e9',
  p_payment_method: 'cash',
  p_date: '2026-08-31',
  p_notes: 'test',
  p_allocations: []
});

console.log("RPC result with valid project:", data, "RPC Error:", error);
