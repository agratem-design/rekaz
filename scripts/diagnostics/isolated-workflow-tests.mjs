import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import vm from 'node:vm';

// Deliberately in-memory. This test cannot reach Supabase or user data.
const db = new PGlite();
const read = (file) => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const migration = async (file) => db.exec(read('supabase/migrations/' + file));
const productionFunction = async (file, name) => {
  const source = read('supabase/migrations/' + file);
  const match = source.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.' + name + '\\([\\s\\S]*?\\$\\$;'));
  assert.ok(match, `Missing production function ${name}`);
  await db.exec(match[0]);
};
const sql = async (query, params = []) => (await db.query(query, params)).rows;
const scalar = async (query, params = []) => Object.values((await sql(query, params))[0])[0];
const rpc = (name, ...params) => scalar(`select public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')})`, params);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), client = id(2), treasury = id(3), project = id(4), otherProject = id(5), technician = id(6);
let passes = 0;
async function test(name, fn) { await fn(); passes++; console.log(`PASS ${name}`); }
const receipt = (amount, projectId = project, overrides = {}) => ({ client_id: client, project_id: projectId,
  treasury_id: treasury, amount, payment_method: 'cash', date: '2026-09-03', notes: 'isolated test', ...overrides });
try {
  await db.exec(read('scripts/diagnostics/isolated-workflow-fixture.sql'));
  await migration('20260816180000_create_client_credit_ledger.sql');
  await migration('20260902092000_enable_client_advance_payments.sql');
  await productionFunction('20260831200000_technician_work_value_and_advance_payments.sql','pay_technician_on_account_atomic');
  await migration('20260902091000_enable_supplier_advances.sql');
  await productionFunction('20260817000000_ux_phase_4_server_authority_and_retry_safety.sql','get_treasury_root_domain');
  await productionFunction('20260220201724_c75fa87c-1d3a-47d3-8eaa-b620834210ec.sql','auto_sync_treasury_balance');
  await db.exec('create trigger treasury_sync_test after insert or update or delete on treasury_transactions for each row execute function auto_sync_treasury_balance()');
  await migration('20260903090000_client_receipt_workflow_integrity.sql');
  await migration('20260903091000_atomic_project_workflow.sql');
  await migration('20260903092000_account_credit_and_deposits.sql');
  await migration('20260903093000_serialize_party_payments.sql');
  await migration('20260903094000_apply_supplier_advance.sql');
  await migration('20260903100000_finishing_technician_additive_and_cash_flow.sql');
  await db.exec(`insert into user_roles values('${actor}','admin'); insert into clients values('${client}','test');
    insert into treasuries(id,name) values('${treasury}','test');
    insert into projects(id,client_id,budget) values('${project}','${client}',100),('${otherProject}','${client}',200);
    insert into technicians(id,name) values('${technician}','test');
    select set_config('request.jwt.claim.sub','${actor}',false);`);

  let first;
  await test('project receipt, cash journal and treasury agree', async () => {
    first = await rpc('record_client_receipt_v2', receipt(150), 'receipt-1');
    assert.equal(first.credit_created,50); assert.equal(first.cash_applied_to_project,100);
    assert.equal(Number(await scalar('select balance from treasuries where id=$1',[treasury])),150);
    assert.equal(Number(await scalar('select count(*) from income where reference_id=$1',[first.payment_id])),1);
  });
  await test('retry returns the original receipt, without duplicate cash', async () => {
    assert.deepEqual(await rpc('record_client_receipt_v2',receipt(150),'receipt-1'),first);
    assert.equal(Number(await scalar('select count(*) from client_payments')),1);
  });
  await test('same operation key with changed data is rejected', async () => {
    await assert.rejects(rpc('record_client_receipt_v2',receipt(151),'receipt-1'),/بيانات مختلفة/);
  });
  await test('available credit does not settle an unrelated project automatically', async () => {
    assert.equal(Number(await rpc('get_project_authoritative_remaining',otherProject)),200);
    assert.equal(Number(await rpc('get_client_available_credit',client)),50);
  });
  await test('persisted excess is not spent again when original project grows', async () => {
    await sql('update projects set budget=200 where id=$1',[project]);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',project)),100);
  });
  await test('general receipt without any project becomes available credit', async () => {
    const result=await rpc('record_client_receipt_v2',receipt(70,null),'general-1');
    assert.equal(result.credit_created,70); assert.equal(result.cash_applied_to_project,0);
    assert.equal(Number(await rpc('get_client_available_credit',client)),120);
  });
  await test('foreign project and inactive treasury roll back completely', async () => {
    const count=await scalar('select count(*) from client_payments');
    await assert.rejects(rpc('record_client_receipt_v2',receipt(2,id(999)),'bad-project'));
    await sql('update treasuries set is_active=false where id=$1',[treasury]);
    await assert.rejects(rpc('record_client_receipt_v2',receipt(2),'bad-treasury'));
    await sql('update treasuries set is_active=true where id=$1',[treasury]);
    assert.equal(await scalar('select count(*) from client_payments'),count);
    assert.equal(Number(await scalar("select count(*) from workflow_requests where request_key like 'bad-%'")),0);
  });
  await test('failure after payment insertion rolls back header, credit and income', async () => {
    await db.exec(`create function reject_cash_test() returns trigger language plpgsql as $$ begin raise exception 'injected treasury failure'; end $$;
      create trigger reject_cash_test before insert on treasury_transactions for each row execute function reject_cash_test();`);
    const count=await scalar('select count(*) from client_payments');
    await assert.rejects(rpc('record_client_receipt_v2',receipt(4),'rollback-cash'),/injected treasury failure/);
    assert.equal(await scalar('select count(*) from client_payments'),count);
    await db.exec('drop trigger reject_cash_test on treasury_transactions');
    assert.equal((await rpc('record_client_receipt_v2',receipt(4),'rollback-cash')).success,true);
  });
  await test('equal-amount equal-date receipts remain independent on reversal', async () => {
    const a=await rpc('record_client_receipt_v2',receipt(10),'same-a');
    const b=await rpc('record_client_receipt_v2',receipt(10),'same-b');
    await rpc('reverse_client_receipt_v2',a.payment_id);
    await rpc('reverse_client_receipt_v2',a.payment_id);
    assert.equal(Number(await scalar('select count(*) from income where reference_id=$1',[b.payment_id])),1);
    assert.equal(Number(await scalar("select count(*) from treasury_transactions where reference_id=$1 and reference_type='client_payment_reversal'",[a.payment_id])),1);
    assert.equal(Number(await scalar('select count(*) from client_payments where id=$1',[a.payment_id])),1);
  });
  await test('credit-generating receipt reverses without violating immutable ledger FKs', async () => {
    await rpc('reverse_client_receipt_v2',first.payment_id);
    assert.equal(Number(await scalar("select sum(amount) from client_credit_ledger where source_payment_id=$1 and entry_type='CREDIT_CREATION_REVERSED'",[first.payment_id])),50);
  });
  await test('failed correction restores original receipt and balances', async () => {
    const result=await rpc('record_client_receipt_v2',receipt(12),'correct-me');
    const balance=await scalar('select balance from treasuries where id=$1',[treasury]);
    await assert.rejects(rpc('update_client_receipt_v2',result.payment_id,receipt(-1),'correction-failure'));
    assert.equal(await scalar('select reversed_at from client_payments where id=$1',[result.payment_id]),null);
    assert.equal(await scalar('select balance from treasuries where id=$1',[treasury]),balance);
    const fixed=await rpc('update_client_receipt_v2',result.payment_id,receipt(8),'correction-success');
    assert.notEqual(fixed.payment_id,result.payment_id);
    assert.equal(Number(await scalar('select balance from treasuries where id=$1',[treasury])),Number(balance)-4);
    assert.deepEqual(await rpc('update_client_receipt_v2',result.payment_id,receipt(8),'correction-success'),fixed);
  });
  let item;
  const itemPayload={project_id:project,phase_id:null,name:'test item',measurement_type:'linear',quantity:2,unit_price:10,total_price:20};
  await test('item and technician save atomically; failed technician leaves no orphan item', async () => {
    await assert.rejects(rpc('save_project_item_atomic',null,itemPayload,{technician_id:id(999),rate:5,quantity:2},'item-failed'));
    assert.equal(Number(await scalar('select count(*) from project_items')),0);
    item=await rpc('save_project_item_atomic',null,itemPayload,{technician_id:technician,rate:5,quantity:2},'item-ok');
    assert.equal(Number(await scalar('select sum(total_cost) from project_item_technicians')),10);
    assert.deepEqual(await rpc('save_project_item_atomic',null,itemPayload,{technician_id:technician,rate:5,quantity:2},'item-ok'),item);
  });
  await test('failed bulk deletion restores technician assignments', async () => {
    await db.exec(`create function reject_item_test() returns trigger language plpgsql as $$ begin raise exception 'injected item failure'; end $$;
      create trigger reject_item_test before delete on project_items for each row execute function reject_item_test();`);
    await assert.rejects(rpc('delete_project_items_atomic',project,[item.id]),/injected item failure/);
    assert.equal(Number(await scalar('select count(*) from project_item_technicians')),1);
    await db.exec('drop trigger reject_item_test on project_items');
    await rpc('delete_project_items_atomic',project,[item.id]);
    assert.equal(Number(await scalar('select count(*) from project_item_technicians')),0);
  });
  await test('finishing labor uses existing invoice fields and edits rather than duplicates', async () => {
    await sql("update projects set project_type='finishing',finishing_percentage=10 where id=$1",[otherProject]);
    const payload={project_id:otherProject,phase_id:null,project_item_id:null,technician_id:technician,quantity:2,rate:30,title:'labor',date:'2026-09-03'};
    const work=await rpc('save_technician_work_v2',null,payload,'work-1');
    await rpc('save_technician_work_v2',work.id,{...payload,quantity:3},'work-edit');
    assert.equal(Number(await scalar('select count(*) from purchases')),1);
    assert.equal(Number(await scalar('select total_amount from purchases where id=$1',[work.id])),90);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',otherProject)),99);
    await sql('update purchases set paid_amount=80 where id=$1',[work.id]);
    await assert.rejects(rpc('save_technician_work_v2',work.id,{...payload,quantity:1},'work-invalid-edit'));
  });
  await test('anonymous access and direct receipt writes are denied', async () => {
    await db.exec('set role anon');
    await assert.rejects(sql('select * from client_payments'),/permission denied/);
    await assert.rejects(rpc('record_client_receipt_v2',receipt(1),'anon'),/permission denied/);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(sql('delete from client_payments'),/permission denied/);
    await assert.rejects(sql("insert into client_credit_ledger(client_id,entry_type,amount,source_payment_id) values($1,'CREDIT_CREATED',10,$2)",[client,first.payment_id]),/permission denied/);
    await db.exec('reset role');
  });
  await test('nonfinancial users cannot invoke security-definer receipt APIs', async () => {
    await sql("select set_config('request.jwt.claim.sub',$1,false)",[id(333)]);
    await assert.rejects(rpc('record_client_receipt_v2',receipt(1),'engineer'),/للمدير والمحاسب/);
    await sql("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  });
  await test('UI calculation includes allocations, applied credit and does not offset other projects', async () => {
    const module={exports:{}}; vm.runInNewContext(ts.transpileModule(read('src/lib/financialCore.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module.exports,module});
    const result=module.exports.calculateProjectFinancials({project:{id:project,budget:200},clientPayments:[{id:'a',project_id:project,amount:150}],
      creditLedger:[{entry_type:'CREDIT_CREATED',source_payment_id:'a',amount:50},{entry_type:'CREDIT_APPLIED',target_project_id:project,amount:20}],
      purchases:[{id:'p',purchase_type:'material',total_amount:80}],supplierPaymentAllocations:[{purchase_id:'p',amount:30}]});
    assert.equal(result.clientRemaining,80); assert.equal(result.cashFlow.supplierPaid,30); assert.equal(result.cashFlow.supplierRemaining,50);
  });
  await test('applying and reversing client credit is idempotent and never moves cash', async () => {
    const balance=await scalar('select balance from treasuries where id=$1',[treasury]);
    const payload={client_id:client,project_id:otherProject,amount:30};
    const applied=await rpc('apply_client_credit_v2',payload,'apply-credit');
    assert.deepEqual(await rpc('apply_client_credit_v2',payload,'apply-credit'),applied);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',otherProject)),69);
    assert.equal(await scalar('select balance from treasuries where id=$1',[treasury]),balance);
    await rpc('reverse_client_credit_application',applied.entry_id,null);
    await rpc('reverse_client_credit_application',applied.entry_id,null);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',otherProject)),99);
  });
  await test('spent credit blocks cancelling its general receipt', async () => {
    const paymentId=await scalar("select id from client_payments where project_id is null and reversed_at is null");
    const applied=await rpc('apply_client_credit_v2',{client_id:client,project_id:otherProject,amount:60},'spend-credit');
    await assert.rejects(rpc('reverse_client_receipt_v2',paymentId),/استُخدم/);
    await rpc('reverse_client_credit_application',applied.entry_id,null);
    await rpc('reverse_client_receipt_v2',paymentId);
  });
  await test('technician deposit and partial refund are separate from work, income and outgoing payments', async () => {
    const before=Number(await scalar('select balance from treasuries where id=$1',[treasury]));
    const incomeCount=await scalar('select count(*) from income');
    const payload={technician_id:technician,treasury_id:treasury,entry_type:'receipt',amount:100,date:'2026-09-03'};
    const deposit=await rpc('record_technician_deposit_v2',payload,'deposit');
    assert.deepEqual(await rpc('record_technician_deposit_v2',payload,'deposit'),deposit);
    await rpc('record_technician_deposit_v2',{...payload,entry_type:'refund',amount:40},'refund');
    await assert.rejects(rpc('record_technician_deposit_v2',{...payload,entry_type:'refund',amount:61},'too-much-refund'));
    assert.equal(Number(await scalar('select balance from treasuries where id=$1',[treasury])),before+60);
    assert.equal(await scalar('select count(*) from income'),incomeCount);
    assert.equal(Number(await scalar('select count(*) from technician_payments')),0);
    await assert.rejects(sql('delete from technician_deposits'),/غير قابل/);
  });
  await test('technician payment supports an advance, includes finishing work and retries once', async () => {
    const result=await rpc('pay_technician_on_account_atomic',technician,treasury,150,'cash','2026-09-03',null,null,'tech-pay',null);
    assert.equal(result.total_work,90); assert.equal(result.balance_after,-60);
    assert.deepEqual(await rpc('pay_technician_on_account_atomic',technician,treasury,150,'cash','2026-09-03',null,null,'tech-pay',null),result);
    assert.equal(Number(await scalar("select count(*) from treasury_transactions where reference_type='technician_payment'")),1);
    await assert.rejects(rpc('pay_technician_on_account_atomic',technician,treasury,151,'cash','2026-09-03',null,null,'tech-pay',null),/بيانات مختلفة/);
  });
  await test('supplier payment allocates due and preserves unallocated advance without double withdrawal', async () => {
    const supplier=id(700), invoice=id(701);
    await sql('insert into suppliers(id,name) values($1,$2)',[supplier,'test supplier']);
    await sql('insert into purchases(id,supplier_id,project_id,total_amount) values($1,$2,$3,80)',[invoice,supplier,project]);
    const result=await rpc('pay_supplier_on_account_atomic',supplier,treasury,100,'cash','2026-09-03',null,null,'supplier-pay');
    assert.equal(result.allocated_amount,80); assert.equal(result.advance_amount,20);
    assert.deepEqual(await rpc('pay_supplier_on_account_atomic',supplier,treasury,100,'cash','2026-09-03',null,null,'supplier-pay'),result);
    assert.equal(Number(await scalar('select paid_amount from purchases where id=$1',[invoice])),80);
    assert.equal(Number(await scalar("select count(*) from treasury_transactions where reference_type='supplier_payment'")),1);
    const advance=await rpc('pay_supplier_on_account_atomic',supplier,treasury,25,'cash','2026-09-03',null,null,'supplier-advance');
    assert.equal(advance.allocated_amount,0); assert.equal(advance.advance_amount,25);
  });
  await test('a later supplier invoice consumes existing advances without moving cash again', async () => {
    const invoice=id(702), supplier=id(700);
    await sql('insert into purchases(id,supplier_id,project_id,total_amount) values($1,$2,$3,40)',[invoice,supplier,project]);
    const balance=await scalar('select balance from treasuries where id=$1',[treasury]);
    const cashCount=await scalar('select count(*) from treasury_transactions');
    const result=await rpc('apply_supplier_advance_v2',supplier,invoice,40,'use-supplier-advance');
    assert.equal(result.cash_movement,0);
    assert.deepEqual(await rpc('apply_supplier_advance_v2',supplier,invoice,40,'use-supplier-advance'),result);
    assert.equal(Number(await scalar('select paid_amount from purchases where id=$1',[invoice])),40);
    assert.equal(await scalar('select balance from treasuries where id=$1',[treasury]),balance);
    assert.equal(await scalar('select count(*) from treasury_transactions'),cashCount);
    await assert.rejects(rpc('apply_supplier_advance_v2',supplier,invoice,1,'overpay-invoice'),/يتجاوز/);
    const next=id(703);
    await sql('insert into purchases(id,supplier_id,project_id,total_amount) values($1,$2,$3,20)',[next,supplier,project]);
    await assert.rejects(rpc('apply_supplier_advance_v2',supplier,next,6,'overspend-advance'),/لا يكفي/);
    assert.equal(Number(await scalar('select count(*) from supplier_payment_allocations where purchase_id=$1',[next])),0);
    await rpc('apply_supplier_advance_v2',supplier,next,5,'use-remainder');
  });
  await test('finishing SQL and UI agree on legacy materials, rentals and zero quantities', async () => {
    const pid=id(800);
    await sql("insert into projects(id,client_id,project_type,finishing_percentage) values($1,$2,'finishing',10)",[pid,client]);
    await sql('insert into purchases(id,project_id,total_amount,purchase_type) values($1,$2,100,null)',[id(801),pid]);
    await sql('insert into equipment_rentals(id,project_id,total_amount) values($1,$2,20)',[id(802),pid]);
    await sql('insert into project_items(id,project_id,name) values($1,$2,$3)',[id(803),pid,'zero quantity']);
    await sql('insert into project_item_technicians(project_item_id,technician_id,rate,quantity,total_cost) values($1,$2,50,0,0)',[id(803),technician]);
    const module={exports:{}};
    vm.runInNewContext(ts.transpileModule(read('src/lib/financialCore.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports,module});
    const data={project:{id:pid,project_type:'finishing',finishing_percentage:10},purchases:[{id:id(801),total_amount:100,purchase_type:null}],
      rentals:[{id:id(802),total_amount:20}],projectItemTechnicians:[{rate:50,quantity:0,total_cost:0}],creditLedger:[]};
    assert.equal(module.exports.calculateProjectFinancials(data).clientRemaining,132);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',pid)),132);
    await sql("insert into purchases(id,project_id,total_amount,purchase_type,technician_id) values($1,$2,30,'rental',$3)",[id(804),pid,technician]);
    data.purchases.push({id:id(804),total_amount:30,purchase_type:'rental',technician_id:technician});
    assert.equal(module.exports.calculateProjectFinancials(data).clientRemaining,143);
    assert.equal(Number(await rpc('get_project_authoritative_remaining',pid)),143);
  });
  await test('nonfinite financial values and foreign client projects leave no receipts', async () => {
    const before=await scalar('select count(*) from client_payments');
    for (const amount of ['NaN','Infinity','-Infinity',0,-1]) {
      await assert.rejects(rpc('record_client_receipt_v2',receipt(amount),`invalid-${amount}`));
    }
    await sql('insert into clients(id,name) values($1,$2)',[id(900),'other client']);
    await sql('insert into projects(id,client_id,budget) values($1,$2,100)',[id(901),id(900)]);
    await assert.rejects(rpc('record_client_receipt_v2',receipt(1,id(901)),'foreign-client'));
    assert.equal(await scalar('select count(*) from client_payments'),before);
  });
  await test('authorized authenticated RPC works but anonymous credit reads are denied', async () => {
    await db.exec('set role authenticated');
    const result=await rpc('record_client_receipt_v2',receipt(1),'authenticated-receipt');
    assert.equal(result.success,true);
    await assert.rejects(sql('insert into technician_deposits(technician_id,treasury_id,entry_type,amount,date) values($1,$2,$3,1,current_date)',[technician,treasury,'receipt']),/permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(rpc('get_client_available_credit',client),/permission denied/);
    await assert.rejects(sql('select * from equipment_rentals'),/permission denied/);
    await assert.rejects(rpc('apply_supplier_advance_v2',id(700),id(703),1,'anon-advance'),/permission denied/);
    await db.exec('reset role');
  });
  await test('supplier advance allocation settles due invoice without creating phantom project cash out', async () => {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(read('src/lib/financialCore.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: module.exports, module });
    const result = module.exports.calculateProjectFinancials({
      project: { id: project, budget: 200 },
      clientPayments: [{ id: 'cp-1', project_id: project, amount: 100 }],
      purchases: [{ id: 'pur-1', purchase_type: 'material', total_amount: 80 }],
      purchasePayments: [],
      supplierPaymentAllocations: [{ purchase_id: 'pur-1', amount: 80 }],
    });
    assert.equal(result.cashFlow.supplierPaid, 80);
    assert.equal(result.cashFlow.supplierRemaining, 0);
    assert.equal(result.cashFlow.actualCashIn, 100);
    assert.equal(result.cashFlow.actualCashOut, 0);
    assert.equal(result.cashFlow.netCashFlow, 100);
  });
  await test('finishing project adds item assignments and labor purchases together in UI and SQL', async () => {
    const dualProjectId = id(850);
    await sql("insert into projects(id,client_id,project_type,finishing_percentage) values($1,$2,'finishing',10)", [dualProjectId, client]);
    await sql("insert into project_items(id,project_id,name) values($1,$2,'dual item')", [id(851), dualProjectId]);
    await sql("insert into project_item_technicians(project_item_id,technician_id,rate,quantity,total_cost) values($1,$2,40,2,80)", [id(851), technician]);
    await sql("insert into purchases(id,project_id,purchase_type,technician_id,total_amount) values($1,$2,'labor',$3,50)", [id(852), dualProjectId, technician]);
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(read('src/lib/financialCore.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: module.exports, module });
    const data = {
      project: { id: dualProjectId, project_type: 'finishing', finishing_percentage: 10 },
      projectItems: [{ id: id(851), project_id: dualProjectId }],
      projectItemTechnicians: [{ project_item_id: id(851), technician_id: technician, rate: 40, quantity: 2, total_cost: 80 }],
      purchases: [{ id: id(852), project_id: dualProjectId, purchase_type: 'labor', technician_id: technician, total_amount: 50 }],
      creditLedger: [],
    };
    const finRes = module.exports.calculateProjectFinancials(data);
    assert.equal(finRes.breakdown.technicianEarned, 130);
    assert.equal(finRes.clientObligation, 143);
    assert.equal(finRes.clientRemaining, 143);
    assert.equal(Number(await rpc('get_project_authoritative_remaining', dualProjectId)), 143);
  });
  console.log(`\n${passes} isolated workflow tests passed. No live data was read or changed.`);
} finally { await db.close(); }
