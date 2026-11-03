import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ReverseButton, useRpc } from '@/components/pickers'
import { Badge, Button, EmptyState, Field, Input, Money, Select, Textarea } from '@/components/ui'
import { newKey } from '@/lib/queries'
import { formatDate, todayISO } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { openPrint } from '@/print/open'

export type InvoiceLine = { label: string; amount: number; party?: string; reference?: string; quantity?: number; unit?: string; rate?: number; detail?: string; method?: string; section?: string }
export const invoiceTypeLabels: Record<string, string> = { contracting: 'مقاولات', reimbursement: 'مصاريف مستردة', finishing: 'تشطيبات', opening_balance: 'رصيد سابق', service: 'خدمات وأتعاب', summary: 'ملخص مرجعي' }
export function useCustomerInvoices(filter: { projectId?: string; clientId?: string }) {
  return useQuery({
    queryKey: ['customer_invoices', filter.projectId ?? null, filter.clientId ?? null],
    queryFn: async () => {
      let q = supabase.from('customer_invoices').select('*, projects(name)').order('project_id').order('created_at')
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      if (filter.clientId) q = q.eq('client_id', filter.clientId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}
export function CustomerInvoices({ projectId, clientId }: { projectId?: string; clientId: string }) {
  const invoices = useCustomerInvoices({ projectId, clientId })
  const [adding, setAdding] = useState(false)
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_customer_invoice', { p_invoice_id: a.id, p_reason: a.reason }), { success: 'تم إلغاء الفاتورة', invalidate: ['customer_invoices', 'project', 'project_financials', 'client', 'dashboard'] })
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">فواتير الزبون والمطالبات</h2><p className="mt-1 text-sm leading-7 text-muted">الفواتير المصدرة تحدد استحقاق الزبون. الملخصات مرجع فقط؛ سلف العمال وحركات الخزينة تُسجل مستقلة.</p></div>{projectId && <Button onClick={() => setAdding(true)}><Plus className="size-4" />إصدار فاتورة</Button>}</div>
    <DataTable rows={invoices.data} getKey={(r) => r.id} loading={invoices.isLoading} error={invoices.error ? errorMessage(invoices.error) : null} onRetry={() => invoices.refetch()}
      empty={<EmptyState icon={FileText} title="لا توجد فواتير مصدرة بعد">حتى إصدار فاتورة، يبقى الاستحقاق التقديري من البنود أو العقود أو تكلفة التشطيبات.</EmptyState>}
      columns={[
        ...(!projectId ? [{ key: 'project', label: 'المشروع', render: (r: NonNullable<typeof invoices.data>[number]) => (r.project_id ? <Link to={`/projects/${r.project_id}/invoices`} className="font-medium hover:underline">{r.projects?.name}</Link> : <span className="text-muted">ملخص عام</span>) }] : []),
        { key: 'number', label: 'الرقم والتاريخ', render: (r) => <div><span className="num font-medium">{r.invoice_number ?? (r.source_filename ? 'بلا رقم في المصدر' : 'بدون رقم')}</span><p className="num mt-1 text-xs text-muted">{formatDate(r.invoice_date)}</p></div> },
        { key: 'title', label: 'المستند', render: (r) => <div><p className="font-medium">{r.title}</p><p className="mt-1 text-xs text-muted">{r.source_filename?.replace(/^\uFFFD+/, '')}</p></div> },
        { key: 'type', label: 'النوع', render: (r) => <Badge tone={r.document_type === 'summary' ? 'neutral' : 'brand'}>{invoiceTypeLabels[r.document_type]}</Badge> },
        { key: 'amount', label: 'القيمة', align: 'end', render: (r) => <Money value={r.amount} className={r.status === 'reversed' ? 'line-through' : 'font-semibold'} /> },
        { key: 'status', label: 'الحالة', render: (r) => <Badge tone={r.status === 'reversed' ? 'red' : 'green'}>{r.status === 'reversed' ? 'ملغى' : r.document_type === 'summary' ? 'مرجعي · بلا أثر مالي' : 'مُصدرة'}</Badge> },
      ]}
      rowActions={(r) => <><Button variant="ghost" size="icon" title="عرض وطباعة المستند" aria-label="عرض وطباعة المستند" onClick={() => openPrint('customer-invoice', r.id)}><Printer className="size-4" /></Button>{r.status === 'posted' && <ReverseButton title="إلغاء الفاتورة المصدرة؟" message="تُزال قيمتها من استحقاق الزبون. تبقى حركات السداد والتكاليف مستقلة وتحتاج تصحيحاً منفصلاً عند اللزوم." onReverse={(reason) => reverse.mutate({ id: r.id, reason })} />}</>}
    />
    {projectId && <InvoiceForm open={adding} onClose={() => setAdding(false)} projectId={projectId} clientId={clientId} />}
  </div>
}
function InvoiceForm({ open, onClose, projectId, clientId }: { open: boolean; onClose: () => void; projectId: string; clientId: string }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', number: '', date: todayISO(), kind: 'service', amount: '', fee: '0', notes: '' })
  const blankLine = () => ({ id: newKey(), label: '', quantity: '1', rate: '', unit: 'مقطوعية', party: '', reference: '' })
  const [lines, setLines] = useState(() => [blankLine()])
  const [key, setKey] = useState(newKey)
  useEffect(() => { if (open) { setLines([blankLine()]); setForm({ title: '', number: '', date: todayISO(), kind: 'service', amount: '', fee: '0', notes: '' }); setKey(newKey()); setError('') } }, [open])
  const updateLine = (id: string, patch: Partial<ReturnType<typeof blankLine>>) => setLines((all) => all.map((l) => l.id === id ? { ...l, ...patch } : l))
  const invoiceLines = lines.map((l) => ({ label: l.label.trim(), quantity: Number(l.quantity), rate: Number(l.rate), unit: l.unit.trim(), party: l.party.trim() || undefined, reference: l.reference.trim() || undefined, amount: Math.round(Number(l.quantity) * Number(l.rate) * 1000) / 1000 }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = Boolean(form.title || form.number || form.notes || form.fee !== '0' || form.date !== todayISO() || form.kind !== 'service' || lines.some((l) => l.label || l.rate || l.party || l.reference || l.quantity !== '1' || l.unit !== 'مقطوعية'))
  const amount = Math.round(invoiceLines.reduce((a,l) => a + (Number.isFinite(l.amount) ? l.amount : 0), 0) * 1000) / 1000, fee = Number(form.fee)
  const save = async () => {
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fee) || fee < 0 || fee > 100) { setError('أدخل البيان والمبلغ الصحيح ونسبة بين 0 و100'); return }
    if (invoiceLines.some((l,i) => !l.label || !lines[i].rate.trim() || !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.rate) || l.rate < 0 || !Number.isFinite(l.amount))) { setError('أكمل بيان وكمية وسعر كل بند؛ الكمية موجبة والسعر صفر أو أكثر'); return }
    setBusy(true)
    try {
      const { error: e } = await supabase.rpc('record_customer_invoice', { p_key: key, p_document: { client_id: clientId, project_id: projectId, source_key: `manual-${key}`, document_type: form.kind, title: form.title.trim(), invoice_number: form.number.trim() || null, invoice_date: form.date || null, fee_percentage: fee, lines: invoiceLines, notes: form.notes } as Json })
      if (e) throw e
      for (const k of ['customer_invoices', 'project', 'project_financials', 'client', 'dashboard']) qc.invalidateQueries({ queryKey: [k] })
      toast.success('تم إصدار الفاتورة وتحديث استحقاق الزبون')
      setKey(newKey()); setForm({ title: '', number: '', date: todayISO(), kind: 'service', amount: '', fee: '0', notes: '' }); setError(''); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <SidePanel open={open} title="إصدار فاتورة للزبون" description="استخدم هذا النموذج لفاتورة جديدة فقط. كل فاتورة تُضاف إلى مطالبات المشروع؛ لا تُعد إصدار بنود سبق إصدارها." size="xl" dirty={dirty} onClose={() => { if (!busy) onClose() }} footer={<><Button loading={busy} onClick={save}>إصدار الفاتورة</Button><Button variant="secondary" disabled={busy} onClick={async () => { if (await confirmDiscard(dirty)) onClose() }}>إلغاء</Button></>}>
    <Field label="بيان الفاتورة" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
    <Field label="نوع المطالبة"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(invoiceTypeLabels).filter(([k]) => k !== 'summary').map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
    <div className="grid grid-cols-2 gap-4"><Field label="رقم الفاتورة"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field><Field label="التاريخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field></div>
    <section className="space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">بنود الفاتورة</h3><Button variant="secondary" size="sm" onClick={() => setLines((all) => [...all, blankLine()])}><Plus className="size-4" />إضافة بند</Button></div>
      {lines.map((line,i) => <fieldset key={line.id} className="space-y-3 rounded-xl border border-line bg-surface-2 p-4"><legend className="px-2 text-sm font-semibold">البند {i+1}</legend>
        <div className="flex items-end gap-2"><Field label="بيان البند" required className="flex-1"><Input value={line.label} onChange={(e) => updateLine(line.id,{label:e.target.value})} /></Field><Button variant="ghost" size="icon" disabled={lines.length === 1} aria-label={`حذف البند ${i+1}`} onClick={() => setLines((all) => all.filter((l) => l.id !== line.id))}><Trash2 className="size-4" /></Button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="الكمية" required><Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(line.id,{quantity:e.target.value})} /></Field><Field label="الوحدة"><Input value={line.unit} onChange={(e) => updateLine(line.id,{unit:e.target.value})} /></Field><Field label="سعر الوحدة" required><Input type="number" min="0" step="0.001" value={line.rate} onChange={(e) => updateLine(line.id,{rate:e.target.value})} /></Field><div className="self-end rounded-lg bg-surface p-3"><div className="text-xs text-muted">إجمالي البند</div><Money value={invoiceLines[i].amount} /></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="المورد أو العامل (اختياري)"><Input value={line.party} onChange={(e) => updateLine(line.id,{party:e.target.value})} /></Field><Field label="مرجع البند (اختياري)"><Input value={line.reference} onChange={(e) => updateLine(line.id,{reference:e.target.value})} /></Field></div>
      </fieldset>)}
    </section>
    <div className="grid grid-cols-2 gap-4"><div className="self-end rounded-lg bg-surface-2 p-3"><div className="text-xs text-muted">مجموع البنود قبل الأتعاب</div><Money value={amount} /></div><Field label="أتعاب الشركة %"><Input type="number" min="0" max="100" step="0.001" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></Field></div>
    <div className="flex justify-between rounded-lg bg-accent-soft p-4"><span>إجمالي الفاتورة</span><Money value={Number.isFinite(amount + fee) ? Math.round(amount * (1 + fee / 100) * 1000) / 1000 : 0} /></div>
    <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </SidePanel>
}
