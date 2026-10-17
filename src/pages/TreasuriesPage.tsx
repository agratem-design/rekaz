import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Building, Landmark, Pencil, Plus, Power, Printer, ScrollText, Wallet } from 'lucide-react'
import { openPrint, sourcePrintKind } from '@/print/open'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Badge, Button, Card, CardsSkeleton, Checkbox, EmptyState, ErrorState, Field, Input, Money, PageHeader, Section, Select, Spinner, StatCard, Textarea, cn } from '@/components/ui'
import { ask } from '@/components/dialog'
import type { Json } from '@/lib/database.types'
import { formatDate, todayISO } from '@/lib/format'
import { domainLabels, options, treasuryKindLabels } from '@/lib/labels'
import { errorMessage, supabase, type Tables, type Views } from '@/lib/supabase'

type Treasury = Tables<'treasuries'>
type Form = Partial<Treasury> & { opening?: string; opening_date?: string }

export const sourceLabels: Record<string, string> = {
  opening_balance: 'رصيد افتتاحي',
  client_receipt: 'قبض من زبون',
  supplier_payment: 'دفعة لمورد',
  technician_payment: 'دفعة لفني',
  technician_deposit: 'مبلغ من فني',
  expense: 'مصروف',
  transfer: 'تحويل',
  custody_issue: 'صرف عهدة',
  custody_return: 'إرجاع عهدة',
  payroll_slip: 'راتب',
  employee_advance: 'سلفة موظف',
  advance_repayment: 'سداد سلفة',
}

