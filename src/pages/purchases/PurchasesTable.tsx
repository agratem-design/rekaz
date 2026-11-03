import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Banknote, Paperclip, Printer, RotateCcw, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable, RecordCount } from '@/components/DataTable'
import { ReverseButton, useRpc } from '@/components/pickers'
import { Badge, Button, EmptyState, FilterChips, Money, SearchInput } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { SupplierPaymentForm } from '../suppliers/SupplierPaymentForm'
import { PurchaseForm } from './PurchaseForm'
import { purchaseKindLabels, purchaseKindTone, usePurchases, type PurchaseRow } from './purchaseData'

type Status = 'all' | 'open' | 'paid' | 'pending' | 'reversed'
type Kind = 'all' | 'material' | 'service' | 'return'

export function PurchasesTable({ phaseId, projectId, supplierId, onNew }: { phaseId?: string; projectId?: string; supplierId?: string; onNew?: () => void }) {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const { data, isLoading, error, refetch } = usePurchases({ projectId, supplierId })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [kind, setKind] = useState<Kind>('all')
  const [paying, setPaying] = useState<PurchaseRow | null>(null)
  const [returning, setReturning] = useState<PurchaseRow | null>(null)
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_purchase', { p_purchase_id: a.id, p_reason: a.reason }), { success: 'تم إلغاء الفاتورة' })
  const admin = hasRole('admin')
  const approve = useRpc((id: string) => supabase.rpc('approve_purchase', { p_purchase_id: id }), { success: 'تم اعتماد الفاتورة' })

  const all = (data ?? []).filter((r) => !phaseId || (phaseId === 'unassigned' ? !r.phase_id : r.phase_id === phaseId))
  const q = search.trim()
  const shown = all.filter((p) => {
    if (kind !== 'all' && p.kind !== kind) return false
    if (status === 'reversed') return p.status === 'reversed'
    if (status !== 'all' && p.status === 'reversed') return false
    if (status === 'open' && !(p.kind !== 'return' && p.remaining > 0)) return false
    if (status === 'paid' && !(p.kind === 'return' || p.remaining <= 0)) return false
    if (status === 'pending' && p.approved_at) return false
    return !q || (p.suppliers?.name ?? '').includes(q) || (p.description ?? '').includes(q) || (p.invoice_no ?? '').includes(q) || (p.projects?.name ?? '').includes(q)
  })
  const posted = shown.filter((p) => p.status === 'posted')
  const sign = (p: PurchaseRow) => (p.kind === 'return' ? -1 : 1)
  const total = posted.reduce((a, p) => a + sign(p) * Number(p.total_amount), 0)
  const remaining = posted.reduce((a, p) => a + p.remaining, 0)

  return (
    <>
      <DataTable
        rows={shown}
        getKey={(p) => p.id}
        loading={isLoading}
        error={error ? errorMessage(error) : null}
        onRetry={() => refetch()}
        rowClassName={(p) => p.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالمورد، العنوان، الرقم…" />
            <FilterChips
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'كل الأنواع' },
                { value: 'material', label: purchaseKindLabels.material },
                { value: 'service', label: purchaseKindLabels.service },
                { value: 'return', label: purchaseKindLabels.return },
              ]}
            />
            <FilterChips
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'open', label: 'مستحق' },
                { value: 'paid', label: 'مدفوع' },
                { value: 'pending', label: 'بانتظار الاعتماد' },
                { value: 'reversed', label: 'ملغى' },
              ]}
            />
            <div className="ms-auto flex items-center gap-3 text-xs text-muted">
              <span>
                الإجمالي <Money value={total} className="font-semibold text-ink" />
              </span>
              <span>
                المتبقي <Money value={remaining} className="font-semibold text-ink" />
              </span>
              <RecordCount shown={shown.length} total={all.length} />
            </div>
          </>
        }
        empty={
          <EmptyState icon={ShoppingCart} title={q || status !== 'all' || kind !== 'all' ? 'لا توجد فواتير مطابقة' : 'لا توجد مشتريات مضافة'} action={onNew && !q && finance && <Button onClick={onNew}>إضافة مشترى</Button>}>
            {!q && 'اضغط «إضافة مشترى» لتسجيل أول فاتورة.'}
          </EmptyState>
        }
        columns={[
          { key: 'date', label: 'التاريخ', render: (p) => <span className="num whitespace-nowrap text-muted">{formatDate(p.invoice_date)}</span> },
          { key: 'kind', label: 'النوع', render: (p) => <Badge tone={purchaseKindTone[p.kind]}>{purchaseKindLabels[p.kind]}</Badge> },
          {
            key: 'desc',
            label: 'الفاتورة',
            render: (p) => (
              <div>
                <div className="font-medium">
                  {p.description ?? purchaseKindLabels[p.kind]}
                  {p.attachment_path && (
                    <a href={p.attachment_path} target="_blank" rel="noreferrer" className="ms-1 inline-block text-faint hover:text-ink" onClick={(e) => e.stopPropagation()} aria-label="عرض المرفق">
                      <Paperclip className="inline size-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {p.status === 'posted' && (p.approved_at ? <span className="text-olive-700 dark:text-olive-400">معتمدة · </span> : <span className="text-amber-700 dark:text-amber-400">بانتظار الاعتماد · </span>)}
                  {p.invoice_no && <span className="num">#{p.invoice_no} </span>}
                  {Array.isArray(p.lines) && p.lines.length > 0 && <span>· {p.lines.length} مادة</span>}
                </div>
              </div>
            ),
          },
          ...(!supplierId
            ? [{ key: 'supplier', label: 'المورد', render: (p: PurchaseRow) => <Link to={`/suppliers/${p.supplier_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{p.suppliers?.name}</Link> }]
            : []),
          ...(!projectId
            ? [
                {
                  key: 'project',
                  label: 'المشروع / المرحلة',
                  hideBelow: 'md' as const,
                  render: (p: PurchaseRow) =>
                    p.project_id ? (
                      <div>
                        <Link to={`/projects/${p.project_id}/purchases`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          {p.projects?.name}
                        </Link>
                        {p.project_phases && <div className="text-xs text-muted">{p.project_phases.name}</div>}
                      </div>
                    ) : (
                      <Badge>عامة</Badge>
                    ),
                },
              ]
            : [
                {
                  key: 'phase',
                  label: 'المرحلة / البند',
                  hideBelow: 'md' as const,
                  render: (p: PurchaseRow) => (
                    <div className="text-xs text-muted">
                      {p.project_phases?.name ?? '—'}
                      {p.project_items && <div>{p.project_items.name}</div>}
                    </div>
                  ),
                },
              ]),
          { key: 'total', label: 'القيمة', align: 'end', render: (p) => <Money value={sign(p) * Number(p.total_amount)} className="font-semibold" /> },
          ...(finance
            ? [
                {
                  key: 'remaining',
                  label: 'المتبقي',
                  align: 'end' as const,
                  hideBelow: 'sm' as const,
                  render: (p: PurchaseRow) =>
                    p.status === 'reversed' ? (
                      <Badge tone="red">ملغاة</Badge>
                    ) : p.kind === 'return' ? (
                      <span className="text-xs text-muted">يُطرح من المستحق</span>
                    ) : p.remaining <= 0 ? (
                      <Badge tone="green">مدفوعة</Badge>
                    ) : (
                      <span className="inline-flex flex-col items-end">
                        <Money value={p.remaining} className="font-semibold text-red-700 dark:text-red-400" />
                        {p.paid > 0 && <span className="text-[10px] text-muted">مدفوع جزئياً</span>}
                      </span>
                    ),
                },
              ]
            : []),
        ]}
        rowActions={
          finance
            ? (p) => (
                <>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة الفاتورة" title="طباعة الفاتورة" onClick={() => openPrint('purchase', p.id)}>
                    <Printer className="size-4" />
                  </Button>
                  {admin && p.status === 'posted' && !p.approved_at && (
                    <Button variant="ghost" size="icon" className="size-8" aria-label="اعتماد الفاتورة" title="اعتماد الفاتورة بعد مراجعتها" onClick={() => approve.mutate(p.id)}>
                      <BadgeCheck className="size-4" />
                    </Button>
                  )}
                  {p.status === 'posted' && p.kind !== 'return' && p.remaining > 0 && (
                    <Button variant="ghost" size="icon" className="size-8" aria-label="سداد دفعة" title="سداد دفعة" onClick={() => setPaying(p)}>
                      <Banknote className="size-4" />
                    </Button>
                  )}
                  {p.status === 'posted' && p.kind !== 'return' && (
                    <Button variant="ghost" size="icon" className="size-8" aria-label="مرتجع" title="تسجيل مرتجع من هذه الفاتورة" onClick={() => setReturning(p)}>
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                  {p.status === 'posted' && (
                    <ReverseButton
                      title="إلغاء الفاتورة؟"
                      message="تُلغى الفاتورة وتخرج من تكلفة المشروع ومستحق المورد. تُرفض إذا كان عليها سداد قائم (ألغِ الدفعة أولاً) أو مرتجع قائم."
                      onReverse={(reason) => reverse.mutate({ id: p.id, reason })}
                    />
                  )}
                </>
              )
            : undefined
        }
      />
      {finance && <SupplierPaymentForm open={paying !== null} onClose={() => setPaying(null)} supplierId={paying?.supplier_id} purchaseId={paying?.id} />}
      {finance && <PurchaseForm open={returning !== null} onClose={() => setReturning(null)} returnOf={returning} />}
    </>
  )
}
