import fs from 'node:fs';
import pg from 'pg';
const env = fs.readFileSync('.env', 'utf8');
const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
let connection = url ? { connectionString: url } : null;
if (!connection && process.argv[2]) {
  const batch = fs.readFileSync(process.argv[2], 'utf8');
  const password = batch.match(/^\s*@?set\s+"?PGPASSWORD=(.+)$/mi)?.[1].trim().replace(/"$/, '');
  const command = batch.split(/\r?\n/).find(line => /pg_dump\.exe/i.test(line));
  const host = command?.match(/-h\s+"?([^"\s]+)/)?.[1];
  const user = command?.match(/-U\s+"?([^"\s]+)/)?.[1];
  const port = Number(command?.match(/-p\s+(\d+)/)?.[1]);
  if (password && host && user && port) connection = { host, user, password, port, database: 'postgres', ssl: { rejectUnauthorized: true } };
}
if (!connection) { console.error('Database connection unavailable'); process.exit(1); }
const client = new pg.Client({ ...connection, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const { rows } = await client.query("SELECT p.proname, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE '%employee%' OR p.proname LIKE '%payroll%' OR p.proname LIKE '%custody%')");
  fs.writeFileSync('scripts/diagnostics/payroll-schema-audit.json', JSON.stringify(rows, null, 2));
  console.log(rows.map(r => r.proname).join('\n'));
  const schema = await client.query(`SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod) type, a.attgenerated
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('employee_advances','employee_advance_repayments','employee_payroll_slips','employee_payrolls') AND a.attnum>0 AND NOT a.attisdropped`);
  const triggers = await client.query(`SELECT c.relname, pg_get_triggerdef(t.oid) definition, pg_get_functiondef(t.tgfoid) function_definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relname IN ('employee_advances','employee_advance_repayments','employee_payroll_slips','employee_payrolls','treasury_transactions')`);
  const constraints = await client.query(`SELECT conrelid::regclass::text table_name, pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid IN ('public.employee_advances'::regclass,'public.employee_advance_repayments'::regclass,'public.employee_payroll_slips'::regclass,'public.employee_payrolls'::regclass)`);
  fs.writeFileSync('scripts/diagnostics/payroll-structure-audit.json', JSON.stringify({ columns:schema.rows,triggers:triggers.rows,constraints:constraints.rows },null,2));
} catch (error) { console.error(error.code || 'Connection unavailable'); process.exitCode = 1; }
finally { await client.end(); }
