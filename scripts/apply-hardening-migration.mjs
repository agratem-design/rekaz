import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';

for (const rawLine of envContent.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/20260831180000_harden_payment_headers_integrity.sql', 'utf8');
  await client.query(sql);
  console.log('HARDENING MIGRATION APPLIED SUCCESSFULLY TO POSTGRESQL');
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
