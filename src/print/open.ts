// يفتح مستند الطباعة في تبويب جديد (الجلسة محفوظة فلا يُطلب الدخول مجدداً)
export function openPrint(kind: 'receipt' | 'contract' | string, id: string, auto = false) {
  const base = `${window.location.origin}${window.location.pathname}`
  window.open(`${base}#/print/${kind}/${id}${auto ? '?auto=1' : ''}`, '_blank', 'noopener')
}
