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
  accountant_name: string
  accountant_position: 'hidden' | 'header' | 'footer'
  accountant_align: 'right' | 'center' | 'left'
}

export const printFonts = ['Tajawal', 'Cairo', 'Almarai', 'Amiri', 'Changa', 'IBM Plex Sans Arabic', 'Readex Pro']

// الافتراضي = هوية الطباعة في النظام السابق (ذهبي #B4A078 وعناوين #7A5A10 وخط Tajawal) — docs/old-print.md
export const defaultPrintSettings: PrintSettings = {
  print_section_title_color: '#7A5A10',
  print_table_header_color: '#B4A078',
  print_header_text_color: '#ffffff',
  print_table_border_color: '#c9bc9c',
  print_totals_bg_color: '#B4A078',
  print_totals_text_color: '#ffffff',
  print_font_family: 'Tajawal',
  print_table_font_size: 11,
  header_show_logo: true,
  header_show_tagline: true,
  header_show_contact: true,
  contract_title_text: 'عـقـد مـقـاولـة',
  contract_accent_color: '#c6973f',
  footer_note: '',
  accountant_name: '',
  accountant_position: 'footer',
  accountant_align: 'right',
}

export type Company = Tables<'company_settings'>

export function resolvePrintSettings(company: Company | null | undefined): PrintSettings {
  const raw = (company?.print_settings ?? {}) as Partial<PrintSettings>
  const out = { ...defaultPrintSettings }
  for (const k of Object.keys(defaultPrintSettings) as (keyof PrintSettings)[]) {
    const v = raw[k]
    if (v !== undefined && v !== null && v !== '') (out as Record<string, unknown>)[k] = v
  }
  out.accountant_name = typeof raw.accountant_name === 'string' ? raw.accountant_name.trim() : ''
  out.accountant_position = ['hidden', 'header', 'footer'].includes(String(raw.accountant_position)) ? raw.accountant_position as PrintSettings['accountant_position'] : defaultPrintSettings.accountant_position
  out.accountant_align = ['right', 'center', 'left'].includes(String(raw.accountant_align)) ? raw.accountant_align as PrintSettings['accountant_align'] : defaultPrintSettings.accountant_align
  return out
}

// تحميل خط الطباعة عند الحاجة من Google Fonts
export function ensurePrintFont(family: string) {
  if (family === 'IBM Plex Sans Arabic' || family === 'Readex Pro') return
  const id = `print-font-${family.replace(/\s+/g, '-')}`
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (existing) { if (existing.href !== href) existing.href = href; return }
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
