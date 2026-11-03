// دورة الصرف كاملة على قاعدة معزولة في الذاكرة: من الالتزام حتى خروج المبلغ من الخزينة ومطابقته.
// كل فحص يعمل مستقلاً، فتظهر كل الأخطاء معاً، والخروج غير صفري عند أي فشل.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from 'file:///E:/ركاز-v2/tmp/invoice-db-test/node_modules/@electric-sql/pglite/dist/index.js';

const db=new PGlite();
await db.exec(fs.readFileSync('supabase/tests/00_supabase_shim.sql','utf8'));
for(const name of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8').replace('create extension if not exists pgcrypto;',''));
const admin=randomUUID(),engineer=randomUUID();
await db.query("insert into auth.users(id,email) values($1,'admin@test.local'),($2,'engineer@test.local')",[admin,engineer]);
await db.query("insert into public.user_roles(user_id,role) values($1,'admin'),($2,'engineer')",[admin,engineer]);
const as=(id)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
await as(admin);

const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const scalar=async(sql,args=[])=>Object.values(await one(sql,args))[0];
const num=async(sql,args=[])=>Number(await scalar(sql,args));
const cmd=(action,data,key=randomUUID())=>scalar('select public.business_command($1,$2,$3::jsonb)',[key,action,JSON.stringify(data)]);
const balance=(t)=>num('select balance from public.treasury_balances where treasury_id=$1',[t]);
const count=(table,where='true',args=[])=>num(`select count(*) from public.${table} where ${where}`,args);
const invoice=(supplier,total,project=null,kind='material',returns=null)=>scalar("select public.record_purchase($1,$2,$3::public.purchase_kind,$4,'2026-10-01',$5,null,null,null,null,'[]'::jsonb,$6)",[randomUUID(),supplier,kind,total,project,returns]);
const paySupplier=(supplier,treasury,amount,allocations=[],key=randomUUID())=>scalar("select public.pay_supplier($1,$2,$3,$4,'2026-10-02',$5::jsonb)",[key,supplier,treasury,amount,JSON.stringify(allocations)]);
const remaining=(id)=>num('select remaining from public.purchase_balances where purchase_id=$1',[id]);
const due=(s)=>num('select balance_due from public.supplier_balances where supplier_id=$1',[s]);
const payTech=(tech,treasury,amount,project=null,key=randomUUID())=>scalar("select public.pay_technician($1,$2,$3,$4,'2026-10-03',$5)",[key,tech,treasury,amount,project]);
const techDue=(t)=>num('select balance_due from public.technician_balances where technician_id=$1',[t]);
const expense=(treasury,custody,amount,project=null)=>scalar("select public.record_expense($1,'مصروف اختبار',$2,'2026-10-04',$3,$4,$5)",[randomUUID(),amount,treasury,custody,project]);

const client=await scalar("insert into public.clients(name) values('زبون الدورة') returning id");
const contracting=await scalar("insert into public.projects(name,project_type,client_id) values('مشروع مقاولات','contracting',$1) returning id",[client]);
const finishing=await scalar("insert into public.projects(name,project_type,client_id,finishing_percentage) values('مشروع تشطيبات','finishing',$1,10) returning id",[client]);
const main=await scalar("select public.save_treasury($1::jsonb)",[JSON.stringify({name:'خزينة المقاولات',domain:'contracting',opening:'50000',opening_date:'2026-01-01'})]);
const finishingBox=await scalar("select public.save_treasury($1::jsonb)",[JSON.stringify({name:'خزينة التشطيبات',domain:'finishing',opening:'20000',opening_date:'2026-01-01'})]);
const general=await scalar("select public.save_treasury($1::jsonb)",[JSON.stringify({name:'الخزينة العامة',domain:'general',opening:'30000',opening_date:'2026-01-01'})]);
const newSupplier=(name)=>scalar('insert into public.suppliers(name) values($1) returning id',[name]);
const newTech=(name)=>scalar('insert into public.technicians(name) values($1) returning id',[name]);
const employee=await scalar("insert into public.employees(name,base_salary) values('موظف الدورة',1000) returning id");

const results=[];
const check=async(name,fn)=>{try{await fn();results.push(true);console.log('PASS',name)}catch(e){results.push(false);console.log('FAIL',name,'—',e.message.split('\n')[0])}};
const rejects=(promise,pattern)=>assert.rejects(promise,pattern);

await check('فاتورة المورد التزام فقط: لا تحرك الخزينة وتدخل تكلفة المشروع',async()=>{
 const s=await newSupplier('مورد 1'),before=await balance(main);await invoice(s,1000,contracting);
 assert.equal(await balance(main),before);assert.equal(await due(s),1000);
 assert.equal(await num('select direct_cost from public.project_costs where project_id=$1',[contracting]),1000);
});
await check('سداد جزئي لفاتورة: ينقص الخزينة والمتبقي ويبقي تكلفة المشروع',async()=>{
 const s=await newSupplier('مورد 2'),p=await invoice(s,1000,contracting),before=await balance(main),cost=await num('select direct_cost from public.project_costs where project_id=$1',[contracting]);
 const id=await paySupplier(s,main,400,[{purchase_id:p,amount:400}]);
 assert.equal(await balance(main),before-400);assert.equal(await remaining(p),600);assert.equal(await due(s),600);
 assert.equal(await count('treasury_entries',"source_type='supplier_payment' and source_id=$1 and direction='out'",[id]),1);
 assert.equal(await num('select direct_cost from public.project_costs where project_id=$1',[contracting]),cost);
});
await check('السداد الكامل يغلق الفاتورة ويمنع الزيادة عليها',async()=>{
 const s=await newSupplier('مورد 3'),p=await invoice(s,500,contracting);await paySupplier(s,main,500,[{purchase_id:p,amount:500}]);
 assert.equal(await remaining(p),0);await rejects(paySupplier(s,main,1,[{purchase_id:p,amount:1}]),/يتجاوز المتبقي/);
});
await check('المرتجع يخفض المتبقي على فاتورته نفسها',async()=>{
 const s=await newSupplier('مورد 4'),p=await invoice(s,1000,contracting);await invoice(s,200,contracting,'return',p);
 assert.equal(await due(s),800);assert.equal(await remaining(p),800);
});
await check('لا يمكن سداد فاتورة بأكثر من صافيها بعد المرتجع',async()=>{
 const s=await newSupplier('مورد 5'),p=await invoice(s,1000,contracting),before=await balance(main);await invoice(s,200,contracting,'return',p);
 await rejects(paySupplier(s,main,1000,[{purchase_id:p,amount:1000}]),/يتجاوز المتبقي/);assert.equal(await balance(main),before);
});
await check('المرتجع على فاتورة مسددة بالكامل يترك رصيداً لنا عند المورد والمتبقي صفر',async()=>{
 const s=await newSupplier('مورد 6'),p=await invoice(s,1000,contracting);await paySupplier(s,main,1000,[{purchase_id:p,amount:1000}]);await invoice(s,300,contracting,'return',p);
 assert.equal(await remaining(p),0);assert.equal(await due(s),-300);
});
await check('إلغاء المرتجع يعيد المتبقي',async()=>{
 const s=await newSupplier('مورد 7'),p=await invoice(s,1000,contracting),r=await invoice(s,200,contracting,'return',p);
 await db.query("select public.reverse_purchase($1,'خطأ إدخال')",[r]);assert.equal(await remaining(p),1000);assert.equal(await due(s),1000);
});
await check('الدفعة المقدمة تبقى ظاهرة ثم توزع بلا حركة خزينة',async()=>{
 const s=await newSupplier('مورد 8'),pay=await paySupplier(s,general,300),after=await balance(general);
 assert.equal(await num('select unallocated_advance from public.supplier_balances where supplier_id=$1',[s]),300);
 const p=await invoice(s,500);await db.query('select public.allocate_supplier_advance($1,$2,300)',[pay,p]);
 assert.equal(await remaining(p),200);assert.equal(await balance(general),after);
 assert.equal(await num('select unallocated_advance from public.supplier_balances where supplier_id=$1',[s]),0);
});
await check('إلغاء الدفعة يعيد المبلغ والمتبقي بقيد عكسي مرة واحدة',async()=>{
 const s=await newSupplier('مورد 9'),p=await invoice(s,700,contracting),before=await balance(main),id=await paySupplier(s,main,700,[{purchase_id:p,amount:700}]);
 await db.query("select public.reverse_supplier_payment($1,'خطأ')",[id]);
 assert.equal(await balance(main),before);assert.equal(await remaining(p),700);
 await rejects(db.query("select public.reverse_supplier_payment($1,'خطأ')",[id]),/ملغى مسبقاً/);
});
await check('تكرار الطلب بنفس المفتاح لا يكرر الخروج من الخزينة',async()=>{
 const s=await newSupplier('مورد 10'),p=await invoice(s,100,contracting),key=randomUUID(),before=await balance(main);
 const a=await paySupplier(s,main,100,[{purchase_id:p,amount:100}],key),b=await paySupplier(s,main,100,[{purchase_id:p,amount:100}],key);
 assert.equal(a,b);assert.equal(await balance(main),before-100);
});
await check('الرصيد غير الكافي يرفض العملية كلها بلا أثر جزئي',async()=>{
 const s=await newSupplier('مورد 11'),p=await invoice(s,900000,contracting),before=await count('supplier_payments');
 await rejects(paySupplier(s,main,900000,[{purchase_id:p,amount:900000}]),/الرصيد غير كافٍ/);
 assert.equal(await count('supplier_payments'),before);assert.equal(await remaining(p),900000);
});
await check('خزينة قطاع آخر مرفوضة لفاتورة مشروع',async()=>{
 const s=await newSupplier('مورد 12'),p=await invoice(s,100,contracting);
 await rejects(paySupplier(s,finishingBox,100,[{purchase_id:p,amount:100}]),/لا تتبع قطاع/);
});
await check('عمل الفني مستحق فقط، والصرف له يخرج من الخزينة والتجاوز يصبح مقدماً',async()=>{
 const t=await newTech('فني 1'),before=await balance(main);
 await db.query("select public.record_technician_work($1,$2,$3,'2026-10-02','day',10,50)",[randomUUID(),t,contracting]);
 assert.equal(await balance(main),before);assert.equal(await techDue(t),500);
 const id=await payTech(t,main,300,contracting);assert.equal(await balance(main),before-300);assert.equal(await techDue(t),200);
 await payTech(t,main,250,contracting);assert.equal(await techDue(t),-50);
 await db.query("select public.reverse_technician_payment($1,'خطأ')",[id]);assert.equal(await techDue(t),250);assert.equal(await balance(main),before-250);
});
await check('الصرف للفني من خزينة قطاع آخر مرفوض مع مشروع ومسموح على حسابه العام',async()=>{
 const t=await newTech('فني 2');await rejects(payTech(t,finishingBox,10,contracting),/لا تتبع قطاع/);
 await payTech(t,general,10);assert.equal(await techDue(t),-10);
});
await check('مسير الرواتب مستحق فقط، والصرف جزئي ولا يتجاوز الصافي',async()=>{
 const before=await balance(general),run=await cmd('payroll_run',{period:'2026-10-01',lines:[{employee_id:employee,base_salary:1000,allowances:100,deductions:50}]});
 assert.equal(await balance(general),before);
 const slip=await one('select * from public.payroll_balances where run_id=$1',[run]);assert.equal(Number(slip.remaining),1050);
 const pay=await cmd('payroll_payment',{slip_id:slip.id,treasury_id:general,amount:600,date:'2026-10-05'});
 assert.equal(await balance(general),before-600);assert.equal(await num('select remaining from public.payroll_balances where id=$1',[slip.id]),450);
 await rejects(cmd('payroll_payment',{slip_id:slip.id,treasury_id:general,amount:451,date:'2026-10-05'}),/تتجاوز/);
 assert.equal(await count('treasury_entries',"source_type='payroll_slip' and source_id=$1 and direction='out'",[pay]),1);
 await cmd('reverse_payroll_payment',{id:pay,reason:'خطأ',date:'2026-10-06'});assert.equal(await balance(general),before);
 await cmd('reverse_payroll_slip',{id:slip.id,reason:'خطأ'});
});
await check('السلفة تخرج من الخزينة ويردها الموظف فتعود',async()=>{
 const before=await balance(general),a=await cmd('employee_advance',{employee_id:employee,kind:'advance',amount:200,treasury_id:general,date:'2026-10-05'});
 assert.equal(await balance(general),before-200);
 await cmd('employee_advance',{employee_id:employee,kind:'repayment',amount:200,treasury_id:general,date:'2026-10-06'});
 assert.equal(await balance(general),before);assert.ok(a);
});
await check('دورة العهدة: صرف ثم مصروف منها ثم إرجاع ثم إغلاق',async()=>{
 const before=await balance(main),c=await scalar("select public.issue_custody($1,$2,1000,'2026-10-05',$3,null,$4)",[randomUUID(),main,employee,contracting]);
 assert.equal(await balance(main),before-1000);
 await expense(null,c,600,contracting);assert.equal(await balance(main),before-1000);
 await rejects(db.query('select public.close_custody($1)',[c]),/متبقٍ/);
 await db.query("select public.return_custody_cash($1,$2,$3,400,'2026-10-06')",[randomUUID(),c,main]);
 assert.equal(await balance(main),before-600);await db.query('select public.close_custody($1)',[c]);
 assert.equal(await num('select remaining from public.custody_balances where custody_id=$1',[c]),0);
});
await check('لا يبقى في عهدة مغلقة رصيد بعد إلغاء إرجاعها',async()=>{
 const c=await scalar("select public.issue_custody($1,$2,500,'2026-10-05',$3)",[randomUUID(),general,employee]);
 const r=await scalar("select public.return_custody_cash($1,$2,$3,500,'2026-10-06')",[randomUUID(),c,general]);
 await db.query('select public.close_custody($1)',[c]);await db.query("select public.reverse_custody_return($1,'خطأ')",[r]);
 const row=await one('select remaining,is_closed from public.custody_balances where custody_id=$1',[c]);
 assert.ok(!(row.is_closed&&Number(row.remaining)!==0),`مغلقة وفيها ${row.remaining}`);
});
await check('لا يبقى في عهدة مغلقة رصيد بعد إلغاء مصروفها',async()=>{
 const c=await scalar("select public.issue_custody($1,$2,500,'2026-10-05',$3)",[randomUUID(),general,employee]),e=await expense(null,c,500);
 await db.query('select public.close_custody($1)',[c]);await db.query("select public.reverse_expense($1,'خطأ')",[e]);
 const row=await one('select remaining,is_closed from public.custody_balances where custody_id=$1',[c]);
 assert.ok(!(row.is_closed&&Number(row.remaining)!==0),`مغلقة وفيها ${row.remaining}`);
});
await check('المصروف من الخزينة يخرج مرة واحدة ويدخل تكلفة مشروعه',async()=>{
 const before=await balance(main),cost=await num('select direct_cost from public.project_costs where project_id=$1',[contracting]);
 const e=await expense(main,null,150,contracting);assert.equal(await balance(main),before-150);
 assert.equal(await num('select direct_cost from public.project_costs where project_id=$1',[contracting]),cost+150);
 await db.query("select public.reverse_expense($1,'خطأ')",[e]);assert.equal(await balance(main),before);
});
await check('التحويل لا يغير مجموع الخزائن',async()=>{
 const total=await num('select sum(balance) from public.treasury_balances'),before=await balance(general);
 const id=await scalar("select public.transfer_between_treasuries($1,$2,$3,1000,'2026-10-07')",[randomUUID(),general,finishingBox]);
 assert.equal(await balance(general),before-1000);assert.equal(await num('select sum(balance) from public.treasury_balances'),total);
 await db.query("select public.reverse_transfer($1,'خطأ')",[id]);assert.equal(await balance(general),before);
});
await check('الدور غير المالي لا يصرف من الخزينة',async()=>{
 const s=await newSupplier('مورد 13'),t=await newTech('فني 3'),before=await balance(main);await as(engineer);
 try{
  await rejects(paySupplier(s,main,10),/غير مصرح|صلاحية/);await rejects(payTech(t,main,10),/غير مصرح|صلاحية/);
  await rejects(cmd('employee_advance',{employee_id:employee,kind:'advance',amount:1,treasury_id:main}),/غير مصرح|صلاحية/);
 }finally{await as(admin)}
 assert.equal(await balance(main),before);
});
// ─── السداد على مستوى المشروع: المقاول وسيط، ولكل مشروع حسابه ───
const payOnProject=(supplier,project,treasury,amount,key=randomUUID())=>scalar("select public.pay_supplier_on_project($1,$2,$3,$4,$5,'2026-10-08')",[key,supplier,project,treasury,amount]);
const supplierOn=(s,p)=>one('select * from public.supplier_project_balances where supplier_id=$1 and project_id is not distinct from $2',[s,p]);
const techOn=(t,p)=>one('select * from public.technician_project_balances where technician_id=$1 and project_id is not distinct from $2',[t,p]);
const work=(t,p,qty,rate,item=null)=>scalar("select public.record_technician_work($1,$2,$3,'2026-10-02','day',$4,$5,null,$6)",[randomUUID(),t,p,qty,rate,item]);
const rework=(id,parts,key=randomUUID())=>scalar("select public.rework_technician_work($1,$2,'تصحيح الكمية',$3::jsonb)",[key,id,JSON.stringify(parts)]);
const cost=(p)=>num('select direct_cost from public.project_costs where project_id=$1',[p]);
const receipt=(p,amount,treasury,key=randomUUID())=>scalar("select public.record_client_receipt($1,$2,$3,$4,$5,'2026-10-09')",[key,client,p,treasury,amount]);
const clientRemaining=(p)=>num('select client_remaining from public.project_financials where project_id=$1',[p]);
const otherContracting=await scalar("insert into public.projects(name,project_type,client_id) values('مشروع مقاولات ثان','contracting',$1) returning id",[client]);
await db.query("insert into public.project_items(project_id,name,quantity,unit_price,unit_id) select $1,'بند العقد',1,20000,id from public.measurement_units limit 1",[contracting]);
await db.query("insert into public.project_items(project_id,name,quantity,unit_price,unit_id) select $1,'بند الثاني',1,5000,id from public.measurement_units limit 1",[otherContracting]);

await check('دفعة على مشروع بلا فاتورة تغطي فواتيره من الأقدم والزيادة مقدم على المشروع نفسه',async()=>{
 const s=await newSupplier('مورد 14'),a=await invoice(s,300,contracting),b=await invoice(s,500,contracting),other=await invoice(s,700,otherContracting),before=await balance(main);
 const pay=await payOnProject(s,contracting,main,1000);
 assert.equal(await balance(main),before-1000);assert.equal(await remaining(a),0);assert.equal(await remaining(b),0);assert.equal(await remaining(other),700);
 const row=await supplierOn(s,contracting);assert.equal(Number(row.paid),1000);assert.equal(Number(row.balance_due),-200);assert.equal(Number(row.unallocated_advance),200);
 assert.equal(Number((await supplierOn(s,otherContracting)).balance_due),700);
 await rejects(db.query('select public.allocate_supplier_advance($1,$2,100)',[pay,other]),/مشروع آخر/);
});
await check('حسابات المورد لكل مشروع تساوي رصيده الكلي، والإلغاء يعيدها',async()=>{
 const s=await newSupplier('مورد 15'),g=await invoice(s,250),p=await invoice(s,800,contracting),pay=await payOnProject(s,contracting,main,500);
 await paySupplier(s,general,100);
 assert.equal(await num('select sum(balance_due) from public.supplier_project_balances where supplier_id=$1',[s]),await due(s));
 assert.equal(await due(s),450);assert.equal(Number((await supplierOn(s,null)).balance_due),150);assert.ok(g);
 await db.query("select public.reverse_supplier_payment($1,'خطأ')",[pay]);assert.equal(await remaining(p),800);assert.equal(Number((await supplierOn(s,contracting)).paid),0);
});
await check('دفعة المشروع تكرارها آمن، وخزينة قطاع آخر مرفوضة، والمشروع مطلوب',async()=>{
 const s=await newSupplier('مورد 16'),key=randomUUID(),before=await balance(main);await invoice(s,100,contracting);
 assert.equal(await payOnProject(s,contracting,main,100,key),await payOnProject(s,contracting,main,100,key));assert.equal(await balance(main),before-100);
 await rejects(payOnProject(s,contracting,finishingBox,50),/لا تتبع قطاع/);await rejects(payOnProject(s,null,main,50),/المشروع مطلوب/);
});
await check('حساب الفني لكل مشروع مستقل، والدفعة على الحساب لا تدخل أي مشروع',async()=>{
 const t=await newTech('فني 4');await work(t,contracting,10,100);await work(t,otherContracting,5,100);
 await payTech(t,main,400,contracting);await payTech(t,main,500,otherContracting);await payTech(t,general,50);
 assert.equal(Number((await techOn(t,contracting)).balance_due),600);assert.equal(Number((await techOn(t,otherContracting)).balance_due),0);assert.equal(Number((await techOn(t,null)).balance_due),-50);
 assert.equal(await num('select sum(balance_due) from public.technician_project_balances where technician_id=$1',[t]),await techDue(t));assert.equal(await techDue(t),550);
});
await check('كل دوال الإلغاء تعمل فعلاً ولا يبقى السجل قائماً',async()=>{
 const t=await newTech('فني 14'),s=await newSupplier('مورد 20'),date='2026-10-10';
 const undo=async(fn,table,id,args="$1,'إلغاء اختبار'")=>{await db.query(`select public.${fn}(${args})`,[id]);assert.equal(await scalar(`select status from public.${table} where id=$1`,[id]),'reversed',fn)};
 await undo('reverse_technician_work','technician_work',await work(t,contracting,1,10));
 await undo('reverse_technician_payment','technician_payments',await payTech(t,main,10));
 await undo('reverse_technician_receipt','technician_receipts',await scalar("select public.receive_from_technician($1,$2,$3,10,$4)",[randomUUID(),t,main,date]));
 await undo('reverse_purchase','purchases',await invoice(s,10));
 await undo('reverse_supplier_payment','supplier_payments',await paySupplier(s,general,10));
 await undo('reverse_expense','expenses',await expense(general,null,10));
 await undo('reverse_custody','custodies',await scalar("select public.issue_custody($1,$2,10,$3,$4)",[randomUUID(),general,date,employee]));
 await undo('reverse_transfer','transfers',await scalar("select public.transfer_between_treasuries($1,$2,$3,10,$4)",[randomUUID(),general,finishingBox,date]));
 await undo('reverse_client_receipt','client_receipts',await scalar("select public.record_client_receipt($1,$2,$3,$4,10,$5)",[randomUUID(),client,contracting,main,date]));
});
await check('تغيير كمية أو سعر سجل عمل مباشرة ما زال مرفوضاً',async()=>{
 const t=await newTech('فني 15'),w=await work(t,contracting,1,10);
 await rejects(db.query('update public.technician_work set quantity=5 where id=$1',[w]),/لا يمكن تعديل سجل مالي/);
 await rejects(db.query('update public.technician_work set rate=5 where id=$1',[w]),/لا يمكن تعديل سجل مالي/);
});
await check('عمل يزداد: سجل إضافي يرفع المستحق والتكلفة',async()=>{
 const t=await newTech('فني 5'),c=await cost(contracting);await work(t,contracting,4,50);await work(t,contracting,2,50);
 assert.equal(await techDue(t),300);assert.equal(await cost(contracting),c+300);
});
await check('تعديل العمل بزيادة أو نقص يبدل السجل بقيد واحد والمدفوع يبقى',async()=>{
 const t=await newTech('فني 6'),c=await cost(contracting),w=await work(t,contracting,10,100);await payTech(t,main,800,contracting);
 const up=await rework(w,[{technician_id:t,quantity:12,rate:100}]);assert.equal(await techDue(t),400);assert.equal(await cost(contracting),c+1200);
 await rework(up,[{technician_id:t,quantity:6,rate:100}]);assert.equal(await techDue(t),-200);assert.equal(await cost(contracting),c+600);
 assert.equal(await scalar('select status from public.technician_work where id=$1',[w]),'reversed');
 await rejects(rework(w,[{technician_id:t,quantity:1,rate:1}]),/ملغى مسبقاً/);
});
await check('تقسيم عمل بين فنيين: جاء الأول ثم الثاني والتكلفة لا تتكرر',async()=>{
 const a=await newTech('فني 7'),b=await newTech('فني 8'),c=await cost(contracting),w=await work(a,contracting,20,50),key=randomUUID();
 const first=await rework(w,[{technician_id:a,quantity:12,rate:50},{technician_id:b,quantity:8,rate:60}],key);
 assert.equal(await rework(w,[{technician_id:a,quantity:12,rate:50},{technician_id:b,quantity:8,rate:60}],key),first);
 assert.equal(await techDue(a),600);assert.equal(await techDue(b),480);assert.equal(await cost(contracting),c+1080);
 await payTech(b,main,480,contracting);assert.equal(await techDue(b),0);
});
await check('فنيان على البند نفسه: كل واحد بكميته وسعره ولا يختلط حسابهما',async()=>{
 const a=await newTech('فني 9'),b=await newTech('فني 10');
 const item=await scalar('select id from public.project_items where project_id=$1 limit 1',[contracting]);
 await work(a,contracting,5,100,item);await work(b,contracting,3,120,item);
 assert.equal(await techDue(a),500);assert.equal(await techDue(b),360);
 assert.equal(await num('select count(*) from public.technician_work where project_item_id=$1 and technician_id = any($2::uuid[]) and status=$3',[item,[a,b],'posted']),2);
});
await check('الدور غير المالي لا يعدل العمل ولا يسدد على مشروع',async()=>{
 const t=await newTech('فني 11'),s=await newSupplier('مورد 17'),w=await work(t,contracting,1,10);await as(engineer);
 try{await rejects(rework(w,[{technician_id:t,quantity:2,rate:10}]),/غير مصرح|صلاحية/);await rejects(payOnProject(s,contracting,main,10),/غير مصرح|صلاحية/)}finally{await as(admin)}
});
await check('قبض الزبون يدخل الخزينة ويخص مشروعه فقط ولا يسدد مورداً أو فنياً',async()=>{
 const s=await newSupplier('مورد 18'),t=await newTech('فني 12');await invoice(s,600,otherContracting);await work(t,otherContracting,1,400);
 const a=await clientRemaining(contracting),b=await clientRemaining(otherContracting),before=await balance(main);
 const r=await receipt(contracting,1000,main);
 assert.equal(await balance(main),before+1000);assert.equal(await clientRemaining(contracting),a-1000);assert.equal(await clientRemaining(otherContracting),b);
 assert.equal(await due(s),600);assert.equal(await techDue(t),400);
 await db.query("select public.reverse_client_receipt($1,'خطأ')",[r]);assert.equal(await balance(main),before);
});
await check('دفعة الزبون على الحساب رصيد دائن لا يمس أي مشروع حتى يُطبَّق صراحة',async()=>{
 const a=await clientRemaining(otherContracting),before=await balance(general),credit=await num('select available_credit from public.client_credit_balances where client_id=$1',[client]);
 await receipt(null,700,general);
 assert.equal(await balance(general),before+700);assert.equal(await clientRemaining(otherContracting),a);
 assert.equal(await num('select available_credit from public.client_credit_balances where client_id=$1',[client]),credit+700);
 await db.query('select public.apply_client_credit($1,$2,$3,300)',[randomUUID(),client,otherContracting]);
 assert.equal(await clientRemaining(otherContracting),a-300);assert.equal(await balance(general),before+700);
});
await check('موقف المقاول النقدي: ما دخل من الزبون مقابل ما خرج فعلاً ولا يتأثر مشروع بآخر',async()=>{
 const p=await scalar("insert into public.projects(name,project_type,client_id) values('مشروع الوساطة','contracting',$1) returning id",[client]);
 const s=await newSupplier('مورد 19'),t=await newTech('فني 13');await invoice(s,3000,p);await work(t,p,10,100);
 await receipt(p,2000,main);await payOnProject(s,p,main,1500);await payTech(t,main,400,p);await expense(main,null,100,p);
 const c=await one('select * from public.project_cash_position where project_id=$1',[p]);
 assert.equal(Number(c.received),2000);assert.equal(Number(c.paid_suppliers),1500);assert.equal(Number(c.paid_technicians),400);assert.equal(Number(c.paid_expenses),100);
 assert.equal(Number(c.total_paid),2000);assert.equal(Number(c.cash_position),0);assert.equal(Number(c.unpaid_dues),2100);
 await payOnProject(s,p,main,1500);assert.equal(await num('select cash_position from public.project_cash_position where project_id=$1',[p]),-1500);
});
// ─── نواقص الدورة: استرداد المورد، نقل الدفعة لمشروع، الديون بين الخزائن، الاعتماد، خزينة الرواتب ───
const refund=(s,t,amount,p=null,key=randomUUID())=>scalar("select public.receive_from_supplier($1,$2,$3,$4,'2026-10-11',$5)",[key,s,t,amount,p]);
await check('مرتجع على فاتورة مسددة: نستلم الفرق من المورد فيدخل الخزينة ويُقفل حسابه',async()=>{
 const s=await newSupplier('مورد 21'),p=await invoice(s,1000,contracting);await paySupplier(s,main,1000,[{purchase_id:p,amount:1000}]);await invoice(s,300,contracting,'return',p);
 assert.equal(await due(s),-300);await rejects(refund(s,main,301),/لنا عند المورد/);
 const before=await balance(main),cash=await num('select paid_suppliers from public.project_cash_position where project_id=$1',[contracting]);
 const r=await refund(s,main,300,contracting);
 assert.equal(await balance(main),before+300);assert.equal(await due(s),0);assert.equal(Number((await supplierOn(s,contracting)).balance_due),0);
 assert.equal(await num('select paid_suppliers from public.project_cash_position where project_id=$1',[contracting]),cash-300);
 await rejects(refund(s,main,1),/لنا عند المورد/);
 await db.query("select public.reverse_supplier_refund($1,'خطأ')",[r]);assert.equal(await balance(main),before);assert.equal(await due(s),-300);
});
await check('دفعة على الحساب تُنقل لاحقاً إلى مشروع دون حركة خزينة، ومرة واحدة فقط',async()=>{
 const s=await newSupplier('مورد 22'),t=await newTech('فني 16');await invoice(s,400,contracting);await work(t,contracting,5,100);
 const sp=await paySupplier(s,main,400),tp=await payTech(t,main,300),before=await balance(main);
 await db.query("select public.assign_payment_to_project('supplier',$1,$2)",[sp,contracting]);
 await db.query("select public.assign_payment_to_project('technician',$1,$2)",[tp,contracting]);
 assert.equal(await balance(main),before);assert.equal(Number((await supplierOn(s,contracting)).balance_due),0);assert.equal(Number((await techOn(t,contracting)).balance_due),200);
 await rejects(db.query("select public.assign_payment_to_project('technician',$1,$2)",[tp,otherContracting]),/مسبقاً/);
 const g=await payTech(t,general,10);await rejects(db.query("select public.assign_payment_to_project('technician',$1,$2)",[g,contracting]),/لا تتبع قطاع/);
 const full=await paySupplier(s,general,50,[{purchase_id:await invoice(s,50),amount:50}]);await rejects(db.query("select public.assign_payment_to_project('supplier',$1,$2)",[full,contracting]),/موزعة بالكامل/);
 await rejects(db.query('update public.supplier_payments set amount=1 where id=$1',[sp]),/لا يمكن تعديل سجل مالي/);
 const s2=await newSupplier('مورد 24'),adv=await paySupplier(s2,main,150);await refund(s2,main,50);
 await rejects(db.query("select public.assign_payment_to_project('supplier',$1,$2)",[adv,contracting]),/استُرد جزء/);
});
await check('سلفة بين الخزائن تبقى ديناً حتى تُسدد، ولا يُسدد أكثر منها',async()=>{
 const transfer=(f,t,a,kind)=>scalar("select public.transfer_between_treasuries($1,$2,$3,$4,'2026-10-12',null,$5)",[randomUUID(),f,t,a,kind]);
 const loan=await transfer(general,finishingBox,2000,'loan');
 assert.equal(await num('select outstanding from public.treasury_loans where lender_id=$1 and borrower_id=$2',[general,finishingBox]),2000);
 await rejects(transfer(finishingBox,general,2001,'repayment'),/الدين القائم/);
 const rep=await transfer(finishingBox,general,500,'repayment');
 assert.equal(await num('select outstanding from public.treasury_loans where lender_id=$1 and borrower_id=$2',[general,finishingBox]),1500);
 await rejects(db.query("select public.reverse_transfer($1,'خطأ')",[loan]),/سُدد جزء/);
 await db.query("select public.reverse_transfer($1,'خطأ')",[rep]);await db.query("select public.reverse_transfer($1,'خطأ')",[loan]);
 assert.equal(await num('select coalesce(sum(outstanding),0) from public.treasury_loans where lender_id=$1 and borrower_id=$2',[general,finishingBox]),0);
});
await check('اعتماد الفاتورة للمدير فقط ولا يغير مالها',async()=>{
 const s=await newSupplier('مورد 23'),p=await invoice(s,100,contracting);
 await as(engineer);try{await rejects(db.query('select public.approve_purchase($1)',[p]),/للمدير/)}finally{await as(admin)}
 await db.query('select public.approve_purchase($1)',[p]);assert.ok(await scalar('select approved_at from public.purchases where id=$1',[p]));
 assert.equal(await remaining(p),100);await paySupplier(s,main,100,[{purchase_id:p,amount:100}]);assert.equal(await remaining(p),0);
});
await check('راتب على مشروع يُصرف من قطاعه أو العامة ويُرفض من قطاع آخر',async()=>{
 const run=await cmd('payroll_run',{period:'2026-09-01',project_id:contracting,lines:[{employee_id:employee,base_salary:500}]});
 const slip=await scalar('select id from public.payroll_slips where run_id=$1',[run]);
 await rejects(cmd('payroll_payment',{slip_id:slip,treasury_id:finishingBox,amount:100,date:'2026-10-05'}),/قطاعه/);
 await cmd('payroll_payment',{slip_id:slip,treasury_id:general,amount:100,date:'2026-10-05'});
 await cmd('payroll_payment',{slip_id:slip,treasury_id:main,amount:100,date:'2026-10-05'});
 assert.equal(await num('select remaining from public.payroll_balances where id=$1',[slip]),300);
});
await check('كل حركة صادرة لها مستند مصدر، والرصيد يساوي مجموع الحركات',async()=>{
 const orphans=await num(`select count(*) from public.treasury_entries e where e.direction='out' and e.reverses_entry_id is null and not case e.source_type
  when 'supplier_payment' then exists(select 1 from public.supplier_payments x where x.id=e.source_id)
  when 'technician_payment' then exists(select 1 from public.technician_payments x where x.id=e.source_id)
  when 'expense' then exists(select 1 from public.expenses x where x.id=e.source_id)
  when 'transfer' then exists(select 1 from public.transfers x where x.id=e.source_id)
  when 'custody_issue' then exists(select 1 from public.custodies x where x.id=e.source_id)
  when 'payroll_slip' then exists(select 1 from public.payroll_payments x where x.id=e.source_id)
  when 'employee_advance' then exists(select 1 from public.employee_advances x where x.id=e.source_id)
  else false end`);
 assert.equal(orphans,0);
 for(const t of [main,finishingBox,general])assert.equal(await balance(t),await num("select coalesce(sum(case when direction='in' then amount else -amount end),0) from public.treasury_entries where treasury_id=$1",[t]));
});

const failed=results.filter((r)=>!r).length;
console.log(`\n${results.length-failed}/${results.length} نجح`);
process.exit(failed?1:0);
