import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Lock, Plus, Printer, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { Modal, ask } from '@/components/dialog'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { TreasuryPicker } from '@/components/TreasuryPicker'
import { AmountCell, ReverseButton, financeKeys, useRpc } from '@/components/pickers'
import { Badge, Button, EmptyState, Field, FilterChips, Input, KeyValue, Money, PageHeader, ProgressBar, Section, Select, StatCard, Textarea } from '@/components/ui'
import { formatDate, formatMoney, todayISO } from '@/lib/format'
import { newKey, useEngineers, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { ExpenseForm } from './expenses/ExpenseForm'
import { ExpensesTable } from './expenses/ExpensesTable'
import { useCustodies, type CustodyRow } from './expenses/expenseData'
import { PrintOptions } from './receipts/ReceiptForm'

type Filter = 'open' | 'closed' | 'all'

export function CustodiesPage() {
  const { data, isLoading, error, refetch } = useCustodies()
  const [filter, setFilter] = useState<Filter>('open')
  const [issuing, setIssuing] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const all = data ?? []
  const shown = all.filter((c) => (filter === 'all' ? true : filter === 'open' ? c.status === 'posted' && !c.is_closed : c.is_closed || c.status === 'reversed'))
  const open_ = all.filter((c) => c.status === 'posted' && !c.is_closed)
  const current = all.find((c) => c.id === detail) ?? null
  return (
    <div>
      <PageHeader
        title="العهد المالية"
        description="صرف عهدة لموظف أو مهندس، والصرف منها، وتسويتها بإرجاع نقدي أو مصروفات"
        actions={
          <Button onClick={() => setIssuing(true)}>
            <Plus className="size-4" />
            إضافة عهدة جديدة
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Wallet} label="عهد مفتوحة" value={<span className="num">{open_.length}</span>} />
        <StatCard icon={Wallet} label="المتبقي في العهد" value={<Money value={open_.reduce((a, c) => a + c.remaining, 0)} />} tone="sand" />
        <StatCard icon={Coins} label="المصروف من العهد" value={<Money value={open_.reduce((a, c) => a + c.spent, 0)} />} tone="blue" />
      </div>
      <DataTable
        rows={shown}
        getKey={(c) => c.id}
        loading={isLoading}
        error={error ? errorMessage(error) : null}
        onRetry={() => refetch()}
        onRowClick={(c) => setDetail(c.id)}
        rowClassName={(c) => c.status === 'reversed' && 'text-faint line-through decoration-faint/50'}
        toolbar={
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: 'مفتوحة', count: open_.length },
              { value: 'closed', label: 'مغلقة / ملغاة' },
              { value: 'all', label: 'الكل', count: all.length },
            ]}
          />
        }
        empty={<EmptyState icon={Wallet} title="لا توجد عهد" action={<Button onClick={() => setIssuing(true)}>إضافة عهدة</Button>} />}
        columns={[
          { key: 'date', label: 'التاريخ', render: (c) => <span className="num text-muted">{formatDate(c.issue_date)}</span> },
          {
            key: 'holder',
            label: 'صاحب العهدة',
            render: (c) => (
              <div>
                <div className="font-medium">{c.holder}</div>
                <div className="text-xs text-muted">{c.employee_id ? 'موظف' : 'مهندس'}{c.purpose ? ` · ${c.purpose}` : ''}</div>
              </div>
            ),
          },
          { key: 'project', label: 'المشروع', hideBelow: 'md', render: (c) => c.projects?.name ?? <Badge>عامة</Badge> },
          { key: 'amount', label: 'المصروف', align: 'end', render: (c) => <AmountCell value={c.amount} reversed={c.status === 'reversed'} /> },
          {
            key: 'usage',
            label: 'الاستخدام',
            hideBelow: 'sm',
            render: (c) => (
              <div className="min-w-32">
                <ProgressBar value={c.spent + c.returned} max={Number(c.amount)} tone="sand" />
                <div className="mt-1 text-[11px] text-muted">
                  صُرف {formatMoney(c.spent)} · أُرجع {formatMoney(c.returned)}
                </div>
              </div>
            ),
          },
          {
            key: 'remaining',
            label: 'المتبقي',
            align: 'end',
            render: (c) => (c.status === 'reversed' ? <Badge tone="red">ملغاة</Badge> : c.is_closed ? <Badge tone="neutral">مغلقة</Badge> : <Money value={c.remaining} className="font-semibold" />),
          },
        ]}
      />
      <IssueForm open={issuing} onClose={() => setIssuing(false)} />
      <CustodyDetail custody={current} onClose={() => setDetail(null)} />
    </div>
  )
}

