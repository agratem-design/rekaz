import type { Enums } from './supabase'

export const roleLabels: Record<Enums<'app_role'>, string> = {
  admin: 'مدير',
  accountant: 'محاسب',
  engineer: 'مهندس',
  supervisor: 'مشرف',
}

export const domainLabels: Record<Enums<'treasury_domain'>, string> = {
  contracting: 'المقاولات',
  finishing: 'التشطيبات',
  general: 'عامة',
}

export const treasuryKindLabels: Record<Enums<'treasury_kind'>, string> = {
  cash: 'نقدية',
  bank: 'مصرفية',
}

export const rateUnitLabels: Record<Enums<'rate_unit'>, string> = {
  day: 'يومي',
  hour: 'بالساعة',
  meter: 'بالمتر',
  piece: 'بالقطعة',
  lump_sum: 'مقطوعية',
}

export const projectTypeLabels: Record<Enums<'project_type'>, string> = {
  contracting: 'مقاولات',
  finishing: 'تشطيبات',
}

export const projectStatusLabels: Record<Enums<'project_status'>, string> = {
  planned: 'مخطط',
  active: 'قيد التنفيذ',
  on_hold: 'متوقف',
  completed: 'منتهٍ',
  cancelled: 'ملغى',
}

export const storageLabels: Record<Enums<'storage_provider'>, string> = {
  supabase: 'تخزين Supabase',
  google_drive: 'Google Drive',
}

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
}