export function TreasuriesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'accountant')
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Form | null>(null)
  const [dirty, setDirty] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [statementOf, setStatementOf] = useState<Views<'treasury_balances'> | null>(null)

  const list = useQuery({
    queryKey: ['treasuries'],
    queryFn: async () => {
      const [t, b] = await Promise.all([supabase.from('treasuries').select('*').order('name'), supabase.from('treasury_balances').select('*')])
      if (t.error) throw t.error
      if (b.error) throw b.error
      const bal = new Map(b.data.map((x) => [x.treasury_id, x]))
      return t.data.map((x) => ({ ...x, balance: Number(bal.get(x.id)?.balance ?? 0), view: bal.get(x.id)! }))
    },
  })

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const row = {
        name: f.name!.trim(),
        domain: f.domain!,
        kind: f.kind ?? 'cash',
        parent_id: f.parent_id || null,
        bank_name: f.kind === 'bank' ? f.bank_name || null : null,
        account_number: f.kind === 'bank' ? f.account_number || null : null,
        notes: f.notes || null,
        is_active: f.is_active ?? true,
      }
      const { error } = await supabase.rpc('save_treasury', { p_document: { ...row, ...(f.id ? { id: f.id } : { opening: f.opening || '0', opening_date: f.opening_date || todayISO() }) } as Json })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
      qc.invalidateQueries({ queryKey: ['treasuries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditing(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const header = (
    <PageHeader
      title="الخزائن والحسابات"
      description="الرصيد محسوب من الحركات المسجلة فقط، ولا يُعدَّل يدوياً"
      actions={
        canWrite && (
          <Button
            onClick={() => {
              setEditing({ kind: 'cash', is_active: true })
              setDirty(false)
              setNameError(null)
            }}
          >
            <Plus className="size-4" />
            خزينة جديدة
          </Button>
        )
      }
    />
  )

  if (list.isLoading)
    return (
      <div>
        {header}
        <CardsSkeleton count={3} />
      </div>
    )
  if (list.error)
    return (
      <div>
        {header}
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      </div>
    )
  const rows = list.data ?? []
  const roots = rows.filter((t) => !t.parent_id)
  const total = rows.reduce((a, t) => a + t.balance, 0)
  const set = (patch: Form) => {
    setEditing((e) => ({ ...e, ...patch }))
    setDirty(true)
    if (patch.name !== undefined) setNameError(null)
  }
  const submit = () => {
    if (!editing?.name?.trim()) return setNameError('اسم الخزينة مطلوب')
    if (!editing.domain) return toast.error('اختر القطاع')
    if (editing.opening && (!Number.isFinite(Number(editing.opening)) || Number(editing.opening) < 0)) return toast.error('أدخل رصيداً افتتاحياً صحيحاً صفراً أو موجباً')
    save.mutate(editing)
  }

  return (
    <div>
      {header}
      {rows.some((r) => r.balance < 0) && <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-semibold">أرصدة تحتاج تسوية ومراجعة</p><p>المبالغ المصروفة المسجلة أعلى من الوارد في بعض الخزائن. الرصيد السالب لا يمثل تمويلاً أو تحصيلاً من الزبون؛ راجع الحركات والتمويل والأرصدة السابقة.</p><ul className="mt-2 space-y-1">{rows.filter((r) => r.balance < 0).map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2"><span>{r.name}</span><Money value={r.balance} /></li>)}</ul></div>}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Landmark} label="إجمالي الأرصدة" value={<Money value={total} />} />
        <StatCard icon={Wallet} label="الخزائن النقدية" value={<span className="num">{rows.filter((r) => r.kind === 'cash').length}</span>} tone="sand" />
        <StatCard icon={Building} label="الحسابات المصرفية" value={<span className="num">{rows.filter((r) => r.kind === 'bank').length}</span>} tone="blue" />
      </div>

      {!roots.length ? (
        <Card>
          <EmptyState icon={Landmark} title="لا توجد خزائن بعد" action={canWrite && <Button onClick={() => setEditing({ kind: 'cash', is_active: true })}>خزينة جديدة</Button>}>
            أنشئ خزينة رئيسية لكل قطاع، ثم أضف تحتها الفروع والحسابات المصرفية.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {roots.map((root) => {
            const children = rows.filter((t) => t.parent_id === root.id)
            const sectorTotal = root.balance + children.reduce((a, c) => a + c.balance, 0)
            return (
              <Card key={root.id} className="p-0">
                <div className="flex items-start justify-between gap-3 border-b border-line p-4">
                  <div>
                    <div className="font-display text-base font-semibold">{root.name}</div>
                    <div className="mt-1">
                      <Badge tone="brand">{domainLabels[root.domain]}</Badge>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-muted">مجموع القطاع</div>
                    <Money value={sectorTotal} className="font-display text-xl font-semibold" />
                  </div>
                </div>
                {canWrite && <div className="flex justify-end border-b border-line px-4 py-2"><Button variant="soft" size="sm" disabled={!root.is_active} onClick={() => { setEditing({ parent_id: root.id, domain: root.domain, kind: 'cash', is_active: true }); setDirty(false); setNameError(null) }}><Plus className="size-4" />إضافة خزينة فرعية</Button></div>}
                <ul className="divide-y divide-line">
                  {[root, ...children].map((t) => (
                    <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className={cn('rounded-md p-1.5', t.kind === 'bank' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50' : 'bg-sand-50 text-sand-600 dark:bg-sand-700/20')}>
                        {t.kind === 'bank' ? <Building className="size-3.5" /> : <Banknote className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{t.id === root.id ? 'الخزينة الرئيسية' : t.name}</div>
                        <div className="text-xs text-muted">
                          {treasuryKindLabels[t.kind]}
                          {t.bank_name ? ` · ${t.bank_name}` : ''}
                          {!t.is_active && ' · موقوفة'}
                        </div>
                      </div>
                      <Money value={t.balance} className="font-medium" />
                      <Button variant="ghost" size="icon" className="size-8" aria-label="كشف الحركات" title="كشف الحركات" onClick={() => setStatementOf(t.view)}>
                        <ScrollText className="size-4" />
                      </Button>
                      {canWrite && (
                        <><Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="تعديل"
                          title="تعديل"
                          onClick={() => {
                            setEditing(t)
                            setDirty(false)
                            setNameError(null)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button><Button variant="ghost" size="icon" className="size-8" aria-label={`${t.is_active ? 'إيقاف' : 'تفعيل'} ${t.name}`} title={t.is_active ? 'إيقاف الخزينة' : 'تفعيل الخزينة'} disabled={save.isPending} onClick={async () => {
                          if (await ask({ title: t.is_active ? 'إيقاف الخزينة؟' : 'تفعيل الخزينة؟', message: t.is_active ? 'تبقى الحركات السابقة محفوظة. يتطلب الإيقاف رصيداً صفراً وإيقاف الفروع أولاً، ويمكن إعادة التفعيل لاحقاً.' : 'ستظهر الخزينة مجدداً في نماذج القبض والصرف.', confirmLabel: t.is_active ? 'إيقاف الخزينة' : 'تفعيل الخزينة', tone: 'primary' })) save.mutate({ ...t, is_active: !t.is_active })
                        }}><Power className="size-4" /></Button></>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      <SidePanel
        open={editing !== null}
        title={editing?.id ? 'تعديل خزينة' : 'خزينة جديدة'}
        dirty={dirty}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button loading={save.isPending} onClick={submit}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && setEditing(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        {editing && (
          <>
            <Section title="البيانات الأساسية">
              <Field label="الاسم" required error={nameError}>
                <Input value={editing.name ?? ''} onChange={(e) => set({ name: e.target.value })} aria-invalid={Boolean(nameError)} />
              </Field>
              <Field label="تتبع خزينة رئيسية" hint="اتركه فارغاً لخزينة رئيسية لقطاع">
                <Select
                  value={editing.parent_id ?? ''}
                  onChange={(e) => {
                    const parent = roots.find((r) => r.id === e.target.value)
                    set({ parent_id: e.target.value || null, ...(parent ? { domain: parent.domain } : {}) })
                  }}
                >
                  <option value="">— خزينة رئيسية —</option>
                  {roots
                    .filter((r) => r.id !== editing.id && (r.is_active || r.id === editing.parent_id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="القطاع" required hint="عمليات المشروع لا تستخدم إلا خزائن قطاعه">
                <Select value={editing.domain ?? ''} disabled={Boolean(editing.parent_id)} onChange={(e) => set({ domain: e.target.value as Treasury['domain'] })}>
                  <option value="">— اختر —</option>
                  {options(domainLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Section>
            <Section title="نوع الحساب">
              <Field label="النوع">
                <Select value={editing.kind ?? 'cash'} onChange={(e) => set({ kind: e.target.value as Treasury['kind'] })}>
                  {options(treasuryKindLabels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {editing.kind === 'bank' && (
                <>
                  <Field label="المصرف">
                    <Input value={editing.bank_name ?? ''} onChange={(e) => set({ bank_name: e.target.value })} />
                  </Field>
                  <Field label="رقم الحساب">
                    <Input dir="ltr" value={editing.account_number ?? ''} onChange={(e) => set({ account_number: e.target.value })} />
                  </Field>
                </>
              )}
              {!editing.id && (
                <><Field label="الرصيد الافتتاحي (د.ل)" hint="يُسجَّل كحركة افتتاحية ولا يمكن تغييره لاحقاً">
                  <Input type="number" min="0" step="0.001" inputMode="decimal" dir="ltr" value={editing.opening ?? ''} onChange={(e) => set({ opening: e.target.value })} />
                </Field><Field label="تاريخ الرصيد الافتتاحي"><Input type="date" value={editing.opening_date ?? todayISO()} onChange={(e) => set({ opening_date: e.target.value })} /></Field></>
              )}
            </Section>
            <Section title="ملاحظات">
              <Textarea value={editing.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} aria-label="ملاحظات" />
              {editing.id && <Checkbox label="مستخدمة" checked={editing.is_active ?? true} onChange={(v) => set({ is_active: v })} />}
            </Section>
          </>
        )}
      </SidePanel>

      <SidePanel open={statementOf !== null} size="lg" title={`كشف ${statementOf?.name ?? ''}`} description="كل الحركات والرصيد بعد كل حركة" onClose={() => setStatementOf(null)}>
        {statementOf && <Statement treasuryId={statementOf.treasury_id!} />}
      </SidePanel>
    </div>
  )
}

function Statement({ treasuryId }: { treasuryId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['treasury_entries', treasuryId],
    queryFn: async () => {
      const { data, error } = await supabase.from('treasury_entries').select('*').eq('treasury_id', treasuryId).order('entry_date').order('created_at')
      if (error) throw error
      return data
    },
  })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSource] = useState('')
  if (isLoading) return <Spinner />
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
  if (!data?.length) return <EmptyState icon={ScrollText} title="لا توجد حركات" />
  // الرصيد بعد كل حركة يُحسب على كل الحركات، ثم تُطبَّق الفلاتر على العرض
  let running = 0
  const lines = data.map((e) => {
    const signed = e.direction === 'in' ? Number(e.amount) : -Number(e.amount)
    running += signed
    return { ...e, signed, running }
  })
  const opening = from ? lines.filter((l) => l.entry_date < from).reduce((a, l) => a + l.signed, 0) : 0
  const shown = lines.filter((l) => (!from || l.entry_date >= from) && (!to || l.entry_date <= to) && (!source || l.source_type === source))
  const sources = [...new Set(lines.map((l) => l.source_type))]
  const totalIn = shown.filter((l) => l.signed > 0).reduce((a, l) => a + l.signed, 0)
  const totalOut = shown.filter((l) => l.signed < 0).reduce((a, l) => a - l.signed, 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="من تاريخ">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="إلى تاريخ">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="نوع الحركة" className="col-span-2">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">كل الحركات</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabels[s] ?? s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-surface-2 px-4 py-2 text-sm">
        {from && (
          <span>
            رصيد أول المدة <Money value={opening} className="font-semibold" />
          </span>
        )}
        <span>
          وارد <Money value={totalIn} className="font-semibold text-olive-700 dark:text-olive-400" />
        </span>
        <span>
          صادر <Money value={totalOut} className="font-semibold" />
        </span>
        <Button variant="ghost" size="sm" className="ms-auto" onClick={() => openPrint('treasury-statement', treasuryId, false, { ...(from && { from }), ...(to && { to }), ...(source && { source }) })}>
          <Printer className="size-3.5" />
          طباعة الكشف
        </Button>
      </div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-5 py-2 text-right font-semibold">التاريخ</th>
              <th className="py-2 text-right font-semibold">البيان</th>
              <th className="py-2 text-left font-semibold">المبلغ</th>
              <th className="px-5 py-2 text-left font-semibold">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((e) => (
              <tr key={e.id} className="border-t border-line align-top">
                <td className="num px-5 py-2.5 whitespace-nowrap text-muted">{formatDate(e.entry_date)}</td>
                <td className="py-2.5">
                  {sourcePrintKind[e.source_type] ? (
                    <button type="button" className="text-right hover:text-brand-700 hover:underline dark:hover:text-brand-300" title="عرض المستند المصدر" onClick={() => openPrint(sourcePrintKind[e.source_type], e.source_id)}>
                      {sourceLabels[e.source_type] ?? e.source_type}
                    </button>
                  ) : (
                    (sourceLabels[e.source_type] ?? e.source_type)
                  )}
                  {e.reverses_entry_id && <span className="ms-1 text-xs text-red-600">(قيد عكسي)</span>}
                  {e.memo && e.memo !== sourceLabels[e.source_type] && <div className="text-xs text-muted">{e.memo}</div>}
                </td>
                <td className="py-2.5 text-left">
                  <Money value={e.signed} signed className={e.signed > 0 ? 'text-olive-700 dark:text-olive-400' : undefined} />
                </td>
                <td className="px-5 py-2.5 text-left">
                  <Money value={e.running} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <EmptyState title="لا توجد حركات مطابقة" />}
      </div>
    </div>
  )
}
