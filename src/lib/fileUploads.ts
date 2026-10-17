import { supabase } from './supabase'
import { newKey } from './queries'

export type UploadSettings = { storage_provider: 'google_drive' | 'supabase'; print_settings: unknown }
export function googleUploadUrl(settings: UploadSettings) {
  const raw = settings.print_settings as Record<string, unknown> | null
  return typeof raw?.google_drive_script_url === 'string' ? raw.google_drive_script_url.trim() : ''
}
export function validGoogleUploadUrl(value: string) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value.trim())
}
export function validImageUrl(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !url.hostname.endsWith('.')
  } catch { return false }
}
const encodedFile = (file: File) => new Promise<string>((resolve,reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = () => reject(new Error('تعذرت قراءة الملف؛ اختره من جديد'))
  reader.readAsDataURL(file)
})
export async function uploadFile(file: File, settings: UploadSettings, folder: string, fixedName?: string) {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('اختر ملفاً غير فارغ، بحجم لا يتجاوز 25 ميجابايت')
  const cleanName = [...file.name].map((c) => c.charCodeAt(0) < 32 || c === '/' || c === '\\' ? '-' : c).join('').slice(-150) || 'file'
  const name = fixedName ?? `${newKey()}-${cleanName}`
  if (settings.storage_provider === 'supabase') {
    const path = `${folder}/${name}`
    const { error } = await supabase.storage.from('images').upload(path,file,{upsert:Boolean(fixedName),contentType:file.type || undefined})
    if (error) throw new Error(`تعذر رفع الملف إلى مساحة التخزين: ${error.message}. راجع مكان الحفظ في الإعدادات.`)
    return `${supabase.storage.from('images').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  }
  const endpoint = googleUploadUrl(settings)
  if (!validGoogleUploadUrl(endpoint)) throw new Error('أكمل رابط سكريبت رفع Google Drive في الإعدادات ← الملفات، ثم احفظ الإعدادات')
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(),90_000)
  try {
    const response = await fetch(endpoint, {
      method:'POST', credentials:'omit', redirect:'follow', signal:controller.signal,
      // طلب بسيط: Apps Script لا يوفر مسار OPTIONS لقبول application/json من المتصفح.
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({file:await encodedFile(file),name,type:file.type || 'application/octet-stream',folder}),
    })
    if (!response.ok) throw new Error(`تعذر الاتصال بسكريبت الرفع (${response.status}). تحقق من نشر تطبيق الويب وصلاحية الوصول إليه.`)
    let result: {success?:boolean;saved?:boolean;error?:string;url?:string}
    try { result = await response.json() } catch { throw new Error('لم يُرجع سكريبت Google استجابة رفع صحيحة. تأكد من استخدام رابط /exec لسكريبت الرفع، وليس سكريبت التقويم.') }
    if (!result.success) throw new Error(result.error || (result.saved ? 'حُفظ الملف، لكن لم يتم تأكيد رابط المشاركة. راجع صلاحياته في Google Drive.' : 'لم يؤكد Google Drive حفظ الملف'))
    if (!result.url || !result.url.startsWith('https://') || !validImageUrl(result.url)) throw new Error('حُفظ الملف، لكن سكريبت الرفع أعاد رابطًا ناقصًا أو غير صالح للعرض')
    return `${result.url}${result.url.includes('?') ? '&' : '?'}v=${Date.now()}`
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('انتهت مهلة الرفع دون تأكيد النتيجة. راجع المجلد في Google Drive قبل إعادة المحاولة.')
    if (error instanceof TypeError) throw new Error('تعذر الاتصال بـ Google Drive. تحقق من الإنترنت ونشر السكريبت بإتاحة الوصول المناسبة، ثم أعد المحاولة.')
    throw error
  } finally { window.clearTimeout(timer) }
}
