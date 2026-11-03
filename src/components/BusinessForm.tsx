import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { SidePanel } from './SidePanel'
import { EntryCard } from './EntryWorkspace'
import { TreasuryPicker } from './TreasuryPicker'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useDraftState } from '@/lib/formDrafts'
import { businessCommand, useRefreshBusiness } from '@/lib/businessData'
import { newKey } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { PrintOptions } from '@/pages/receipts/ReceiptForm'

export type BusinessField = { key:string; label:string; type?:'number'|'date'|'text'|'select'|'treasury'|'notes'; required?:boolean; options?:{value:string;label:string}[]; min?:number }
export function BusinessForm({title,description,action,initial,fields,scope,onClose,transform,printKind}: {
 title:string;description?:string;action:string;initial:Record<string,string>;fields:BusinessField[];scope?:string;onClose:()=>void;transform?:(v:Record<string,string>)=>object;printKind?:string
}) {
 const draft=useDraftState(`business:${action}:${scope??''}`,{values:initial,key:newKey()})
 const [busy,setBusy]=useState(false),[errors,setErrors]=useState<Record<string,string>>({}),[printed,setPrinted]=useState<string|null>(null)
 const submitting=useRef(false),refresh=useRefreshBusiness()
 const f=draft.value.values
 const submit=async()=>{
  if(submitting.current)return
  const next:Record<string,string>={}
  for(const field of fields){const v=f[field.key]??'';if(field.required&&!v.trim())next[field.key]='هذا الحقل مطلوب';if(field.type==='number'&&v!==''&&(!Number.isFinite(Number(v))||Number(v)<(field.min??0)))next[field.key]='أدخل قيمة صحيحة';if(field.type==='date'&&v&&!Number.isFinite(Date.parse(v)))next[field.key]='تاريخ غير صحيح'}
  setErrors(next);if(Object.keys(next).length)return
  submitting.current=true;setBusy(true)
  try {const id=await businessCommand(action,transform?transform(f):f,draft.value.key);draft.clear();refresh();toast.success('تم الحفظ');if(printKind&&typeof id==='string'){setPrinted(id);return}onClose()}
  catch(error){toast.error(`${errorMessage(error)} — المسودة محفوظة`)}
  finally{submitting.current=false;setBusy(false)}
 }
 if(printed&&printKind)return <PrintOptions kind={printKind} id={printed} title="تم الصرف" message="هل تريد طباعة سند الصرف الآن؟" onClose={onClose}/>
 return <SidePanel open workspace title={title} description={description} onClose={()=>{if(!busy)onClose()}} footer={<><Button loading={busy} onClick={submit}>حفظ</Button><Button variant="secondary" disabled={busy} onClick={onClose}>إغلاق وحفظ المسودة</Button><Button variant="ghost" disabled={busy} onClick={()=>{draft.clear();onClose()}}>حذف المسودة</Button></>}>
  <form onSubmit={e=>{e.preventDefault();void submit()}}><fieldset disabled={busy} className="mx-auto min-w-0 max-w-3xl space-y-4">
   {draft.restored&&<p role="status" className="rounded-lg bg-accent-soft p-3 text-sm">استُعيدت المسودة المحفوظة على هذا الجهاز.</p>}
   {draft.storageError&&<p role="alert" className="text-red-600">تعذر حفظ المسودة على هذا الجهاز؛ لا تغلق الصفحة قبل إكمال العملية.</p>}
   <EntryCard title={title}><div className="grid gap-4 sm:grid-cols-2">{fields.map(field=>{
    const set=(value:string)=>draft.setValue(p=>({...p,values:{...p.values,[field.key]:value}}))
    if(field.type==='treasury')return <div key={field.key} className="sm:col-span-2"><TreasuryPicker value={f[field.key]??''} onChange={set} label={field.label} required={field.required} error={errors[field.key]} need={f.kind==='repayment'?undefined:Number(f.amount)||undefined}/></div>
    return <Field key={field.key} label={field.label} required={field.required} error={errors[field.key]} className={field.type==='notes'?'sm:col-span-2':undefined}>{field.type==='select'?<Select value={f[field.key]??''} onChange={e=>set(e.target.value)}><option value="">اختر</option>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>:field.type==='notes'?<Textarea value={f[field.key]??''} onChange={e=>set(e.target.value)}/>:<Input type={field.type??'text'} dir={field.type==='number'?'ltr':undefined} inputMode={field.type==='number'?'decimal':undefined} min={field.min??0} step={field.type==='number'?'0.001':undefined} value={f[field.key]??''} onChange={e=>set(e.target.value)}/>}</Field>
   })}</div></EntryCard><button type="submit" hidden/>
  </fieldset></form>
 </SidePanel>
}
