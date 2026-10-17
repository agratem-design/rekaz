import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { Button, Card, Checkbox, Field, Input, PageHeader, Select } from '@/components/ui'
import { businessCommand, useBusinessTable, useRefreshBusiness } from '@/lib/businessData'
import { useDraftState } from '@/lib/formDrafts'
import { newKey, usePhases, useProjectsFinancials, useTreasuriesWithBalance, useUnits } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'

type Column={key:string;label:string;required?:boolean;number?:boolean;reference?:'units'|'phases'|'treasuries'|'projects'|'warehouses'|'products';date?:boolean}
const definitions:Record<string,{label:string;action:string;columns:Column[]}>= {
 items:{label:'بنود المشروع',action:'import_items',columns:[{key:'name',label:'اسم البند',required:true},{key:'unit_id',label:'الوحدة',required:true,reference:'units'},{key:'quantity',label:'الكمية',required:true,number:true},{key:'unit_price',label:'سعر الوحدة',required:true,number:true},{key:'phase_id',label:'المرحلة',reference:'phases'}]},
 expenses:{label:'المصروفات النقدية',action:'import_expenses',columns:[{key:'description',label:'البيان',required:true},{key:'amount',label:'المبلغ',required:true,number:true},{key:'date',label:'التاريخ',required:true,date:true},{key:'treasury_id',label:'الخزينة',required:true,reference:'treasuries'},{key:'project_id',label:'المشروع',reference:'projects'},{key:'notes',label:'ملاحظات'}]},
 employees:{label:'الموظفون',action:'import_master',columns:[{key:'name',label:'الاسم',required:true},{key:'phone',label:'الهاتف'},{key:'base_salary',label:'الراتب الأساسي',required:true,number:true}]},
 clients:{label:'الزبائن',action:'import_master',columns:[{key:'name',label:'الاسم',required:true},{key:'phone',label:'الهاتف'}]},
 suppliers:{label:'الموردون',action:'import_master',columns:[{key:'name',label:'الاسم',required:true},{key:'phone',label:'الهاتف'}]},
 stock_products:{label:'المواد المخزنية',action:'import_master',columns:[{key:'code',label:'رمز المادة',required:true},{key:'name',label:'اسم المادة',required:true},{key:'unit_id',label:'الوحدة',required:true,reference:'units'},{key:'minimum_quantity',label:'حد التنبيه',number:true}]},
 stock:{label:'الأرصدة المخزنية الافتتاحية',action:'import_stock',columns:[{key:'product_id',label:'رمز المادة',reference:'products',required:true},{key:'warehouse_id',label:'المخزن',reference:'warehouses',required:true},{key:'quantity',label:'الكمية',number:true,required:true},{key:'unit_cost',label:'تكلفة الوحدة',number:true,required:true},{key:'date',label:'التاريخ',date:true,required:true}]},
}
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[\s_\-()]/g,'')
export function parseImportNumber(text:string){return Number(text.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٬,\s]/g,'').replace(/٫/g,'.'))}
export function ExcelImportPage(){
 const fileInput=useRef<HTMLInputElement>(null),refresh=useRefreshBusiness(),units=useUnits(),projects=useProjectsFinancials(),treasuries=useTreasuriesWithBalance(),warehouses=useBusinessTable('warehouses'),products=useBusinessTable('stock_products')
 const initial={target:'items',project_id:'',headers:[] as string[],rows:[] as string[][],mapping:{} as Record<string,string>,key:newKey(),filename:'',allowDuplicates:false}
 const draft=useDraftState('excel-import',initial),f=draft.value,definition=definitions[f.target]??definitions.items,phases=usePhases(f.project_id||undefined)
 const masters=useQuery({queryKey:['import_existing_names'],queryFn:async()=>{const [employees,clients,suppliers]=await Promise.all([supabase.from('employees').select('name'),supabase.from('clients').select('name'),supabase.from('suppliers').select('name')]);for(const result of [employees,clients,suppliers])if(result.error)throw result.error;return {employees:employees.data??[],clients:clients.data??[],suppliers:suppliers.data??[]}}})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sheetNames,setSheetNames]=useState<string[]>([]),[sheet,setSheet]=useState(''),workbook=useRef<import('exceljs').Workbook|null>(null)
 const mapSheet=(name:string)=>{
  const ws=workbook.current?.getWorksheet(name);if(!ws)return
  if(ws.rowCount>1001)throw new Error('الحد الأقصى 1000 سطر بيانات في الاستيراد الواحد')
  const text=(cell:import('exceljs').Cell)=>{
   if(cell.value instanceof Date)return cell.value.toISOString().slice(0,10)
   if(cell.type===6){const result=(cell.value as import('exceljs').CellFormulaValue).result;return result==null?'':String(result)}
   return cell.text.trim()
  }
  const headers:string[]=[];ws.getRow(1).eachCell({includeEmpty:true},(cell,index)=>{headers[index-1]=text(cell)||`عمود ${index}`})
  if(headers.length>40)throw new Error('الحد الأقصى 40 عمودًا؛ اختر ورقة البيانات فقط')
  const rows:string[][]=[];for(let n=2;n<=ws.rowCount;n++){const row=headers.map((_,i)=>text(ws.getCell(n,i+1)));if(row.some(v=>v!==''))rows.push(row)}
  const mapping=Object.fromEntries(definition.columns.map(c=>[c.key,String(headers.findIndex(h=>normalize(h)===normalize(c.label)||normalize(h)===normalize(c.key)))]))
  draft.setValue(p=>({...p,headers,rows,mapping,key:newKey()}));setSheet(name);setError('')
 }
 const read=async(file?:File)=>{
  if(!file)return
  if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024){setError('اختر ملف Excel بصيغة .xlsx لا يتجاوز 5 ميجابايت');return}
  setBusy(true);setError('')
  try{const {Workbook}=await import('exceljs');const wb=new Workbook();await wb.xlsx.load(await file.arrayBuffer());workbook.current=wb;if(!wb.worksheets.length)throw new Error('الملف لا يحتوي أوراق بيانات');setSheetNames(wb.worksheets.map(s=>s.name));draft.setValue(p=>({...p,filename:file.name}));mapSheet(wb.worksheets[0].name)}catch(e){setError(errorMessage(e))}finally{setBusy(false);if(fileInput.current)fileInput.current.value=''}
 }
 const referenceData={units:units.data?.map(u=>({id:u.id,names:[u.name,u.symbol]})),phases:phases.data?.map(p=>({id:p.id,names:[p.name,p.reference_number??'']})),projects:projects.data?.map(p=>({id:p.id,names:[p.name]})),treasuries:treasuries.data?.filter(t=>t.is_active).map(t=>({id:t.id,names:[t.name]})),warehouses:warehouses.data?.filter(w=>w.is_active).map(w=>({id:w.id,names:[w.name]})),products:products.data?.filter(p=>p.is_active).map(p=>({id:p.id,names:[p.code,p.name]}))}
 const preview=useMemo(()=>{
  const seen=new Set<string>()
  const existing=f.target==='employees'||f.target==='clients'||f.target==='suppliers'?masters.data?.[f.target]:undefined
  return f.rows.map((row,index)=>{
   const data:Record<string,string|number>={},issues:string[]=[]
   for(const c of definition.columns){const col=Number(f.mapping[c.key]??-1),value=col>=0?(row[col]??'').trim():''
    if(c.required&&!value)issues.push(`${c.label}: مطلوب`)
    if(c.reference&&value){const matches=(referenceData[c.reference]??[]).filter(r=>r.id===value||r.names.some(n=>normalize(n)===normalize(value)));if(matches.length!==1)issues.push(`${c.label}: ${matches.length?'اسم متكرر؛ استخدم المعرّف':'غير موجود في المنظومة'}`);data[c.key]=matches[0]?.id??''}
    else if(c.number){const n=value?parseImportNumber(value):0;if(!Number.isFinite(n)||n<0||(c.key==='quantity'&&n<=0)||(c.key==='amount'&&n<=0))issues.push(`${c.label}: قيمة غير صحيحة`);data[c.key]=n}
    else if(c.date){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))issues.push(`${c.label}: استخدم YYYY-MM-DD أو خلية تاريخ`);data[c.key]=value}
    else data[c.key]=value
   }
   if(existing?.some(e=>normalize(e.name)===normalize(String(data.name))))issues.push('الاسم مسجل مسبقًا؛ راجعه لتجنب التكرار')
   if(f.target==='stock_products'&&products.data?.some(p=>normalize(p.code)===normalize(String(data.code))))issues.push('رمز المادة مسجل مسبقًا')
   const signature=JSON.stringify(data);if(seen.has(signature)&&!f.allowDuplicates)issues.push('سطر مطابق لسطر سابق؛ راجع التكرار');seen.add(signature)
   return {index:index+2,row,data,issues}
  })
 // Reference lists are loaded asynchronously; a new preview is computed when they arrive.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[f,units.data,phases.data,projects.data,treasuries.data,warehouses.data,products.data,masters.data])
 const requiredMapping=definition.columns.some(c=>c.required&&Number(f.mapping[c.key]??-1)<0),errors=preview.filter(r=>r.issues.length).length
 const submit=async()=>{
  if(busy||!preview.length||errors||requiredMapping||(f.target==='items'&&!f.project_id))return
  setBusy(true);setError('')
  try{await businessCommand(definition.action,{target:f.target,project_id:f.project_id,lines:preview.map(r=>r.data)},f.key);draft.clear();draft.setValue({...initial,target:f.target,project_id:f.project_id,key:newKey()});refresh();masters.refetch();toast.success(`تم استيراد ${preview.length} سطرًا`)}catch(e){setError(`لم تُعتمد الدفعة: ${errorMessage(e)}. تُحفظ الدفعة كلها أو لا يُحفظ منها شيء.`)}finally{setBusy(false)}
 }
 const template=async()=>{setBusy(true);try{const {Workbook}=await import('exceljs');const wb=new Workbook(),ws=wb.addWorksheet('إدخال',{views:[{rightToLeft:true}]});ws.addRow(definition.columns.map(c=>c.label));ws.getRow(1).font={bold:true};ws.columns.forEach(c=>{c.width=25});const bytes=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`قالب ${definition.label}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 return <div dir="rtl" className="space-y-5"><PageHeader title="استيراد من Excel" description="اختر النوع، ارفع الملف، طابق الأعمدة، وراجع كل سطر قبل اعتماد الدفعة. لا تُسجّل بيانات بمجرد رفع الملف."/>
  <Card><div className="grid gap-4 sm:grid-cols-2"><Field label="نوع البيانات"><Select disabled={busy} value={f.target} onChange={e=>{draft.setValue(p=>({...p,target:e.target.value,mapping:{},key:newKey()}));setError('')}}>{Object.entries(definitions).map(([key,d])=><option key={key} value={key}>{d.label}</option>)}</Select></Field>{f.target==='items'&&<Field label="المشروع المستهدف" required><Select value={f.project_id} onChange={e=>draft.setValue(p=>({...p,project_id:e.target.value,key:newKey()}))}><option value="">اختر المشروع</option>{projects.data?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}</div><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" loading={busy} onClick={template}><Download className="size-4"/>تنزيل قالب Excel</Button><Button loading={busy} onClick={()=>fileInput.current?.click()}><Upload className="size-4"/>اختيار ملف</Button><Button variant="ghost" disabled={busy} onClick={()=>{draft.clear();draft.setValue({...initial,key:newKey()});setError('')}}>مسح الاستيراد والمسودة</Button></div><Input ref={fileInput} type="file" accept=".xlsx" hidden aria-label="ملف Excel" onChange={e=>void read(e.target.files?.[0])}/><p className="mt-3 text-xs leading-6 text-muted">الملفات المدعومة .xlsx، حتى 5 ميجابايت و1000 سطر. احفظ الملفات القديمة .xls بصيغة .xlsx. تُحفظ البيانات المقروءة كمسودة على هذا الجهاز.</p></Card>
  {draft.restored&&<p role="status" className="text-sm text-muted">استُعيدت مسودة الاستيراد؛ راجع البيانات قبل الاعتماد.</p>}{draft.storageError&&<p role="alert" className="text-red-600">تعذر حفظ مسودة الملف؛ لا تغلق الصفحة.</p>}
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-4 text-sm text-red-600">{error}</p>}
  {f.headers.length>0&&<><Card><p className="mb-4 flex items-center gap-2 text-sm"><FileSpreadsheet className="size-4"/>{f.filename} — {f.rows.length} سطرًا</p>{sheetNames.length>1&&<Field label="ورقة البيانات"><Select value={sheet} onChange={e=>{try{mapSheet(e.target.value)}catch(error){setError(errorMessage(error))}}}>{sheetNames.map(name=><option key={name}>{name}</option>)}</Select></Field>}<div className="mt-4 grid gap-4 sm:grid-cols-3">{definition.columns.map(c=><Field key={c.key} label={c.label} required={c.required}><Select value={f.mapping[c.key]??'-1'} onChange={e=>draft.setValue(p=>({...p,mapping:{...p.mapping,[c.key]:e.target.value},key:newKey()}))}><option value="-1">غير مرتبط</option>{f.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</Select></Field>)}</div><div className="mt-4"><Checkbox label="السماح بأسطر متطابقة بعد مراجعتها" checked={f.allowDuplicates} onChange={allowDuplicates=>draft.setValue(p=>({...p,allowDuplicates,key:newKey()}))}/></div></Card>
   <DataTable rows={preview} getKey={r=>String(r.index)} rowClassName={r=>r.issues.length>0&&'bg-red-500/5'} columns={[{key:'row',label:'سطر Excel',render:r=>r.index},...definition.columns.map(c=>({key:c.key,label:c.label,render:(r:typeof preview[number])=>r.row[Number(f.mapping[c.key]??-1)]??'—'})),{key:'issues',label:'المراجعة',render:r=>r.issues.length?<span className="text-red-600">{r.issues.join('؛ ')}</span>:'صالح'}]}/>
   <Card><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{preview.length-errors} سطر صالح، {errors} به أخطاء. {requiredMapping&&'أكمل ربط الأعمدة المطلوبة.'}</p><Button loading={busy} disabled={!preview.length||errors>0||requiredMapping||(f.target==='items'&&!f.project_id)} onClick={submit}>اعتماد استيراد {preview.length} سطرًا</Button></div></Card>
  </>}
 </div>
}
