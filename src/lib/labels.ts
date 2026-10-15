import type { Tone } from '@/components/ui'
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
  completed: 'مكتمل',
  cancelled: 'ملغى',
}

export const projectStatusTone: Record<Enums<'project_status'>, Tone> = {
  planned: 'blue',
  active: 'green',
  on_hold: 'amber',
  completed: 'neutral',
  cancelled: 'red',
}

export const phaseStatusLabels: Record<Enums<'phase_status'>, string> = {
  planned: 'مخططة',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
  on_hold: 'متوقفة',
}

export const phaseStatusTone: Record<Enums<'phase_status'>, Tone> = {
  planned: 'blue',
  in_progress: 'green',
  completed: 'neutral',
  on_hold: 'amber',
}

export const contractStatusLabels: Record<Enums<'contract_status'>, string> = {
  draft: 'مسودة',
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغى',
}

export const contractStatusTone: Record<Enums<'contract_status'>, Tone> = {
  draft: 'neutral',
  active: 'green',
  completed: 'blue',
  cancelled: 'red',
}

export const budgetTypeLabels: Record<Enums<'budget_type'>, string> = {
  fixed: 'ثابتة (مقطوعية)',
  estimated: 'تقديرية (للتنبيه)',
}

export const supervisionModeLabels: Record<Enums<'supervision_mode'>, string> = {
  none: 'بلا أتعاب إشراف',
  fixed_amount: 'مبلغ ثابت',
  percentage: 'نسبة مئوية',
}

export const paymentMethodLabels: Record<Enums<'payment_method'>, string> = {
  cash: 'نقداً',
  bank_transfer: 'تحويل مصرفي',
  cheque: 'صك (شيك)',
  other: 'أخرى',
}

export const recordStatusLabels: Record<Enums<'record_status'>, string> = {
  posted: 'مرحّل',
  reversed: 'ملغى',
}

export const storageLabels: Record<Enums<'storage_provider'>, string> = {
  supabase: 'تخزين Supabase',
  google_drive: 'Google Drive',
}

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
}
