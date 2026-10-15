import type { Tables } from '@/lib/supabase'

// إعدادات الطباعة تُحفظ في company_settings.print_settings بنفس مفاتيح النظام السابق الأساسية
export type PrintSettings = {
  print_section_title_color: string // لون العناوين والترويسة
  print_table_header_color: string // خلفية رأس الجدول
  print_header_text_color: string // نص رأس الجدول
  print_table_border_color: string
  print_totals_bg_color: string
  print_totals_text_color: string
  print_font_family: string
  print_table_font_size: number
  header_show_logo: boolean
  header_show_tagline: boolean
  header_show_contact: boolean
  contract_title_text: string
  contract_accent_color: string
  footer_note: string
}

export const printFonts = ['IBM Plex Sans Arabic', 'Readex Pro', 'Tajawal', 'Cairo', 'Almarai', 'Amiri']

export const defaultPrintSettings: PrintSettings = {
  print_section_title_color: '#134f42',
  print_table_header_color: '#134f42',
  print_header_text_color: '#ffffff',
  print_table_border_color: '#d6d2c6',
  print_totals_bg_color: '#f4ecda',
  print_totals_text_color: '#134f42',
  print_font_family: 'IBM Plex Sans Arabic',
  print_table_font_size: 10.5,
  header_show_logo: true,
  header_show_tagline: true,
  header_show_contact: true,
  contract_title_text: 'عقد مقاولة',
  contract_accent_color: '#b08f4f',
  footer_note: '',
}

export type Company = Tables<'company_settings'>

export function resolvePrintSettings(company: Company | null | undefined): PrintSettings {
  const raw = (company?.print_settings ?? {}) as Partial<PrintSettings>
  const out = { ...defaultPrintSettings }
  for (const k of Object.keys(defaultPrintSettings) as (keyof PrintSettings)[]) {
    const v = raw[k]
    if (v !== undefined && v !== null && v !== '') (out as Record<string, unknown>)[k] = v
  }
  return out
}

// تحميل خط الطباعة عند الحاجة من Google Fonts
export function ensurePrintFont(family: string) {
  if (family === 'IBM Plex Sans Arabic' || family === 'Readex Pro') return
  const id = `print-font-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;700&display=swap`
  document.head.appendChild(link)
}
