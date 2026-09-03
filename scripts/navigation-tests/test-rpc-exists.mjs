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

const { data, error } = await supabase.rpc('settle_supplier_project_invoices_atomic', {
  p_supplier_id: '00000000-0000-0000-0000-000000000000',
  p_project_id: '00000000-0000-0000-0000-000000000000',
  p_treasury_id: '00000000-0000-0000-0000-000000000000',
  p_payment_method: 'cash',
  p_date: '2026-08-31',
  p_notes: 'test',
  p_allocations: []
});

console.log("RPC result:", data, "RPC Error:", error);