export function IssueForm({ open, onClose, holderType, holderId }: { open: boolean; onClose: () => void; holderType?: 'employee' | 'engineer'; holderId?: string }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const engineers = useEngineers()
  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select('id, name, is_active').order('name')
      if (error) throw error
      return data
    },
  })
  const blank = () => ({ holderType: (holderType ?? 'employee') as 'employee' | 'engineer', holder: holderId ?? '', project_id: '', treasury_id: '', amount: '', date: todayISO(), purpose: '' })
  const [f, setF] = useState(blank)
  const [key, setKey] = useState(newKey)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [printId, setPrintId] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setF(blank())
      setKey(newKey())
      setErrors({})
    }
  }
  const set = (p: Partial<typeof f>) => (setF({ ...f, ...p }), setErrors({}))
  const project = (projects.data ?? []).find((p) => p.id === f.project_id)
  const dirty = Boolean(f.holder || f.amount || f.purpose)
  const holders = f.holderType === 'employee' ? (employees.data ?? []).filter((e) => e.is_active) : (engineers.data ?? [])

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.holder) e.holder = 'اختر صاحب العهدة'
    if (!(Number(f.amount) > 0)) e.amount = 'أدخل المبلغ'
    if (!f.treasury_id) e.treasury = 'اختر الخزينة'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('issue_custody', {
      p_key: key,
      p_treasury_id: f.treasury_id,
      p_amount: Number(f.amount),
      p_date: f.date,
      p_employee_id: (f.holderType === 'employee' ? f.holder : null) as string,
      p_engineer_id: (f.holderType === 'engineer' ? f.holder : null) as string,
      p_project_id: (f.project_id || null) as string,
      p_purpose: (f.purpose.trim() || null) as string,
    })
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('تم صرف العهدة')
    for (const k of financeKeys) qc.invalidateQueries({ queryKey: [k] })
    setPrintId(data as string)
    onClose()
  }

  return (
    <>
      <SidePanel
        open={open}
        title="إضافة عهدة جديدة"
        description="يُخصم المبلغ من الخزينة ويصبح عهدة عند الموظف أو المهندس"
        dirty={dirty}
        onClose={onClose}
        footer={
          <>
            <Button loading={busy} onClick={submit}>
              صرف العهدة
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
              إلغاء
            </Button>
          </>
        }
      >
        <Section title="صاحب العهدة">
          <FilterChips
            value={f.holderType}
            onChange={(t) => set({ holderType: t, holder: '' })}
            options={[
              { value: 'employee', label: 'موظف' },
              { value: 'engineer', label: 'مهندس' },
            ]}
          />
          <Field label={f.holderType === 'employee' ? 'الموظف' : 'المهندس'} required error={errors.holder}>
            <Select value={f.holder} onChange={(e) => set({ holder: e.target.value })}>
              <option value="">— اختر —</option>
              {holders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المشروع (اختياري)" hint="عهدة المشروع لا تُصرف إلا على نفس المشروع">
            <Select value={f.project_id} onChange={(e) => set({ project_id: e.target.value, treasury_id: '' })}>
              <option value="">— عهدة عامة —</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الغرض">
            <Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="مثال: مشتريات موقع أسبوعية" />
          </Field>
        </Section>
        <Section title="المبلغ والخزينة">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المبلغ (د.ل)" required error={errors.amount}>
              <Input type="number" dir="ltr" step="0.001" min={0} className="h-11 text-lg font-semibold" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
            <Field label="تاريخ الصرف" required>
              <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
          </div>
          <TreasuryPicker label="الخزينة" value={f.treasury_id} onChange={(id) => set({ treasury_id: id })} domain={project?.project_type ?? null} required error={errors.treasury} />
        </Section>
      </SidePanel>
      {printId && <PrintOptions kind="custody" id={printId} title="تم صرف العهدة" message="هل تريد طباعة سند صرف العهدة؟" onClose={() => setPrintId(null)} />}
    </>
  )
}

