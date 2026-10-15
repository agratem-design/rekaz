const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

export function formatMoney(v: number | null | undefined): string {
  return money.format(Number(v ?? 0) || 0) // || 0 يحوّل -0 إلى 0
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB')
}

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

// تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي (لا UTC، حتى لا يتأخر يوماً بعد منتصف الليل)
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayLong(): string {
  return new Intl.DateTimeFormat('ar-LY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
}

export function percent(v: number | null | undefined, digits = 0): string {
  return `${Number(v ?? 0).toFixed(digits)}%`
}
