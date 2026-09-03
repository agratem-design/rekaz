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

async function inspectDb() {
  console.log("=== DB SCHEMA AUDIT ===");
  
  // Query information schema via RPC or inspect tables
  const { data: supPayCols, error: err1 } = await supabase.from('supplier_payments').select('*').limit(0);
  console.log("supplier_payments error:", err1);

  const { data: supAllocCols, error: err2 } = await supabase.from('supplier_payment_allocations').select('*').limit(0);
  console.log("supplier_payment_allocations error:", err2);

  const { data: techPayCols, error: err3 } = await supabase.from('technician_payments').select('*').limit(0);
  console.log("technician_payments error:", err3);

  const { data: techAllocCols, error: err4 } = await supabase.from('technician_payment_allocations').select('*').limit(0);
  console.log("technician_payment_allocations error:", err4);
}

inspectDb();