function CustodyDetail({ custody, onClose }: { custody: CustodyRow | null; onClose: () => void }) {
  const [spending, setSpending] = useState(false)
  const [returning, setReturning] = useState(false)
  const returns = useQuery({
    queryKey: ['custodies', 'returns', custody?.id],
    enabled: Boolean(custody),
    queryFn: async () => {
      const { data, error } = await supabase.from('custody_returns').select('*, treasuries(name)').eq('custody_id', custody!.id).order('return_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const close = useRpc(() => supabase.rpc('close_custody', { p_custody_id: custody!.id }), { success: 'تم إغلاق العهدة' })
  const reverse = useRpc((reason: string) => supabase.rpc('reverse_custody', { p_custody_id: custody!.id, p_reason: reason, p_date: todayISO() }), { success: 'تم إلغاء العهدة', onDone: onClose })
  const reverseReturn = useRpc((a: { id: string; reason: string }) => supabase.rpc('reverse_custody_return', { p_return_id: a.id, p_reason: a.reason, p_date: todayISO() }), { success: 'تم إلغاء الإرجاع' })
  const active = custody?.status === 'posted' && !custody.is_closed
  return (
    <>
      <SidePanel open={custody !== null} size="xl" title={`عهدة ${custody?.holder ?? ''}`} description={custody ? `${formatDate(custody.issue_date)} · ${custody.projects?.name ?? 'عامة'}${custody.purpose ? ` · ${custody.purpose}` : ''}` : undefined} onClose={onClose}>
        {custody && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['المصروف للعهدة', custody.amount],
                  ['صُرف منها', custody.spent],
                  ['أُرجع نقداً', custody.returned],
                  ['المتبقي', custody.remaining],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-3">
                  <div className="text-xs text-muted">{l}</div>
                  <Money value={v} className="font-display text-lg font-semibold" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {active && (
                <>
                  <Button onClick={() => setSpending(true)} disabled={custody.remaining <= 0}>
                    <Coins className="size-4" />
                    صرف من العهدة
                  </Button>
                  <Button variant="soft" onClick={() => setReturning(true)} disabled={custody.remaining <= 0}>
                    <Undo2 className="size-4" />
                    إرجاع نقدي للخزينة
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={custody.remaining !== 0}
                    title={custody.remaining !== 0 ? 'لا تُغلق العهدة وفيها متبقٍ' : undefined}
                    onClick={async () => (await ask({ title: 'إغلاق العهدة؟', message: 'لن يُصرف منها بعد الإغلاق.', confirmLabel: 'إغلاق', tone: 'primary' })) && close.mutate(undefined)}
                  >
                    <Lock className="size-4" />
                    تسوية وإغلاق
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => openPrint('custody', custody.id)}>
                <Printer className="size-4" />
                سند صرف العهدة
              </Button>
              <Button variant="ghost" onClick={() => openPrint('custody-statement', custody.id)}>
                <Printer className="size-4" />
                كشف العهدة
              </Button>
              {custody.status === 'posted' && custody.spent === 0 && custody.returned === 0 && (
                <span className="ms-auto">
                  <ReverseButton title="إلغاء العهدة؟" message="يعود المبلغ إلى الخزينة بقيد عكسي. لا تُلغى عهدة عليها مصروفات أو إرجاعات." onReverse={(r) => reverse.mutate(r)} />
                </span>
              )}
            </div>
            <Section title="المصروفات من العهدة">
              <ExpensesTable custodyId={custody.id} projectId={custody.project_id ?? undefined} />
            </Section>
            <Section title="الإرجاعات النقدية">
              {!returns.data?.length ? (
                <p className="text-sm text-muted">لا توجد إرجاعات.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {returns.data.map((r) => (
                    <li key={r.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.status === 'reversed' ? 'text-faint line-through' : ''}`}>
                      <span className="num w-20 text-xs text-muted">{formatDate(r.return_date)}</span>
                      <span className="flex-1">{r.treasuries?.name}</span>
                      <Money value={r.amount} className="font-semibold" />
                      <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة" onClick={() => openPrint('custody-return', r.id)}>
                        <Printer className="size-4" />
                      </Button>
                      {r.status === 'posted' && <ReverseButton title="إلغاء الإرجاع؟" onReverse={(reason) => reverseReturn.mutate({ id: r.id, reason })} />}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </SidePanel>
      {custody && <ExpenseForm open={spending} onClose={() => setSpending(false)} custodyId={custody.id} projectId={custody.project_id ?? undefined} />}
      {custody && returning && <ReturnCash custody={custody} onClose={() => setReturning(false)} />}
    </>
  )
}

function ReturnCash({ custody, onClose }: { custody: CustodyRow; onClose: () => void }) {
  const [treasury, setTreasury] = useState(custody.treasury_id)
  const [amount, setAmount] = useState(String(custody.remaining))
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [key] = useState(newKey)
  const amt = Number(amount)
  const ret = useRpc(
    () => supabase.rpc('return_custody_cash', { p_key: key, p_custody_id: custody.id, p_treasury_id: treasury, p_amount: amt, p_date: date, p_notes: (notes.trim() || null) as string }),
    { success: 'تم إرجاع المبلغ إلى الخزينة', onDone: onClose },
  )
  return (
    <Modal
      title="إرجاع نقدي من العهدة"
      onClose={onClose}
      footer={
        <>
          <Button loading={ret.isPending} disabled={!treasury || !(amt > 0) || amt > custody.remaining} onClick={() => ret.mutate(undefined)}>
            إرجاع
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <KeyValue label="المتبقي في العهدة">
          <Money value={custody.remaining} />
        </KeyValue>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ (د.ل)" error={amt > custody.remaining ? 'أكبر من المتبقي' : null}>
            <Input type="number" dir="ltr" step="0.001" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <TreasuryPicker label="الخزينة المستلمة" value={treasury} onChange={setTreasury} domain={custody.projects?.project_type ?? null} required />
        <Field label="ملاحظات">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
