import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const DEFAULT_SUPABASE_URL = 'https://bpnhzaexmqruzaxyzlyc.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || DEFAULT_SUPABASE_KEY

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
