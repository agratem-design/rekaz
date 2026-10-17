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
 const company={id:'company-1',company_name:'شركة الاختبار',print_settings:{custom_preserved:'keep-me'},storage_provider:'supabase',allow_negative_treasury:false};
 const assignments=[], work=[], writes=[], errors=[];let fail=true;
 const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({storageKey})=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});localStorage.setItem(storageKey,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+36000,user:{id:'u1',email:'test@example.com',aud:'authenticated'}}));},{storageKey});
 await page.route(`${base}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();let data=[];
  if(req.method()==='OPTIONS') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'}});
  if(req.method()!=='GET'){
   const body=req.postDataJSON(); writes.push({table,body});
   if(table==='company_settings') {Object.assign(company,body);data=company;}
   if(table==='project_items'){await new Promise(r=>setTimeout(r,300));items.push({...body,id:'quick-new',total_price:body.quantity*body.unit_price});}
   if(table==='record_purchase') data='purchase-new';
   if(table==='project_item_assignments'){const row={id:`a-${body.technician_id}`,...body,technicians:techs.find(t=>t.id===body.technician_id)};const old=assignments.findIndex(a=>a.technician_id===body.technician_id);if(old<0)assignments.push(row);else assignments[old]=row;}
   if(table==='record_technician_work') {if(fail){fail=false;return route.fulfill({status:503,json:{message:'Temporary test failure'}});} if(!work.some(w=>w.idempotency_key===body.p_key))work.push({id:`w${work.length}`,idempotency_key:body.p_key,technician_id:body.p_technician_id,project_id:body.p_project_id,phase_id:body.p_phase_id,project_item_id:body.p_item_id,quantity:body.p_quantity,rate:body.p_rate,rate_unit:body.p_rate_unit,amount:body.p_quantity*body.p_rate,status:'posted',work_date:body.p_date,technicians:techs.find(t=>t.id===body.p_technician_id),project_items:{name:'صب القواعد'}}); data='w';}
  } else {
   const db={company_settings:[company],profiles:[{id:'u1',display_name:'مدير المشروع',is_active:true}],user_roles:[{user_id:'u1',role:'admin'}],projects:[project],project_phases:phases,project_items:items,project_financials:[{project_id:'p1',client_obligation:2000,collected:500,client_remaining:1500,direct_cost:200,items_total:2000}],project_costs:[{project_id:'p1',labor:200}],technicians:techs,suppliers:[{id:'s1',name:'مورد الاختبار',is_active:true}],measurement_units:[{id:'m3',name:'متر مكعب',symbol:'م³',components:['length','width','height']}],project_item_assignments:assignments,technician_work:work};data=db[table]??[];
   for(const [k,v] of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}
   if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]??null;
  }
  return route.fulfill({json:data});
 });

 await page.goto('http://localhost:5173/#/settings');
 let section=page.getByRole('region',{name:'إعدادات المحاسب'});
 await section.getByRole('textbox',{name:'اسم المحاسب',exact:true}).fill('علي سالم');
 await section.getByRole('combobox',{name:'مكان ظهور المحاسب',exact:true}).selectOption('header');
 await section.getByRole('combobox',{name:'محاذاة المحاسب',exact:true}).selectOption('left');
 await page.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
 await page.getByText('تم حفظ الإعدادات',{exact:true}).waitFor();
 assert.equal(company.print_settings.accountant_name,'علي سالم');assert.equal(company.print_settings.accountant_position,'header');assert.equal(company.print_settings.custom_preserved,'keep-me');
 await page.reload();section=page.getByRole('region',{name:'إعدادات المحاسب'});
 assert.equal(await section.getByRole('textbox',{name:'اسم المحاسب',exact:true}).inputValue(),'علي سالم');
 await page.getByRole('tab',{name:'تصميم الطباعة والهوية',exact:true}).click();
 let accountant=page.locator('.pd-accountant');await accountant.waitFor();
 assert.equal(await accountant.getAttribute('data-accountant-position'),'header');
 assert.equal(await accountant.evaluate(el=>getComputedStyle(el).textAlign),'left');
 assert.equal(await accountant.evaluate(el=>el.nextElementSibling.classList.contains('pd-body')),true);
 assert.equal(await page.locator('.pd-accountant-line').count(),0);
 await page.getByRole('button',{name:'استعادة الألوان الافتراضية',exact:true}).click();assert.equal(await accountant.innerText(),'المحاسب\nعلي سالم');
 await page.getByRole('tab',{name:'بيانات الشركة',exact:true}).click();
 section=page.getByRole('region',{name:'إعدادات المحاسب'});
 await section.getByRole('combobox',{name:'مكان ظهور المحاسب',exact:true}).selectOption('footer');
 await section.getByRole('combobox',{name:'محاذاة المحاسب',exact:true}).selectOption('right');
 await page.getByRole('tab',{name:'تصميم الطباعة والهوية',exact:true}).click();
 accountant=page.locator('.pd-accountant');assert.equal(await accountant.getAttribute('data-accountant-position'),'footer');
 assert.equal(await accountant.evaluate(el=>el.previousElementSibling.classList.contains('pd-body')),true);
 assert.equal(await page.locator('.pd-accountant-line').count(),1);
 await page.locator('.pd').screenshot({path:'test-screenshots/accountant-footer-print.png',animations:'disabled'});
 await page.getByRole('tab',{name:'بيانات الشركة',exact:true}).click();
 section=page.getByRole('region',{name:'إعدادات المحاسب'});
 await section.getByRole('combobox',{name:'مكان ظهور المحاسب',exact:true}).selectOption('hidden');
 await page.getByRole('tab',{name:'تصميم الطباعة والهوية',exact:true}).click();assert.equal(await page.locator('.pd-accountant').count(),0);
 await page.getByRole('tab',{name:'بيانات الشركة',exact:true}).click();
 section=page.getByRole('region',{name:'إعدادات المحاسب'});
 await section.getByRole('combobox',{name:'مكان ظهور المحاسب',exact:true}).selectOption('footer');
 await section.getByRole('textbox',{name:'اسم المحاسب',exact:true}).fill('');
 await page.getByRole('tab',{name:'تصميم الطباعة والهوية',exact:true}).click();assert.equal(await page.locator('.pd-accountant').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: accountant settings save and reload, preserve unrelated settings, header/footer alignment and order, signature line only at footer, hidden/blank omitted, palette reset preserves accountant; mocked database writes');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
