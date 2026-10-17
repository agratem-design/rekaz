import { useRef, useState } from 'react'
import { ExternalLink, Link2, Paperclip, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button, Field, Input } from './ui'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/fileUploads'

export function AttachmentField({value,onChange,folder,onBusyChange,disabled}: {value:string;onChange:(value:string)=>void;folder:string;onBusyChange:(busy:boolean)=>void;disabled?:boolean}) {
  const input=useRef<HTMLInputElement>(null)
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [showLink,setShowLink]=useState(false)
  const settings=useQuery({queryKey:['company_settings'],queryFn:async()=>{const r=await supabase.from('company_settings').select('*').single();if(r.error)throw r.error;return r.data}})
  const upload=async(file?:File)=>{
    if(!file || busy || disabled)return
    setError('');setBusy(true);onBusyChange(true)
    try {
      if(!settings.data)throw new Error('تعذر تحميل إعدادات حفظ الملفات؛ حاول فتح النموذج من جديد')
      const url=await uploadFile(file,settings.data,folder)
      onChange(url);setShowLink(false)
    }catch(e){setError(e instanceof Error?e.message:'تعذر رفع المرفق')}
    finally{setBusy(false);onBusyChange(false)}
  }
  return <section aria-label="مرفق المستند" className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">مرفق المستند</h3><p className="mt-1 text-xs leading-6 text-muted">{settings.data?.storage_provider==='google_drive'?'يُحفظ في Google Drive. يتيح سكريبت الرفع فتح الملف لمن لديه الرابط.':'يُحفظ الملف في مساحة التخزين المختارة في الإعدادات.'}</p></div><Button variant="secondary" loading={busy} disabled={disabled || settings.isLoading} onClick={()=>input.current?.click()}><Paperclip className="size-4" />{value?'تغيير المرفق':'رفع مرفق'}</Button></div>
    <input hidden ref={input} type="file" accept="image/*,.pdf" aria-label="ملف مرفق المستند" disabled={disabled || busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}} />
    {value && <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-medium text-olive-700 dark:text-olive-400">المرفق جاهز للحفظ مع المستند</span><a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><ExternalLink className="size-4" />عرض المرفق</a><Button variant="ghost" size="sm" disabled={disabled || busy} onClick={()=>onChange('')}><Trash2 className="size-4" />إزالة الارتباط</Button></div>}
    {error && <p role="alert" className="text-sm leading-7 text-red-700 dark:text-red-300">{error}</p>}
    <Button variant="ghost" size="sm" disabled={disabled || busy} aria-expanded={showLink} onClick={()=>setShowLink(!showLink)}><Link2 className="size-4" />{showLink?'إخفاء الرابط':'إدخال أو عرض رابط المرفق'}</Button>
    {showLink && <Field label="رابط المرفق"><Input type="url" dir="ltr" value={value} disabled={disabled || busy} onChange={e=>onChange(e.target.value)} placeholder="https://…" /></Field>}
  </section>
}
