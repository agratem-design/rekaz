import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, Banknote, Hammer, Phone, Printer, ReceiptText, ScrollText, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { AmountCell, ReverseButton, useRpc } from '@/components/pickers'
import { Avatar, Button, Card, EmptyState, ErrorState, Money, PageHeader, Skeleton, StatCard, Tabs } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { paymentMethodLabels, rateUnitLabels } from '@/lib/labels'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { TechCashForm, WorkForm } from './TechForms'
import { WorkTable } from './WorkTable'
import { useTechnicianBalance, useTechnicianPayments, useTechnicianReceipts, useTechnicianWork } from './techData'

export function TechnicianDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const [tab, setTab] = useState(finance ? 'statement' : 'work')
  const [form, setForm] = useState<'work' | 'pay' | 'receive' | null>(null)
  const t = useQuery({
    queryKey: ['technician', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('technicians').select('*, technician_types(name)').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
  const bal = useTechnicianBalance(id)
  const work = useTechnicianWork({ technicianId: id })
  // غير المالية لا ترى الدفعات أصلاً (RLS تعيد قائمة فارغة)
  const payments = useTechnicianPayments(id)
  const receipts = useTechnicianReceipts(id)
  const revPay = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_technician_payment', { p_payment_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء الدفعة' })
  const revRec = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_technician_receipt', { p_receipt_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء السند' })

  if (t.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (t.error)
    return (t.error as { code?: string }).code === 'PGRST116' ? (
      <Card>
        <EmptyState title="الفني غير موجود" action={<Button variant="secondary" onClick={() => navigate('/technicians')}>العودة للفنيين</Button>} />
      </Card>
    ) : (
      <ErrorState message={errorMessage(t.error)} onRetry={() => t.refetch()} />
    )
  const tech = t.data!
  const b = bal.data?.[0]
  const due = Number(b?.balance_due ?? 0)

  type Line = { date: string; created: string; label: string; plus: number; minus: number }
  const lines: Line[] = [
    ...(work.data ?? []).filter((w) => w.status === 'posted').map((w) => ({ date: w.work_date, created: w.created_at, label: `عمل: ${w.description ?? w.project_items?.name ?? ''} (${w.projects?.name})`, plus: Number(w.amount), minus: 0 })),
    ...(payments.data ?? []).filter((p) => p.status === 'posted').map((p) => ({ date: p.payment_date, created: p.created_at, label: `دفعة${p.projects?.name ? ` — ${p.projects.name}` : ' على الحساب'}`, plus: 0, minus: Number(p.amount) })),
    ...(receipts.data ?? []).filter((r) => r.status === 'posted').map((r) => ({ date: r.receipt_date, created: r.created_at, label: 'مبلغ مستلم من الفني', plus: Number(r.amount), minus: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.created.localeCompare(b.created))
  let running = 0
  const ledger = lines.map((l) => ((running += l.plus - l.minus), { ...l, balance: running }))

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'الفنيون', to: '/technicians' }, { label: tech.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={tech.name} size="lg" />
            {tech.name}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            {tech.technician_types?.name && <span>{tech.technician_types.name}</span>}
            {tech.default_rate && (
              <span>
                <Money value={tech.default_rate} /> {tech.default_rate_unit ? rateUnitLabels[tech.default_rate_unit] : ''}
              </span>
            )}
            {tech.phone && (
              <span className="num flex items-center gap-1">
                <Phone className="size-3.5" />
                {tech.phone}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button onClick={() => setForm('work')}>
              <Hammer className="size-4" />
              تسجيل عمل ومستحق
            </Button>
            {finance && (
              <>
                <Button variant="soft" onClick={() => setForm('pay')}>
                  <Banknote className="size-4" />
                  صرف دفعة
                </Button>
                <Button variant="secondary" onClick={() => setForm('receive')}>
                  <ArrowDownToLine className="size-4" />
                  استلام مبلغ من الفني
                </Button>
                <Button variant="secondary" onClick={() => openPrint('technician-statement', tech.id)}>
                  <Printer className="size-4" />
                  كشف الحساب
                </Button>
                <Button variant="secondary" onClick={() => openPrint('technician-invoice', tech.id)}>
                  <Printer className="size-4" />
                  فاتورة الأعمال
                </Button>
              </>
            )}
          </>
        }
      />
      {b && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <StatCard icon={Hammer} label="المستحق من الأعمال" value={<Money value={b.earned} />} />
          {finance && <StatCard icon={Banknote} label="المدفوع" value={<Money value={b.paid} />} tone="blue" />}
          {finance && <StatCard icon={ArrowDownToLine} label="مستلم من الفني" value={<Money value={b.received_back} />} tone="sand" />}
          {finance && <StatCard icon={Wallet} label={due >= 0 ? 'المتبقي للفني' : 'مقدم عند الفني'} value={<Money value={Math.abs(due)} />} tone={due > 0 ? 'red' : 'sand'} />}
        </div>
      )}
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          ...(finance ? [{ key: 'statement', label: 'كشف الحساب', icon: ScrollText }] : []),
          { key: 'work', label: 'الأعمال والمستحقات', icon: Hammer },
          ...(finance ? [{ key: 'payments', label: 'سندات الصرف', icon: ReceiptText }, { key: 'receipts', label: 'المستلم من الفني', icon: ArrowDownToLine }] : []),
        ]}
      />
      <div className="mt-4">
        {tab === 'statement' && (
          <Card className="overflow-x-auto p-0">
            {!ledger.length ? (
              <EmptyState icon={ScrollText} title="لا توجد حركات" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-semibold">التاريخ</th>
                    <th className="px-4 py-2.5 text-right font-semibold">البيان</th>
                    <th className="px-4 py-2.5 text-left font-semibold">له</th>
                    <th className="px-4 py-2.5 text-left font-semibold">منه</th>
                    <th className="px-4 py-2.5 text-left font-semibold">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="num px-4 py-2 text-muted">{formatDate(l.date)}</td>
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2 text-left">{l.plus ? <Money value={l.plus} /> : ''}</td>
                      <td className="px-4 py-2 text-left">{l.minus ? <Money value={l.minus} /> : ''}</td>
                      <td className="px-4 py-2 text-left">
                        <Money value={l.balance} className="font-semibold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
        {tab === 'work' && <WorkTable technicianId={tech.id} onNew={() => setForm('work')} />}
        {tab === 'payments' && (
          <DataTable
            rows={payments.data}
            getKey={(p) => p.id}
            loading={payments.isLoading}
            rowClassName={(p) => p.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
            empty={<EmptyState icon={ReceiptText} title="لا توجد دفعات" />}
            columns={[
              { key: 'date', label: 'التاريخ', render: (p) => <span className="num text-muted">{formatDate(p.payment_date)}</span> },
              { key: 'project', label: 'المشروع (سياق)', render: (p) => p.projects?.name ?? <span className="text-muted">على الحساب</span> },
              { key: 'treasury', label: 'الخزينة', hideBelow: 'md', render: (p) => p.treasuries?.name },
              { key: 'method', label: 'الطريقة', hideBelow: 'lg', render: (p) => paymentMethodLabels[p.method] },
              { key: 'amount', label: 'المبلغ', align: 'end', render: (p) => <AmountCell value={p.amount} reversed={p.status === 'reversed'} /> },
            ]}
            rowActions={(p) => (
              <>
                <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة السند" title="طباعة السند" onClick={() => openPrint('technician-payment', p.id)}>
                  <Printer className="size-4" />
                </Button>
                {p.status === 'posted' && <ReverseButton title="إلغاء الدفعة؟" onReverse={(reason) => revPay.mutate({ id: p.id, reason })} />}
              </>
            )}
          />
        )}
        {tab === 'receipts' && (
          <DataTable
            rows={receipts.data}
            getKey={(r) => r.id}
            loading={receipts.isLoading}
            rowClassName={(r) => r.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
            empty={<EmptyState icon={ArrowDownToLine} title="لا توجد مبالغ مستلمة من الفني" />}
            columns={[
              { key: 'date', label: 'التاريخ', render: (r) => <span className="num text-muted">{formatDate(r.receipt_date)}</span> },
              { key: 'treasury', label: 'الخزينة', render: (r) => r.treasuries?.name },
              { key: 'notes', label: 'ملاحظات', hideBelow: 'md', render: (r) => r.notes ?? '—' },
              { key: 'amount', label: 'المبلغ', align: 'end', render: (r) => <AmountCell value={r.amount} reversed={r.status === 'reversed'} /> },
            ]}
            rowActions={(r) => (
              <>
                <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة السند" title="طباعة السند" onClick={() => openPrint('technician-receipt', r.id)}>
                  <Printer className="size-4" />
                </Button>
                {r.status === 'posted' && <ReverseButton title="إلغاء السند؟" onReverse={(reason) => revRec.mutate({ id: r.id, reason })} />}
              </>
            )}
          />
        )}
      </div>
      <WorkForm open={form === 'work'} onClose={() => setForm(null)} technicianId={tech.id} />
      {finance && <TechCashForm open={form === 'pay' || form === 'receive'} direction={form === 'receive' ? 'receive' : 'pay'} onClose={() => setForm(null)} technicianId={tech.id} />}
    </div>
  )
}
