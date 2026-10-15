import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { AmountCell, ReverseButton, financeKeys, useRpc } from '@/components/pickers'
import { Button, EmptyState, Field, Input, Money, PageHeader, Section, StatCard, Textarea } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/format'
import { newKey, useTreasuriesWithBalance } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { PrintOptions } from './receipts/ReceiptForm'

// التحويل بين الخزائن: حركتان مرتبطتان (صادر ووارد) بعملية واحدة
export function TransfersPage() {
  const [open, setOpen] = useState(false)
  const list = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfers')
        .select('*, from:treasuries!transfers_from_treasury_id_fkey(name), to:treasuries!transfers_to_treasury_id_fkey(name)')
        .order('transfer_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const reverse = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_transfer', { p_transfer_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء التحويل' })
  const posted = (list.data ?? []).filter((t) => t.status === 'posted')
  return (
    <div>
      <PageHeader
        title="التحويلات"
        description="نقل مبلغ من خزينة إلى أخرى. لا يغيّر مجموع الأرصدة."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            تحويل جديد
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={ArrowLeftRight} label="عدد التحويلات" value={<span className="num">{posted.length}</span>} />
        <StatCard icon={ArrowLeftRight} label="إجمالي المحوَّل" value={<Money value={posted.reduce((a, t) => a + Number(t.amount), 0)} />} tone="blue" />
        <StatCard icon={ArrowLeftRight} label="هذا الشهر" value={<Money value={posted.filter((t) => t.transfer_date.startsWith(todayISO().slice(0, 7))).reduce((a, t) => a + Number(t.amount), 0)} />} tone="sand" />
      </div>
      <DataTable
        rows={list.data}
        getKey={(t) => t.id}
        loading={list.isLoading}
        error={list.error ? errorMessage(list.error) : null}
        onRetry={() => list.refetch()}
        rowClassName={(t) => t.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
        empty={<EmptyState icon={ArrowLeftRight} title="لا توجد تحويلات" action={<Button onClick={() => setOpen(true)}>تحويل جديد</Button>} />}
        columns={[
          { key: 'date', label: 'التاريخ', render: (t) => <span className="num text-muted">{formatDate(t.transfer_date)}</span> },
          {
            key: 'route',
            label: 'من ← إلى',
            render: (t) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{t.from?.name}</span>
                <ArrowLeftRight className="size-3.5 text-faint" />
                <span className="font-medium">{t.to?.name}</span>
              </span>
            ),
          },
          { key: 'notes', label: 'ملاحظات', hideBelow: 'md', render: (t) => <span className="text-muted">{t.notes ?? '—'}</span> },
          { key: 'amount', label: 'المبلغ', align: 'end', render: (t) => <AmountCell value={t.amount} reversed={t.status === 'reversed'} /> },
        ]}
        rowActions={(t) => (
          <>
            <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة الإشعار" title="طباعة إشعار التحويل" onClick={() => openPrint('transfer', t.id)}>
              <Printer className="size-4" />
            </Button>
            {t.status === 'posted' && <ReverseButton title="إلغاء التحويل؟" message="تُعكس الحركتان (الصادر والوارد) بتاريخ اليوم." onReverse={(reason) => reverse.mutate({ id: t.id, reason })} />}
          </>
        )}
      />
      <TransferForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function TransferForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const treasuries = useTreasuriesWithBalance()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [key, setKey] = useState(newKey)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setFrom('')
      setTo('')
      setAmount('')
      setDate(todayISO())
      setNotes('')
      setKey(newKey())
      setErrors({})
    }
  }
  const dirty = Boolean(from || to || amount || notes)
  const fromBal = (treasuries.data ?? []).find((t) => t.id === from)?.balance

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!from) e.from = 'اختر الخزينة المحوَّل منها'
    if (!to) e.to = 'اختر الخزينة المحوَّل إليها'
    if (from && from === to) e.to = 'لا يمكن التحويل إلى نفس الخزينة'
    if (!(Number(amount) > 0)) e.amount = 'أدخل المبلغ'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('transfer_between_treasuries', { p_key: key, p_from: from, p_to: to, p_amount: Number(amount), p_date: date, p_notes: (notes.trim() || null) as string })
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('تم التحويل')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    setPrintId(data as string)
    onClose()
  }

  return (
    <>
      <SidePanel
        open={open}
        title="تحويل بين الخزائن"
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              تحويل المبلغ
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <Section title="من">
          <TreasuryPicker label="الخزينة المحوَّل منها" value={from} onChange={setFrom} required error={errors.from} />
          {fromBal !== undefined && fromBal !== null && (
            <p className="text-xs text-muted">
              الرصيد الحالي <Money value={fromBal} />
            </p>
          )}
        </Section>
        <Section title="إلى">
          <TreasuryPicker label="الخزينة المحوَّل إليها" value={to} onChange={setTo} required error={errors.to} />
        </Section>
        <Section title="المبلغ">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المبلغ (د.ل)" required error={errors.amount}>
              <Input type="number" dir="ltr" step="0.001" min={0} className="h-11 text-lg font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="التاريخ" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </Section>
      </SidePanel>
      {printId && <PrintOptions kind="transfer" id={printId} title="تم التحويل" message="هل تريد طباعة إشعار التحويل؟" onClose={() => setPrintId(null)} />}
    </>
  )
}
