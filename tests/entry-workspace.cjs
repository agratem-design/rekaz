// Isolated browser regression: all database traffic is intercepted; no real writes.
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
 const env=fs.readFileSync('.env','utf8'); const base=env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g,'');
 const host=new URL(base).hostname; const storageKey=`sb-${host.split('.')[0]}-auth-token`;
 const project={id:'p1',name:'مشروع فيلا النخيل',project_type:'contracting',client_id:'c1',status:'active',clients:{name:'أحمد سالم'},created_at:'2026-10-01',finishing_percentage:null};
 const phases=[{id:'ph1',project_id:'p1',name:'الأساسات',reference_number:'01/26',status:'in_progress',order_index:1,description:'أعمال الحفر والقواعد والخرسانة'},{id:'ph2',project_id:'p1',name:'الهيكل الخرساني',reference_number:'02/26',status:'planned',order_index:2}];
 const items=[{id:'i1',project_id:'p1',phase_id:'ph1',name:'صب القواعد',quantity:10,unit_price:100,total_price:1000,progress:50,order_index:1},{id:'i2',project_id:'p1',phase_id:'ph2',name:'أعمدة الطابق الأول',quantity:5,unit_price:200,total_price:1000,progress:20,order_index:2}];
 const techs=[{id:'t1',name:'علي البناء',is_active:true,default_rate:50,default_rate_unit:'day'},{id:'t2',name:'سالم الحداد',is_active:true,default_rate:80,default_rate_unit:'day'}];
 const assignments=[], work=[], writes=[], errors=[];let fail=true;let itemFailed=false;let expenseFailed=false;
 const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({storageKey})=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});localStorage.setItem(storageKey,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+36000,user:{id:'u1',email:'test@example.com',aud:'authenticated'}}));},{storageKey});
 await page.route(`${base}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();let data=[];
  if(req.method()==='OPTIONS') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'}});
  if(req.method()!=='GET'){
   const body=req.postDataJSON(); writes.push({table,body});
   if(table==='project_items' && body.name==='بند يحتاج إعادة المحاولة' && !itemFailed){itemFailed=true;return route.fulfill({status:503,json:{message:'Temporary test failure'}});}
   if(table==='record_expense' && body.p_description==='مصروف يحتاج إعادة المحاولة' && !expenseFailed){expenseFailed=true;return route.fulfill({status:503,json:{message:'Temporary test failure'}});}
   if(table==='record_expense') data='expense-new';
   if(table==='project_items'){await new Promise(r=>setTimeout(r,300));items.push({...body,id:'quick-new',total_price:body.quantity*body.unit_price});}
   if(table==='record_purchase') data='purchase-new';
   if(table==='project_item_assignments'){const row={id:`a-${body.technician_id}`,...body,technicians:techs.find(t=>t.id===body.technician_id)};const old=assignments.findIndex(a=>a.technician_id===body.technician_id);if(old<0)assignments.push(row);else assignments[old]=row;}
   if(table==='record_technician_work') {if(fail){fail=false;return route.fulfill({status:503,json:{message:'Temporary test failure'}});} if(!work.some(w=>w.idempotency_key===body.p_key))work.push({id:`w${work.length}`,idempotency_key:body.p_key,technician_id:body.p_technician_id,project_id:body.p_project_id,phase_id:body.p_phase_id,project_item_id:body.p_item_id,quantity:body.p_quantity,rate:body.p_rate,rate_unit:body.p_rate_unit,amount:body.p_quantity*body.p_rate,status:'posted',work_date:body.p_date,technicians:techs.find(t=>t.id===body.p_technician_id),project_items:{name:'صب القواعد'}}); data='w';}
  } else {
   const db={profiles:[{id:'u1',display_name:'مدير المشروع',is_active:true}],user_roles:[{user_id:'u1',role:'admin'}],projects:[project],project_phases:phases,project_items:items,project_financials:[{project_id:'p1',client_obligation:2000,collected:500,client_remaining:1500,direct_cost:200,items_total:2000}],project_costs:[{project_id:'p1',labor:200}],technicians:techs,suppliers:[{id:'s1',name:'مورد الاختبار',is_active:true}],expense_categories:[{id:'cat1',name:'وقود',is_active:true}],treasuries:[{id:'tr1',name:'المقاولات',parent_id:null,domain:'contracting',is_active:true,kind:'cash'},{id:'tr2',name:'المكتب',parent_id:'tr1',domain:'contracting',is_active:true,kind:'cash'},{id:'tr3',name:'الصندوق الفرعي',parent_id:'tr2',domain:'contracting',is_active:true,kind:'cash'}],treasury_balances:[{treasury_id:'tr3',balance:10000}],measurement_units:[{id:'m3',name:'متر مكعب',symbol:'م³',components:['length','width','height']}],project_item_assignments:assignments,technician_work:work};data=db[table]??[];
   for(const [k,v] of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}
   if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]??null;
  }
  return route.fulfill({json:data});
 });
 await page.goto('http://localhost:5173/#/projects/p1');
 await page.getByRole('button',{name:/01\/26.*الأساسات/}).click();
 await page.getByRole('button',{name:'بند بتفاصيل',exact:true}).click();
 let panel=page.getByRole('dialog',{name:'إضافة بنود المرحلة',exact:true});
 await panel.getByRole('combobox',{name:'اسم البند',exact:false}).fill('بند تجريبي متتابع');
 await panel.getByRole('combobox',{name:'وحدة القياس',exact:false}).selectOption('m3');
 await panel.getByRole('spinbutton',{name:'الكمية',exact:false}).fill('4');
 await panel.getByRole('spinbutton',{name:'سعر الوحدة (د.ل)',exact:false}).fill('125');
 await page.screenshot({animations:'disabled',path:'test-screenshots/entry-workspace-item-desktop.png'});
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await panel.getByRole('status').filter({hasText:'تم حفظ 1'}).waitFor();
 assert.equal(await panel.getByRole('combobox',{name:'اسم البند',exact:false}).inputValue(),'');
 assert.equal(await panel.getByRole('combobox',{name:'وحدة القياس',exact:false}).inputValue(),'m3');
 assert.equal(await panel.getByRole('combobox',{name:'المرحلة',exact:true}).inputValue(),'ph1');
 assert.equal(writes.filter(w=>w.table==='project_items')[0].body.quantity,4);
 await panel.getByRole('combobox',{name:'اسم البند',exact:false}).fill('بند يحتاج إعادة المحاولة');
 await panel.getByRole('spinbutton',{name:'الكمية',exact:false}).fill('2');
 await panel.getByRole('spinbutton',{name:'سعر الوحدة (د.ل)',exact:false}).fill('30');
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await page.getByText(/بياناتك ما زالت في النموذج/).waitFor();
 assert.equal(await panel.getByRole('combobox',{name:'اسم البند',exact:false}).inputValue(),'بند يحتاج إعادة المحاولة');
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await panel.getByRole('status').filter({hasText:'تم حفظ 2'}).waitFor();
 assert.equal(items.filter(i=>i.name==='بند يحتاج إعادة المحاولة').length,1);
 assert.ok(items.at(-1).order_index>items.at(-2).order_index);
 await page.setViewportSize({width:375,height:812});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({animations:'disabled',path:'test-screenshots/entry-workspace-item-mobile.png'});
 await panel.getByRole('button',{name:'إغلاق',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://localhost:5173/#/expenses');
 await page.getByRole('button',{name:'تسجيل مصروف',exact:true}).first().click();
 panel=page.getByRole('dialog',{name:'مصروف عام',exact:true});
 await panel.getByRole('textbox',{name:'البيان',exact:false}).fill('وقود سيارة الموقع');
 await panel.getByRole('spinbutton',{name:'المبلغ (د.ل)',exact:false}).fill('75.250');
 await panel.getByRole('combobox',{name:'الخزينة',exact:false}).selectOption('tr3');
 assert.equal(await panel.getByRole('combobox',{name:'الخزينة',exact:false}).locator('option:checked').innerText(),'المقاولات / المكتب / الصندوق الفرعي — 10,000 د.ل');
 await panel.getByText('الفاتورة والمرفقات والملاحظات (اختياري)',{exact:true}).click();
 await panel.getByRole('textbox',{name:'ملاحظات',exact:true}).fill('تجربة إدخال معزولة');
 await panel.getByRole('textbox',{name:'البيان',exact:false}).scrollIntoViewIfNeeded();
 await page.screenshot({animations:'disabled',path:'test-screenshots/entry-workspace-expense-desktop.png'});
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await panel.getByRole('status').filter({hasText:'تم حفظ 1'}).waitFor();
 const first=writes.filter(w=>w.table==='record_expense')[0].body;
 assert.equal(first.p_treasury_id,'tr3');assert.equal(first.p_amount,75.25);assert.equal(first.p_notes,'تجربة إدخال معزولة');
 assert.equal(await panel.getByRole('textbox',{name:'البيان',exact:false}).inputValue(),'');
 assert.equal(await panel.getByRole('combobox',{name:'الخزينة',exact:false}).inputValue(),'tr3');
 assert.equal(await panel.getByRole('textbox',{name:'ملاحظات',exact:true}).inputValue(),'');
 await panel.getByRole('textbox',{name:'البيان',exact:false}).fill('مصروف يحتاج إعادة المحاولة');
 await panel.getByRole('spinbutton',{name:'المبلغ (د.ل)',exact:false}).fill('20');
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await page.getByText('Temporary test failure',{exact:true}).waitFor();
 assert.equal(await panel.getByRole('textbox',{name:'البيان',exact:false}).inputValue(),'مصروف يحتاج إعادة المحاولة');
 await panel.getByRole('button',{name:'حفظ وإضافة التالي',exact:true}).click();
 await panel.getByRole('status').filter({hasText:'تم حفظ 2'}).waitFor();
 const expenseWrites=writes.filter(w=>w.table==='record_expense');
 assert.notEqual(expenseWrites[0].body.p_key,expenseWrites[1].body.p_key);
 assert.equal(expenseWrites[1].body.p_key,expenseWrites[2].body.p_key);
 for(const width of [375,768,1024,1440]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({animations:'disabled',path:'test-screenshots/entry-workspace-expense-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: continuous item and expense entry, preserved phase/unit/treasury, cleared transaction-specific fields, failed save keeps draft, retry keeps idempotency key, nested treasury direct selection, responsive 375/768/1024/1440, no runtime errors; all financial writes mocked');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

