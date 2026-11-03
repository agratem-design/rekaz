import fs from 'node:fs';
import assert from 'node:assert/strict';
import { payrollClient } from './payroll-db-connection.mjs';
const client=payrollClient(process.argv[2]);
const apply=process.argv.includes('--apply');
const migrations=['20260913120000_payroll_advance_integrity','20260915120000_employee_advance_access_and_locking'];
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  const actor=await client.query("SELECT user_id FROM public.user_roles WHERE role::text IN ('admin','accountant') ORDER BY role::text LIMIT 1");
  assert(actor.rows[0],'No authorized financial user available for verification');
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor.rows[0].user_id]);
  const before=(await client.query('SELECT count(*)::int n,coalesce(sum(balance),0)::text balance FROM public.treasuries')).rows[0];
  for (const migration of migrations) {
    const version=migration.slice(0,14);
    const applied=await client.query('SELECT version FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
    if (applied.rowCount) throw new Error('Migration already recorded; inspect deployment before repeating');
    await client.query(fs.readFileSync(`supabase/migrations/${migration}.sql`,'utf8'));
  }
  await client.query('SAVEPOINT payroll_verification');
  await client.query(fs.readFileSync('scripts/diagnostics/verify-payroll-live.sql','utf8'));
  await client.query('ROLLBACK TO SAVEPOINT payroll_verification');
  const permissions=(await client.query("SELECT has_table_privilege('anon','public.employee_payroll_slips','SELECT') anon_read,has_table_privilege('authenticated','public.employee_payroll_slips','UPDATE') direct_write,has_function_privilege('authenticated','public.disburse_payroll_slip_v2(uuid,uuid,date,text)','EXECUTE') rpc")).rows[0];
  assert.equal(permissions.anon_read,false); assert.equal(permissions.direct_write,false); assert.equal(permissions.rpc,true);
  const after=(await client.query('SELECT count(*)::int n,coalesce(sum(balance),0)::text balance FROM public.treasuries')).rows[0];
  assert.deepEqual(after,before,'Test records or balances were not rolled back');
  if(apply) {
    for(const m of migrations) await client.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[m.slice(0,14),m.slice(15),[fs.readFileSync(`supabase/migrations/${m}.sql`,'utf8')]]);
    await client.query("NOTIFY pgrst, 'reload schema'");
    await client.query('COMMIT');
    console.log('APPLIED: both migrations; live schema verification passed; synthetic records rolled back; treasury totals unchanged.');
  } else { await client.query('ROLLBACK'); console.log('DRY RUN PASSED: actual database constraints, triggers, deductions, repayments, repeat calls and permissions; all changes rolled back.'); }
} catch(error) {
  await client.query('ROLLBACK').catch(()=>{});
  console.error('Verification failed:',error.code || '',error.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED]'));
  process.exitCode=1;
} finally { await client.end(); }
