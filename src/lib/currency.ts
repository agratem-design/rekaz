export function formatCurrencyLYD(amount: number): string {
  if (!Number.isFinite(amount)) return "0 د.ل";
  return new Intl.NumberFormat('ar-LY', { maximumFractionDigits: 0 }).format(amount) + ' د.ل';
}
