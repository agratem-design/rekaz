import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) throw new Error('إعدادات الاتصال بقاعدة البيانات ناقصة (.env)')

export const supabase = createClient<Database>(url, key)

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
export type AppRole = Enums<'app_role'>

// أخطاء القاعدة تأتي برسائل عربية من الدوال؛ نعرضها كما هي، ونترجم الشائع من غيرها
export function errorMessage(e: unknown): string {
  const err = e as { message?: string; code?: string }
  if (err?.code === '42501') return 'ليست لديك صلاحية لهذه العملية'
  if (err?.code === '23505') return 'القيمة مسجلة مسبقاً'
  if (err?.code === '23503') return 'لا يمكن الحذف: السجل مرتبط بسجلات أخرى'
  if (err?.message === 'Invalid login credentials') return 'اسم المستخدم أو كلمة المرور غير صحيحة'
  return err?.message ?? 'حدث خطأ غير متوقع'
}
