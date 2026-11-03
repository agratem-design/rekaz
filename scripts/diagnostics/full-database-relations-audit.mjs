import fs from 'node:fs';
import pg from 'pg';
const batchPath=process.argv[2];
const batch=fs.readFileSync(batchPath,'utf8');
const password=batch.match(/^\s*@?set\s+"?PGPASSWORD=(.+)$/mi)?.[1].trim().replace(/"$/, '');
const command=batch.split(/\r?\n/).find(line=>/pg_dump\.exe/i.test(line));
const host=command.match(/-h\s+"?([^"\s]+)/)?.[1]; const user=command.match(/-U\s+"?([^"\s]+)/)?.[1]; const port=Number(command.match(/-p\s+(\d+)/)?.[1]);
const cert=fs.readFileSync('scripts/diagnostics/supabase-prod-ca.crt','utf8');
const db=new pg.Client({host,user,password,port,database:'postgres',ssl:{rejectUnauthorized:true,ca:cert},connectionTimeoutMillis:15000});
await db.connect();
const q=async text=>(await db.query(text)).rows;
const result={};
result.tables=await q(`SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
result.idColumns=await q(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%_id' ORDER BY table_name,column_name`);
result.foreignKeys=await q(`SELECT tc.table_name, kcu.column_name, ccu.table_name foreign_table, ccu.column_name foreign_column, rc.delete_rule, rc.update_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name AND rc.constraint_schema=tc.table_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' ORDER BY tc.table_name,kcu.column_name`);
result.constraints=await q(`SELECT conrelid::regclass::text table_name, conname, contype, pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2`);
result.triggers=await q(`SELECT event_object_table table_name, trigger_name, action_timing, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema='public' ORDER BY event_object_table,trigger_name`);
result.rls=await q(`SELECT n.nspname schema_name,c.relname table_name,c.relrowsecurity rls_enabled,c.relforcerowsecurity force_rls,coalesce(array_agg(p.polname) FILTER (WHERE p.polname IS NOT NULL),'{}') policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_policy p ON p.polrelid=c.oid WHERE n.nspname='public' AND c.relkind='r' GROUP BY n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity ORDER BY c.relname`);
result.orphans=[];
result.unconstrainedIdColumns=result.idColumns.filter(c=>!result.foreignKeys.some(f=>f.table_name===c.table_name&&f.column_name===c.column_name));
for(const fk of result.foreignKeys){
  const child=`public."${fk.table_name.replaceAll('"','""')}"`, parent=`public."${fk.foreign_table.replaceAll('"','""')}"`;
  try { const rows=await q(`SELECT count(*)::int n FROM ${child} c LEFT JOIN ${parent} p ON c."${fk.column_name.replaceAll('"','""')}"=p."${fk.foreign_column.replaceAll('"','""')}" WHERE c."${fk.column_name.replaceAll('"','""')}" IS NOT NULL AND p."${fk.foreign_column.replaceAll('"','""')}" IS NULL`); if(rows[0].n) result.orphans.push({...fk,count:rows[0].n}); } catch(e) { result.orphans.push({...fk,error:e.message}); }
}
result.nullableSensitive=await q(`SELECT table_name,column_name,is_nullable,data_type FROM information_schema.columns WHERE table_schema='public' AND (column_name ILIKE '%treasury%' OR column_name ILIKE '%project%' OR column_name ILIKE '%employee%' OR column_name ILIKE '%payroll%' OR column_name ILIKE '%amount%' OR column_name ILIKE '%status%') AND is_nullable='YES' ORDER BY table_name,column_name`);
result.duplicateIndexes=await q(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND (indexdef ILIKE '%UNIQUE%' OR indexdef ILIKE '%reference_id%' OR indexdef ILIKE '%idempotency%') ORDER BY tablename,indexname`);
fs.writeFileSync('scripts/diagnostics/full-database-relations-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({tables:result.tables.length,foreignKeys:result.foreignKeys.length,orphans:result.orphans,rlsDisabled:result.rls.filter(x=>!x.rls_enabled).map(x=>x.table_name),unconstrainedIdColumns:result.unconstrainedIdColumns,triggers:result.triggers.length},null,2));
await db.end();
