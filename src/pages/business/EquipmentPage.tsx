import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Printer, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { BusinessForm, type BusinessField } from '@/components/BusinessForm'
import { DataTable } from '@/components/DataTable'
import { ReverseButton } from '@/components/pickers'
import { Button, Card, ErrorState, Money, PageHeader, StatCard, Tabs } from '@/components/ui'
import { businessCommand, useBusinessTable, useRefreshBusiness } from '@/lib/businessData'
import { newKey, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { formatDate, todayISO } from '@/lib/format'
import { openPrint } from '@/print/open'
import type { Equipment } from '@/lib/businessTypes'

type FormSpec={action:string;title:string;initial:Record<string,string>;fields:BusinessField[];scope?:string;description?:string}
const notes:BusinessField={key:'notes',label:'ملاحظات',type:'notes'}
export function EquipmentPage() {
 const equipment=useBusinessTable('equipment'),rentals=useBusinessTable('equipment_rentals'),projects=useProjectsFinancials()
 const suppliers=useQuery({queryKey:['suppliers'],queryFn:async()=>{const r=await supabase.from('suppliers').select('*').order('name');if(r.error)throw r.error;return r.data}})
 const [tab,setTab]=useState('equipment'),[form,setForm]=useState<FormSpec|null>(null),[busy,setBusy]=useState(false),refresh=useRefreshBusiness()
 const names=new Map(equipment.data?.map(e=>[e.id,e.name])),projectNames=new Map(projects.data?.map(p=>[p.id,p.name]))
 const asset=(e?:Equipment)=>setForm({action:'equipment_save',scope:e?.id,title:e?'تعديل المعدة':'إضافة معدة',description:'سجل المعدات المملوكة والمستأجرة؛ الصيانة والإيقاف من حالة المعدة، ولا تحذف المعدات التي لها سجل.',initial:{id:e?.id??'',code:e?.code??'',name:e?.name??'',ownership:e?.ownership??'owned',status:e?.status??'available',daily_rate:String(e?.daily_rate??0),notes:e?.notes??''},fields:[{key:'code',label:'رمز المعدة',required:true},{key:'name',label:'اسم المعدة',required:true},{key:'ownership',label:'الملكية',type:'select',required:true,options:[{value:'owned',label:'مملوكة للشركة'},{value:'hired',label:'مستأجرة من مورد'}]},{key:'status',label:'الحالة',type:'select',required:true,options:[{value:'available',label:'متاحة'},{value:'maintenance',label:'تحت الصيانة'},{value:'inactive',label:'موقوفة'}]},{key:'daily_rate',label:'الإيجار اليومي الافتراضي',type:'number',required:true},notes]})
 const rental=()=>setForm({action:'equipment_rental',title:'تخصيص أو استئجار معدة',description:'الإيجار من مورد ينشئ فاتورة خدمة على المشروع دون سداد تلقائي. المعدات المملوكة تُسجل للاستخدام دون إيجار داخلي أو تكلفة مكررة. عدد الأيام يشمل البداية والنهاية.',initial:{equipment_id:'',project_id:'',supplier_id:'',start_date:todayISO(),end_date:todayISO(),quantity:'1',daily_rate:'0',date:todayISO(),notes:''},fields:[{key:'equipment_id',label:'المعدة',type:'select',required:true,options:equipment.data?.filter(e=>e.status==='available').map(e=>({value:e.id,label:`${e.name} — ${e.ownership==='owned'?'مملوكة':'مستأجرة'} — ${e.daily_rate} د.ل / يوم`}))},{key:'project_id',label:'المشروع',type:'select',required:true,options:projects.data?.map(p=>({value:p.id,label:p.name}))},{key:'supplier_id',label:'المورد (للمعدة المستأجرة)',type:'select',options:suppliers.data?.map(s=>({value:s.id,label:s.name}))},{key:'start_date',label:'بداية الاستخدام',type:'date',required:true},{key:'end_date',label:'نهاية الاتفاق',type:'date',required:true},{key:'quantity',label:'عدد المعدات',type:'number',required:true,min:0.001},{key:'daily_rate',label:'الإيجار اليومي المتفق عليه',type:'number',required:true},{key:'date',label:'تاريخ إثبات الفاتورة',type:'date',required:true},notes]})
 const reverse=async(id:string,reason:string)=>{if(busy)return;setBusy(true);try{await businessCommand('reverse_equipment_rental',{id,reason},newKey());refresh();toast.success('تم إلغاء العقد وفاتورته')}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 const error=equipment.error??rentals.error??projects.error??suppliers.error
 if(error)return <ErrorState message={errorMessage(error)} onRetry={()=>{refresh();projects.refetch();suppliers.refetch()}}/>
 return <div dir="rtl" className="space-y-5"><PageHeader title="المعدات وإيجاراتها" description="سجل المعدات، تخصيصها للمشاريع، مواعيد إرجاعها، وفواتير إيجارات الموردين." actions={<><Button variant="secondary" onClick={()=>asset()}><Plus className="size-4"/>إضافة معدة</Button><Button onClick={rental}><Plus className="size-4"/>استخدام أو إيجار</Button></>}/>
  <div className="grid gap-3 sm:grid-cols-3"><StatCard icon={Truck} label="عدد المعدات" value={equipment.data?.length??0}/><StatCard icon={Truck} label="عقود لم تُرجع" value={(rentals.data??[]).filter(r=>r.status==='posted'&&!r.returned_on).length}/><StatCard icon={Truck} label="قيمة الإيجارات السارية" value={<Money value={(rentals.data??[]).filter(r=>r.status==='posted').reduce((s,r)=>s+Number(r.agreed_amount),0)}/>}/></div>
  <Tabs active={tab} onChange={setTab} items={[{key:'equipment',label:'سجل المعدات'},{key:'rentals',label:'الاستخدام والإيجارات'}]}/>
  {tab==='equipment'?<DataTable rows={equipment.data} loading={equipment.isLoading} getKey={e=>e.id} columns={[{key:'code',label:'الرمز',render:e=>e.code},{key:'name',label:'المعدة',render:e=>e.name},{key:'ownership',label:'الملكية',render:e=>e.ownership==='owned'?'مملوكة':'مستأجرة'},{key:'status',label:'الحالة',render:e=>({available:'متاحة',maintenance:'صيانة',inactive:'موقوفة'}[e.status])},{key:'rate',label:'اليومي الافتراضي',render:e=><Money value={e.daily_rate}/>}]} rowActions={e=><Button variant="secondary" size="sm" onClick={()=>asset(e)}>تعديل</Button>}/>:<>
   <Card><p className="text-sm leading-7 text-muted">سداد الإيجار يتم من حساب المورد، ويدخل تكلفة المشروع مرة واحدة بفاتورة الخدمة. تسجيل الإرجاع يغلق الاستخدام ولا يغير المبلغ المتفق عليه؛ سجّل أي مدة إضافية بعقد إضافي.</p></Card>
   <DataTable rows={[...(rentals.data??[])].sort((a,b)=>b.start_date.localeCompare(a.start_date))} getKey={r=>r.id} rowClassName={r=>r.status==='reversed'&&'text-faint line-through'} columns={[{key:'equipment',label:'المعدة',render:r=>names.get(r.equipment_id)},{key:'project',label:'المشروع',render:r=>projectNames.get(r.project_id)},{key:'dates',label:'المدة',render:r=><span>{formatDate(r.start_date)} — {formatDate(r.end_date)}</span>},{key:'amount',label:'القيمة',render:r=><Money value={r.agreed_amount}/>},{key:'status',label:'الحالة',render:r=>r.status==='reversed'?'ملغى':r.returned_on?`أُرجعت ${formatDate(r.returned_on)}`:r.end_date<todayISO()?'متأخرة الإرجاع':'قيد الاستخدام'},{key:'invoice',label:'فاتورة المورد',render:r=>r.purchase_id?<Link className="text-accent underline" to="/purchases">فتح الفواتير</Link>:'استخدام داخلي'}]} rowActions={r=><><Button variant="ghost" size="icon" aria-label="طباعة عقد استخدام المعدة" onClick={()=>openPrint('equipment-rental',r.id)}><Printer className="size-4"/></Button>{r.status==='posted'&&<>{!r.returned_on&&<Button size="sm" onClick={()=>setForm({action:'equipment_return',title:'إرجاع المعدة',scope:r.id,initial:{id:r.id,date:todayISO()},fields:[{key:'date',label:'تاريخ الإرجاع الفعلي',type:'date',required:true}]})}>إرجاع</Button>}<ReverseButton title="إلغاء عقد المعدة؟" message="يلزم إلغاء سداد فاتورته أولاً إن وُجد." onReverse={reason=>reverse(r.id,reason)}/></>}</>}/>
  </>}
  {form&&<BusinessForm key={form.action+(form.scope??'')} {...form} onClose={()=>setForm(null)}/>}
 </div>
}

