const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

export function formatMoney(v: number | null | undefined): string {
  return money.format(Number(v ?? 0))
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB')
}
