import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { BusinessForm, type BusinessField } from '@/components/BusinessForm'
import { SidePanel } from '@/components/SidePanel'
import { EntryCard } from '@/components/EntryWorkspace'
import { ReverseButton } from '@/components/pickers'
import { Button, Card, Checkbox, ErrorState, Field, Input, Money, PageHeader, Select, StatCard, Tabs } from '@/components/ui'
import { businessCommand, useBusinessTable, useRefreshBusiness } from '@/lib/businessData'
import { useDraftState } from '@/lib/formDrafts'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { formatDate, todayISO } from '@/lib/format'
import { openPrint } from '@/print/open'

type Dialog = { action:string;title:string;initial:Record<string,string>;fields:BusinessField[];scope?:string }
const dateField:BusinessField={key:'date',label:'التاريخ',type:'date',required:true}
const notesField:BusinessField={key:'notes',label:'البيان والملاحظات',type:'notes'}
export function PayrollPage({employeeId}: {employeeId?:string}) {
 const employees=useQuery({queryKey:['employees'],queryFn:async()=>{const r=await supabase.from('employees').select('*').order('name');if(r.error)throw r.error;return r.data}})
 const slips=useBusinessTable('payroll_balances'),advances=useBusinessTable('employee_advances'),balances=useBusinessTable('employee_advance_balances'),payments=useBusinessTable('payroll_payments')
 const [tab,setTab]=useState('slips'),[month,setMonth]=useState(todayISO().slice(0,7)),[generating,setGenerating]=useState(false),[dialog,setDialog]=useState<Dialog|null>(null),[busy,setBusy]=useState(false)
 const refresh=useRefreshBusiness(),names=new Map(employees.data?.map(e=>[e.id,e.name]))
 const rows=(slips.data??[]).filter(s=>(!employeeId||s.employee_id===employeeId)&&s.period.startsWith(month)).sort((a,b)=>a.period.localeCompare(b.period))
 const active=rows.filter(s=>s.status==='posted'),advanceRows=(advances.data??[]).filter(a=>!employeeId||a.employee_id===employeeId).sort((a,b)=>b.entry_date.localeCompare(a.entry_date))
 const paymentRows=(payments.data??[]).filter(p=>!employeeId||(slips.data??[]).some(s=>s.id===p.slip_id&&s.employee_id===employeeId)).sort((a,b)=>b.payment_date.localeCompare(a.payment_date))
 const outstanding=(balances.data??[]).filter(b=>!employeeId||b.employee_id===employeeId).reduce((s,b)=>s+Number(b.remaining),0)
 const reverse=async(action:string,id:string,reason:string)=>{if(busy)return;setBusy(true);try{await businessCommand(action,{id,reason,date:todayISO()},newKey());refresh();toast.success('تم الإلغاء بقيد عكسي')}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 const advance=()=>setDialog({action:'employee_advance',title:'سلفة موظف أو رد سلفة',scope:employeeId,initial:{employee_id:employeeId??'',kind:'advance',amount:'',treasury_id:'',date:todayISO(),notes:''},fields:[{key:'employee_id',label:'الموظف',type:'select',required:true,options:(employees.data??[]).filter(e=>e.is_active).map(e=>({value:e.id,label:`${e.name} — سلفة متبقية ${balances.data?.find(b=>b.employee_id===e.id)?.remaining??0}`}))},{key:'kind',label:'نوع الحركة',type:'select',required:true,options:[{value:'advance',label:'صرف سلفة من الخزينة'},{value:'repayment',label:'رد سلفة إلى الخزينة'}]},{key:'amount',label:'المبلغ',type:'number',required:true,min:0.001},{key:'treasury_id',label:'الخزينة',type:'treasury',required:true},dateField,notesField]})
 const error=employees.error??slips.error??advances.error??payments.error
 if(error)return <ErrorState message={`تعذر تحميل الرواتب: ${errorMessage(error)}`} onRetry={()=>{employees.refetch();refresh()}}/>
 return <div dir="rtl" className="space-y-5">
  <PageHeader title={employeeId?'رواتب الموظف وسلفه':'الرواتب والسلف'} description="اعتماد المستحقات أولاً، ثم صرف الصافي جزئيًا أو كاملًا من الخزينة. استقطاع السلفة يخفض رصيدها دون حركة نقدية جديدة." actions={<><Button variant="secondary" disabled={busy||employees.isLoading} onClick={advance}><Plus className="size-4"/>سلفة أو رد</Button><Button disabled={employees.isLoading} onClick={()=>setGenerating(true)}><Plus className="size-4"/>إنشاء مسير رواتب</Button></>}/>
  <div className="grid gap-3 sm:grid-cols-3"><StatCard icon={Briefcase} label="صافي رواتب الشهر" value={<Money value={active.reduce((s,r)=>s+Number(r.net_amount),0)}/>}/><StatCard icon={Briefcase} label="المتبقي للصرف" value={<Money value={active.reduce((s,r)=>s+Number(r.remaining),0)}/>}/><StatCard icon={Briefcase} label="السلف المتبقية" value={<Money value={outstanding}/>}/></div>
  <Card><div className="flex flex-wrap items-end gap-4"><Field label="شهر الرواتب"><Input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></Field><p className="text-sm leading-7 text-muted">المستحق = الأساسي + البدلات − الاستقطاعات − خصم السلفة. لا يُخصم شيء من الخزينة حتى تسجل دفعة.</p></div></Card>
  <Tabs active={tab} onChange={setTab} items={[{key:'slips',label:'قسائم الرواتب'},{key:'advances',label:'السلف وتسوياتها'},{key:'payments',label:'دفعات الرواتب'}]}/>
  {tab==='slips'&&<DataTable rows={rows} getKey={s=>s.id} loading={slips.isLoading} rowClassName={s=>s.status==='reversed'&&'line-through text-faint'} columns={[
   {key:'name',label:'الموظف',render:s=>names.get(s.employee_id)},{key:'period',label:'الشهر',render:s=>s.period.slice(0,7)},
   {key:'gross',label:'الأساسي والبدلات',align:'end',render:s=><Money value={Number(s.base_salary)+Number(s.allowances)}/>},{key:'deduction',label:'الاستقطاعات / السلفة',render:s=><span><Money value={s.deductions}/> / <Money value={s.advance_deduction}/></span>},
   {key:'net',label:'الصافي',align:'end',render:s=><Money value={s.net_amount}/>},{key:'paid',label:'المدفوع',align:'end',render:s=><Money value={s.paid}/>},{key:'remaining',label:'المتبقي',align:'end',render:s=><Money value={s.remaining}/>}
  ]} rowActions={s=><><Button variant="ghost" size="icon" aria-label="طباعة قسيمة الراتب" onClick={()=>openPrint('payroll-slip',s.id)}><Printer className="size-4"/></Button>{s.status==='posted'&&<><Button size="sm" disabled={Number(s.remaining)<=0} onClick={()=>setDialog({action:'payroll_payment',title:'صرف راتب',scope:s.id,initial:{slip_id:s.id,amount:String(s.remaining),treasury_id:'',date:todayISO(),notes:''},fields:[{key:'amount',label:'المبلغ المدفوع',type:'number',required:true,min:0.001},{key:'treasury_id',label:'الخزينة المخصوم منها',type:'treasury',required:true},dateField,notesField]})}>صرف</Button><ReverseButton title="إلغاء قسيمة الراتب؟" onReverse={reason=>reverse('reverse_payroll_slip',s.id,reason)}/></>}</>}/>}
  {tab==='advances'&&<><Card><div className="flex flex-wrap gap-5">{(balances.data??[]).filter(b=>(!employeeId||b.employee_id===employeeId)&&Number(b.remaining)!==0).map(b=><div key={b.employee_id}><span className="text-sm text-muted">{names.get(b.employee_id)}</span><Money value={b.remaining} className="ms-3 font-semibold"/></div>)}</div></Card><DataTable rows={advanceRows} getKey={a=>a.id} columns={[{key:'employee',label:'الموظف',render:a=>names.get(a.employee_id)},{key:'date',label:'التاريخ',render:a=>formatDate(a.entry_date)},{key:'kind',label:'الحركة',render:a=>({advance:'صرف سلفة',repayment:'رد سلفة',opening:'رصيد سابق'}[a.kind])},{key:'amount',label:'المبلغ',render:a=><Money value={a.amount}/>},{key:'notes',label:'البيان',render:a=>a.notes},{key:'status',label:'الحالة',render:a=>a.status==='posted'?'سارية':'ملغاة'}]} rowActions={a=>a.status==='posted'&&<ReverseButton title="إلغاء حركة السلفة؟" onReverse={reason=>reverse('reverse_employee_advance',a.id,reason)}/>}/></>}
  {tab==='payments'&&<DataTable rows={paymentRows} getKey={p=>p.id} columns={[{key:'employee',label:'الموظف',render:p=>names.get(slips.data?.find(s=>s.id===p.slip_id)?.employee_id??'')},{key:'date',label:'التاريخ',render:p=>formatDate(p.payment_date)},{key:'amount',label:'المبلغ',render:p=><Money value={p.amount}/>},{key:'status',label:'الحالة',render:p=>p.status==='posted'?'سارية':'ملغاة'}]} rowActions={p=><><Button variant="ghost" size="icon" aria-label="طباعة سند الراتب" onClick={()=>openPrint('payroll-payment',p.id)}><Printer className="size-4"/></Button>{p.status==='posted'&&<ReverseButton title="إلغاء صرف الراتب؟" onReverse={reason=>reverse('reverse_payroll_payment',p.id,reason)}/>}</>}/>}
  {dialog&&<BusinessForm key={dialog.action+(dialog.scope??'')} {...dialog} onClose={()=>setDialog(null)}/>}
  {generating&&<PayrollRunForm month={month} employees={(employees.data??[]).filter(e=>e.is_active&&(!employeeId||e.id===employeeId))} onClose={()=>setGenerating(false)}/>}
 </div>
}

function PayrollRunForm({month,employees,onClose}:{month:string;employees:{id:string;name:string;base_salary:number}[];onClose:()=>void}) {
 const projects=useProjectsFinancials(),refresh=useRefreshBusiness()
 const draft=useDraftState(`payroll-run:${month}`,{key:newKey(),period:month,project_id:'',lines:employees.map(e=>({employee_id:e.id,name:e.name,selected:true,base_salary:String(e.base_salary),allowances:'0',deductions:'0',advance_deduction:'0'}))})
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const f=draft.value
 const submit=async()=>{
  if(busy)return
  if(!f.period||!f.lines.some(l=>l.selected)){setError('حدد الشهر والموظفين');return}
  if(f.lines.filter(l=>l.selected).some(l=>[l.base_salary,l.allowances,l.deductions,l.advance_deduction].some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0))){setError('أكمل المبالغ بقيم صحيحة');return}
  setBusy(true);setError('')
  try{await businessCommand('payroll_run',{period:f.period+'-01',project_id:f.project_id,lines:f.lines.filter(l=>l.selected).map(({name,selected,...rest})=>{void name;void selected;return rest})},f.key);draft.clear();refresh();toast.success('تم اعتماد مسير الرواتب');onClose()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 return <SidePanel open workspace title="إنشاء مسير رواتب" description="راجع الأسماء والمبالغ؛ الاعتماد ينشئ القسائم، والصرف يتم لاحقًا من كل قسيمة." onClose={()=>{if(!busy)onClose()}} footer={<><Button loading={busy} onClick={submit}>اعتماد المسير</Button><Button variant="secondary" disabled={busy} onClick={onClose}>إغلاق وحفظ المسودة</Button><Button variant="ghost" disabled={busy} onClick={()=>{draft.clear();onClose()}}>حذف المسودة</Button></>}>
  <fieldset disabled={busy} className="space-y-5"><EntryCard title="الشهر وتحميل التكلفة"><div className="grid gap-4 sm:grid-cols-2"><Field label="شهر الراتب" required><Input type="month" value={f.period} onChange={e=>draft.setValue(p=>({...p,period:e.target.value}))}/></Field><Field label="المشروع (اختياري)" hint="بدون مشروع تُسجل الرواتب مصروفًا عامًا؛ السلفة لا تُحتسب تكلفة مرة ثانية."><Select value={f.project_id} onChange={e=>draft.setValue(p=>({...p,project_id:e.target.value}))}><option value="">مصروف عام للشركة</option>{projects.data?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div></EntryCard>
   {draft.restored&&<p role="status" className="text-sm text-muted">استُعيدت مسودة المسير.</p>}{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
   {f.lines.map((line,index)=><EntryCard key={line.employee_id} title={line.name}><Checkbox label="تضمين في المسير" checked={line.selected} onChange={selected=>draft.setValue(p=>({...p,lines:p.lines.map((l,i)=>i===index?{...l,selected}:l)}))}/><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['base_salary','الراتب الأساسي'],['allowances','البدلات'],['deductions','الاستقطاعات'],['advance_deduction','خصم السلفة']] as const).map(([key,label])=><Field key={key} label={label}><Input dir="ltr" type="number" min={0} step="0.001" value={line[key]} onChange={e=>draft.setValue(p=>({...p,lines:p.lines.map((l,i)=>i===index?{...l,[key]:e.target.value}:l)}))}/></Field>)}</div><p className="text-sm">الصافي <Money value={Number(line.base_salary)+Number(line.allowances)-Number(line.deductions)-Number(line.advance_deduction)} className="font-semibold"/></p></EntryCard>)}
  </fieldset>
 </SidePanel>
}
