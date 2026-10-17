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
 const assignments=[], work=[], writes=[], errors=[];let fail=true;
 const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({storageKey})=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});localStorage.setItem(storageKey,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+36000,user:{id:'u1',email:'test@example.com',aud:'authenticated'}}));},{storageKey});
 await page.route(`${base}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();let data=[];
  if(req.method()==='OPTIONS') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'}});
  if(req.method()!=='GET'){
   const body=req.postDataJSON(); writes.push({table,body});
   if(table==='project_item_assignments'){const row={id:`a-${body.technician_id}`,...body,technicians:techs.find(t=>t.id===body.technician_id)};const old=assignments.findIndex(a=>a.technician_id===body.technician_id);if(old<0)assignments.push(row);else assignments[old]=row;}
   if(table==='record_technician_work') {if(fail){fail=false;return route.fulfill({status:503,json:{message:'Temporary test failure'}});} if(!work.some(w=>w.idempotency_key===body.p_key))work.push({id:`w${work.length}`,idempotency_key:body.p_key,technician_id:body.p_technician_id,project_id:body.p_project_id,phase_id:body.p_phase_id,project_item_id:body.p_item_id,quantity:body.p_quantity,rate:body.p_rate,rate_unit:body.p_rate_unit,amount:body.p_quantity*body.p_rate,status:'posted',work_date:body.p_date,technicians:techs.find(t=>t.id===body.p_technician_id),project_items:{name:'صب القواعد'}}); data='w';}
  } else {
   const db={profiles:[{id:'u1',display_name:'مدير المشروع',is_active:true}],user_roles:[{user_id:'u1',role:'admin'}],projects:[project],project_phases:phases,project_items:items,project_financials:[{project_id:'p1',client_obligation:2000,collected:500,client_remaining:1500,direct_cost:200,items_total:2000}],project_costs:[{project_id:'p1',labor:200}],technicians:techs,project_item_assignments:assignments,technician_work:work};data=db[table]??[];
   for(const [k,v] of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}
   if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]??null;
  }
  return route.fulfill({json:data});
 });
 await page.goto('http://localhost:5173/#/projects/p1');await page.getByRole('heading',{name:'مراحل المشروع',exact:true}).waitFor({timeout:10000}).catch(async e=>{console.log(await page.locator('body').innerText());console.log(errors);await page.screenshot({path:'test-screenshots/debug.png'});throw e;});
 assert.equal(await page.getByText('نسبة الإنجاز',{exact:true}).count(),0);
 await page.screenshot({path:'test-screenshots/phases-new-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/01\/26.*الأساسات/}).click();
 await page.getByText('صب القواعد',{exact:true}).waitFor();assert.equal(await page.getByText('أعمدة الطابق الأول',{exact:true}).count(),0);
 await page.getByRole('button',{name:'عمال البند ومستحقاتهم'}).click();
 const panel=page.getByRole('dialog',{name:'عمال البند ومستحقاتهم'});await panel.getByText('لم يُعيَّن فنيون لهذا البند').waitFor();
 async function addWorker(id,qty){const fields=panel.locator('fieldset');await fields.locator('select').nth(0).selectOption(id);await fields.locator('input[type=number]').nth(1).fill(qty);await panel.getByRole('button',{name:'إضافة العامل وتسجيل المستحق'}).click();}
 await addWorker('t1','2');await panel.getByRole('button',{name:'إعادة محاولة تسجيل المستحق'}).click();await panel.getByRole('link',{name:'علي البناء',exact:true}).first().waitFor();
 await addWorker('t2','3');await panel.getByRole('link',{name:'سالم الحداد',exact:true}).first().waitFor();
 assert.equal(work.length,2);assert.equal(work[0].amount,100);assert.equal(work[1].amount,240);assert.ok(work.every(w=>w.project_item_id==='i1'&&w.phase_id==='ph1'));
 const calls=writes.filter(w=>w.table==='record_technician_work');assert.equal(calls[0].body.p_key,calls[1].body.p_key);assert.match(calls[0].body.p_key,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 await page.screenshot({path:'test-screenshots/workers-new-desktop.png',fullPage:true});
 await page.goto('http://localhost:5173/#/projects/p1/contracts');await page.getByRole('heading',{name:'عقود المشروع'}).waitFor();await page.getByRole('button',{name:'عقد جديد'}).first().click();assert.equal(await page.getByText('المرحلة (اختياري)',{exact:true}).count(),0);
 await page.goto('http://localhost:5173/#/technicians/t1');await page.getByRole('button',{name:'صرف دفعة',exact:true}).click();
 const cash=page.getByRole('dialog',{name:'صرف دفعة لفني'});const amount=cash.getByLabel('المبلغ (د.ل)',{exact:false});await amount.click();await page.keyboard.type('1250.75');assert.equal(await amount.inputValue(),'1250.75');await cash.getByText('ملاحظات إضافية (اختياري)',{exact:true}).click();const notes=cash.locator('textarea');await notes.click();await page.keyboard.insertText('دفعة عن أعمال القواعد');assert.equal(await notes.inputValue(),'دفعة عن أعمال القواعد');
 await cash.getByRole('button',{name:'إغلاق',exact:true}).click();await page.getByRole('button',{name:'متابعة التعديل'}).click();await notes.click();await page.keyboard.insertText(' - اختبار');assert.match(await notes.inputValue(),/اختبار/);assert.equal(await amount.inputValue(),'1250.75');await page.screenshot({path:'test-screenshots/cash-inputs.png',fullPage:true});
 await page.goto('http://localhost:5173/#/projects/p1');await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'مراحل المشروع',exact:true}).waitFor();await page.screenshot({path:'test-screenshots/phases-new-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'تبديل المظهر'}).click();await page.waitForTimeout(300);await page.screenshot({path:'test-screenshots/phases-new-dark.png',fullPage:true});
 const unique=await page.evaluate(async()=>{const {newKey}=await import('/src/lib/queries.ts');return new Set(Array.from({length:1000},()=>newKey())).size});assert.equal(unique,1000);
 console.log('PASS: phase-first navigation, phase item isolation, no completion percentage, multiple workers, linked dues, retry idempotency, HTTP UUID fallback, project contracts, cash amount and notes typing after discard cancellation, mobile overflow, light/dark rendering, 1000 unique HTTP UUIDs, no runtime errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
