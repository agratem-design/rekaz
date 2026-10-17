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
 const company={id:'company-1',company_name:'شركة الاختبار',tagline:'وصف محفوظ',logo_path:null,print_settings:{google_drive_script_url:'https://script.google.com/macros/s/test-upload/exec',custom_preserved:'keep-me'},storage_provider:'google_drive',allow_negative_treasury:false};let rejectLogo=false;let brokenUpload=false;let uploads=0;
 const assignments=[], work=[], writes=[], errors=[];let fail=true;
 const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({storageKey})=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});localStorage.setItem(storageKey,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+36000,user:{id:'u1',email:'test@example.com',aud:'authenticated'}}));},{storageKey});
 await page.route(`${base}/**`,async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();let data=[];
  if(req.method()==='OPTIONS') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'}});
  if(req.method()!=='GET'){
   const body=req.postDataJSON(); writes.push({table,body});
   if(table==='company_settings') {if(rejectLogo)return route.fulfill({status:403,json:{message:'test permission denied'}});Object.assign(company,body);data=company;}
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


 const uploaded=[];
 await page.route('https://script.google.com/macros/s/test-upload/exec',async route=>{
   uploaded.push(route.request().postDataJSON());
   await route.fulfill({json:{success:true,url:`https://lh3.googleusercontent.com/d/quality-${uploaded.length}`}});
 });
 await page.route('https://lh3.googleusercontent.com/d/**',async route=>{
   const index=Number(route.request().url().match(/quality-(\d+)/)[1])-1;
   await route.fulfill({contentType:uploaded[index].type,body:Buffer.from(uploaded[index].file,'base64'),headers:{'access-control-allow-origin':'*'}});
 });
 await page.goto('http://localhost:5173/#/settings');
 const original=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2048;c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#704b32';ctx.fillRect(500,250,1000,500);return c.toDataURL('image/png').split(',')[1]});
 await page.getByLabel('ملف شعار الشركة',{exact:true}).setInputFiles({name:'transparent-original.png',mimeType:'image/png',buffer:Buffer.from(original,'base64')});
 await page.waitForFunction(()=>document.querySelector('nav img')?.getAttribute('src')?.includes('quality-1'));
 assert.equal(uploaded[0].file,original);assert.equal(uploaded[0].type,'image/png');
 await page.getByLabel('ملف شعار الشركة',{exact:true}).setInputFiles({name:'transparent-vector.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect x="16" y="8" width="32" height="16" fill="brown"/></svg>')});
 await page.waitForFunction(()=>document.querySelector('nav img')?.getAttribute('src')?.includes('quality-2'));
 assert.equal(uploaded[1].type,'image/png');
 const pixels=await page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {width:img.width,height:img.height,corner:ctx.getImageData(0,0,1,1).data[3],center:ctx.getImageData(img.width/2,img.height/2,1,1).data[3]}},uploaded[1].file);
 assert.deepEqual(pixels,{width:3072,height:1536,corner:0,center:255});
 const backgrounds=await page.locator('img').evaluateAll(images=>images.map(img=>({alt:img.alt,bg:getComputedStyle(img).backgroundColor,parent:getComputedStyle(img.parentElement).backgroundColor})));
 for(const image of backgrounds){assert.equal(image.bg,'rgba(0, 0, 0, 0)');if(image.alt)assert.equal(image.parent,'rgba(0, 0, 0, 0)');}
 assert.deepEqual(errors,[]);console.log('PASS: PNG bytes unchanged at original 2048px, SVG lossless PNG at 3072px, alpha=0 in transparent corners and alpha=255 in artwork, no white logo containers, sequential automatic persistence, no page errors; storage and database mocked');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
