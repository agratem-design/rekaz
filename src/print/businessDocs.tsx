import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import { Money, NumberWithUnit } from '@/components/ui'
import { AmountBox, InfoGrid, PrintDocument, PrintTable, Signatures } from './PrintDocument'
import type { Loader } from './financeDocs'

const cancelled=(s:{status:string;reversal_reason:string|null})=>s.status==='reversed'?{reason:s.reversal_reason}:null
const ref=(id:string)=>id.slice(0,8).toUpperCase()
export const businessLoaders:Record<string,Loader>={
 'payroll-slip':async(id)=>{
  const r=await supabase.from('payroll_balances').select('*').eq('id',id).single();if(r.error)throw r.error;const s=r.data
  const e=await supabase.from('employees').select('name').eq('id',s.employee_id).single();if(e.error)throw e.error
  return {title:'قسيمة راتب',number:ref(id),render:(company,settings)=><PrintDocument company={company} settings={settings} title="قسيمة راتب" number={ref(id)} date={formatDate(s.period)} cancelled={cancelled(s)}>
   <InfoGrid items={[{label:'الموظف',value:e.data.name},{label:'شهر الاستحقاق',value:s.period.slice(0,7)}]}/>
   <PrintTable columns={[{label:'البيان',render:(r:[string,number])=>r[0]},{label:'القيمة',align:'end',render:r=><Money value={r[1]}/>}]} rows={[["الراتب الأساسي",s.base_salary],["البدلات",s.allowances],["الاستقطاعات",s.deductions],["استرداد السلفة",s.advance_deduction],["المدفوع",s.paid],["المتبقي للصرف",s.remaining]]}/>
   <AmountBox amount={s.net_amount} label="صافي الراتب"/><p className="pd-small">القسيمة بيان استحقاق، وليست إثباتًا لصرف كامل الصافي. المدفوع موضح أعلاه.</p><Signatures items={[{label:'الموظف',name:e.data.name}]}/>
  </PrintDocument>}
 },
 'payroll-payment':async(id)=>{
  const r=await supabase.from('payroll_payments').select('*').eq('id',id).single();if(r.error)throw r.error;const p=r.data
  const slip=await supabase.from('payroll_slips').select('*').eq('id',p.slip_id).single();if(slip.error)throw slip.error
  const e=await supabase.from('employees').select('name').eq('id',slip.data.employee_id).single();if(e.error)throw e.error
  const t=await supabase.from('treasuries').select('name').eq('id',p.treasury_id).single();if(t.error)throw t.error
  return {title:'سند صرف راتب',number:ref(id),render:(company,settings)=><PrintDocument company={company} settings={settings} title="سند صرف راتب" number={ref(id)} date={formatDate(p.payment_date)} cancelled={cancelled(p)} compact><InfoGrid items={[{label:'المستلم',value:e.data.name},{label:'راتب شهر',value:slip.data.period.slice(0,7)},{label:'الخزينة',value:t.data.name},{label:'البيان',value:p.notes}]}/><AmountBox amount={p.amount}/><Signatures items={[{label:'المستلم',name:e.data.name}]}/></PrintDocument>}
 },
 'employee-advance':async(id)=>{
  const r=await supabase.from('employee_advances').select('*').eq('id',id).single();if(r.error)throw r.error;const a=r.data
  const e=await supabase.from('employees').select('name').eq('id',a.employee_id).single();if(e.error)throw e.error
  const title=a.kind==='repayment'?'سند رد سلفة موظف':a.kind==='opening'?'بيان سلفة سابقة':'سند صرف سلفة موظف'
  return {title,number:ref(id),render:(company,settings)=><PrintDocument company={company} settings={settings} title={title} number={ref(id)} date={formatDate(a.entry_date)} cancelled={cancelled(a)} compact><InfoGrid items={[{label:'الموظف',value:e.data.name},{label:'البيان',value:a.notes}]}/><AmountBox amount={a.amount}/><Signatures items={[{label:'الموظف',name:e.data.name}]}/></PrintDocument>}
 },
 'equipment-rental':async(id)=>{
  const r=await supabase.from('equipment_rentals').select('*').eq('id',id).single();if(r.error)throw r.error;const a=r.data
  const [e,p,s]=await Promise.all([supabase.from('equipment').select('*').eq('id',a.equipment_id).single(),supabase.from('projects').select('name').eq('id',a.project_id).single(),a.supplier_id?supabase.from('suppliers').select('name').eq('id',a.supplier_id).single():Promise.resolve({data:null,error:null})]);for(const result of [e,p,s])if(result.error)throw result.error
  return {title:'بيان استخدام وإيجار معدة',number:ref(id),render:(company,settings)=><PrintDocument company={company} settings={settings} title="بيان استخدام وإيجار معدة" number={ref(id)} date={a.start_date} cancelled={cancelled(a)}><InfoGrid items={[{label:'المعدة',value:e.data?.name},{label:'المشروع',value:p.data?.name},{label:'المورد',value:s.data?.name??'معدة مملوكة'},{label:'من',value:formatDate(a.start_date)},{label:'إلى',value:formatDate(a.end_date)},{label:'تاريخ الإرجاع',value:a.returned_on?formatDate(a.returned_on):'لم تُرجع'},{label:'العدد',value:a.quantity},{label:'اليومي',value:<Money value={a.daily_rate}/>}]}/><AmountBox amount={a.agreed_amount} label="القيمة المتفق عليها"/><p className="pd-small">السداد مرتبط بفاتورة المورد؛ هذا البيان لا يثبت سداد الإيجار.</p><Signatures items={[{label:'مسؤول الاستلام'}]}/></PrintDocument>}
 },
 'stock-movement':async(id)=>{
  const r=await supabase.from('stock_movements').select('*').eq('id',id).single();if(r.error)throw r.error;const m=r.data
  const [p,w]=await Promise.all([supabase.from('stock_products').select('*').eq('id',m.product_id).single(),supabase.from('warehouses').select('*')]);if(p.error)throw p.error;if(w.error)throw w.error
  const labels:Record<string,string>={opening:'رصيد افتتاحي',receipt:'استلام مواد',issue:'صرف مواد للمشروع',return:'مرتجع مواد',transfer:'تحويل مخزني',count_in:'زيادة جرد',count_out:'عجز جرد'}
  return {title:labels[m.kind],number:ref(id),render:(company,settings)=><PrintDocument company={company} settings={settings} title={labels[m.kind]} number={ref(id)} date={m.movement_date} cancelled={cancelled(m)}><InfoGrid items={[{label:'المادة',value:p.data.name},{label:'رمز المادة',value:p.data.code},{label:'المخزن',value:w.data.find(x=>x.id===m.warehouse_id)?.name},{label:'المخزن المستلم',value:w.data.find(x=>x.id===m.target_warehouse_id)?.name},{label:'الكمية',value:<NumberWithUnit value={m.quantity}/>},{label:'تكلفة الوحدة',value:<Money value={m.unit_cost}/>},{label:'البيان',value:m.notes}]}/><AmountBox amount={m.total_cost} label="قيمة المواد"/><Signatures items={[{label:'أمين المخزن'},{label:'المستلم'}]}/></PrintDocument>}
 },
 'stock-report':async()=>{
  const [b,p,w,u]=await Promise.all([supabase.from('stock_balances').select('*'),supabase.from('stock_products').select('*'),supabase.from('warehouses').select('*'),supabase.from('measurement_units').select('*')]);for(const r of [b,p,w,u])if(r.error)throw r.error
  return {title:'أرصدة المخازن',render:(company,settings)=><PrintDocument company={company} settings={settings} title="أرصدة المخازن"><PrintTable rows={b.data??[]} columns={[{label:'المادة',render:r=>p.data?.find(x=>x.id===r.product_id)?.name},{label:'المخزن',render:r=>w.data?.find(x=>x.id===r.warehouse_id)?.name},{label:'الكمية',render:r=><NumberWithUnit value={r.quantity} unit={u.data?.find(x=>x.id===p.data?.find(y=>y.id===r.product_id)?.unit_id)?.symbol}/>},{label:'القيمة',align:'end',render:r=><Money value={r.value}/>}]} totals={[{label:'إجمالي قيمة المخزون',value:<Money value={b.data?.reduce((s,r)=>s+Number(r.value),0)}/>}]}/></PrintDocument>}
 },
}
