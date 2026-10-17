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
   if(table==='project_items'){await new Promise(r=>setTimeout(r,300));items.push({...body,id:'quick-new',total_price:body.quantity*body.unit_price});}
   if(table==='record_purchase') data='purchase-new';
   if(table==='project_item_assignments'){const row={id:`a-${body.technician_id}`,...body,technicians:techs.find(t=>t.id===body.technician_id)};const old=assignments.findIndex(a=>a.technician_id===body.technician_id);if(old<0)assignments.push(row);else assignments[old]=row;}
   if(table==='record_technician_work') {if(fail){fail=false;return route.fulfill({status:503,json:{message:'Temporary test failure'}});} if(!work.some(w=>w.idempotency_key===body.p_key))work.push({id:`w${work.length}`,idempotency_key:body.p_key,technician_id:body.p_technician_id,project_id:body.p_project_id,phase_id:body.p_phase_id,project_item_id:body.p_item_id,quantity:body.p_quantity,rate:body.p_rate,rate_unit:body.p_rate_unit,amount:body.p_quantity*body.p_rate,status:'posted',work_date:body.p_date,technicians:techs.find(t=>t.id===body.p_technician_id),project_items:{name:'صب القواعد'}}); data='w';}
  } else {
   const db={profiles:[{id:'u1',display_name:'مدير المشروع',is_active:true}],user_roles:[{user_id:'u1',role:'admin'}],projects:[project],project_phases:phases,project_items:items,project_financials:[{project_id:'p1',client_obligation:2000,collected:500,client_remaining:1500,direct_cost:200,items_total:2000}],project_costs:[{project_id:'p1',labor:200}],technicians:techs,suppliers:[{id:'s1',name:'مورد الاختبار',is_active:true}],measurement_units:[{id:'m3',name:'متر مكعب',symbol:'م³',components:['length','width','height']}],project_item_assignments:assignments,technician_work:work};data=db[table]??[];
   for(const [k,v] of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}
   if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]??null;
  }
  return route.fulfill({json:data});
 });

 items.forEach(i=>i.unit_id='m3');
 await page.goto('http://localhost:5173/#/projects/p1');
 await page.getByRole('button',{name:/01\/26.*الأساسات/}).click();
 await page.getByText('صب القواعد',{exact:true}).waitFor();
 const inspect=async()=>{
   const result=await page.locator('[data-number-with-unit]').evaluateAll(groups=>groups.filter(el=>el.children.length===2).map(el=>{const [number,unit]=el.children;const a=number.getBoundingClientRect(),b=unit.getBoundingClientRect();return {text:el.textContent,value:number.textContent,unit:unit.textContent,correct:a.left>=b.right-1};}));
   assert.ok(result.length>3);assert.ok(result.every(r=>r.correct),JSON.stringify(result));return result;
 };
 let values=await inspect();assert.ok(values.some(r=>r.unit==='م³'));assert.ok(values.some(r=>r.unit==='د.ل'));
 await page.getByRole('button',{name:'تبديل المظهر'}).click();
 await page.screenshot({path:'test-screenshots/number-unit-order.png',animations:'disabled'});
 await page.setViewportSize({width:375,height:812});await inspect();
 await page.goto('http://localhost:5173/#/expenses');await page.getByRole('button',{name:'تسجيل مصروف',exact:true}).first().click();
 const panel=page.getByRole('dialog',{name:'مصروف عام',exact:true});
 await panel.getByRole('spinbutton',{name:'المبلغ (د.ل)',exact:false}).fill('-1250.75');
 const negative=panel.locator('[data-number-with-unit]').filter({hasText:'-1,250.75'});
 assert.equal(await negative.locator('bdi').first().innerText(),'-1,250.75');
 assert.equal(await negative.evaluate(el=>{const [n,u]=el.children;return n.getBoundingClientRect().left>u.getBoundingClientRect().right}),true);
 assert.deepEqual(errors,[]);console.log('PASS: currency and unit follow numbers in RTL geometric order, desktop and mobile, negative sign and decimal preserved, no runtime errors; no database writes');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
