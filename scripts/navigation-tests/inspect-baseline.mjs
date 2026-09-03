import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Read from .env file dynamically without hardcoded credentials
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found');
  process.exit(1);
}

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

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'profiles', 'treasuries', 'treasury_transactions', 'projects', 'clients',
  'suppliers', 'purchases', 'purchase_payments', 'technicians', 'technician_types',
  'technician_progress_records', 'expenses', 'client_payments', 'contracts'
];

console.log('=== DATABASE BASELINE COUNTS (READ-ONLY) ===');
for (const t of tables) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(t.padEnd(30), ':', error ? ('ERROR: ' + error.message) : count);
}
