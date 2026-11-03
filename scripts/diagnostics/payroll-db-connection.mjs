import fs from 'node:fs';
import pg from 'pg';
export function payrollClient(batchPath) {
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
let connection = url ? { connectionString: url } : null;
if (!connection && batchPath) {
  const batch = fs.readFileSync(batchPath, 'utf8');
  const password = batch.match(/^\s*@?set\s+"?PGPASSWORD=(.+)$/mi)?.[1].trim().replace(/"$/, '');
  const command = batch.split(/\r?\n/).find(line => /pg_dump\.exe/i.test(line));
  const host = command?.match(/-h\s+"?([^"\s]+)/)?.[1];
  const user = command?.match(/-U\s+"?([^"\s]+)/)?.[1];
  const port = Number(command?.match(/-p\s+(\d+)/)?.[1]);
  if (password && host && user && port) connection = { host, user, password, port, database: 'postgres', ssl: { rejectUnauthorized: true } };
}
if (!connection) throw new Error('Database connection unavailable');
return new pg.Client({ ...connection, ssl: { rejectUnauthorized: true, ca: fs.readFileSync('scripts/diagnostics/supabase-prod-ca.crt','utf8') }, connectionTimeoutMillis: 10000 });
}
