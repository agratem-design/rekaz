import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Badge, Button, Card, ErrorState, Field, Input, Money, PageHeader, Select, Spinner, Textarea } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { domainLabels, options, treasuryKindLabels } from '@/lib/labels'
import { errorMessage, supabase, type Tables, type Views } from '@/lib/supabase'

type Treasury = Tables<'treasuries'>
type Form = Partial<Treasury> & { opening?: string }

const sourceLabels: Record<string, string> = {
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
        name: f.name!,
        domain: f.domain!,
        kind: f.kind ?? 'cash',
        parent_id: f.parent_id || null,
        bank_name: f.bank_name || null,
        account_number: f.account_number || null,
        notes: f.notes || null,
        is_active: f.is_active ?? true,
      }
      if (f.id) {
        const { error } = await supabase.from('treasuries').update(row).eq('id', f.id)
        if (error) throw error
        return
      }
      const { data, error } = await supabase.from('treasuries').insert(row).select('id').single()
      if (error) throw error
      if (f.opening && Number(f.opening) !== 0) {
        const r = await supabase.rpc('set_opening_balance', {
          p_treasury_id: data.id,
          p_amount: Number(f.opening),
          p_date: new Date().toISOString().slice(0, 10),
        })
        if (r.error) throw r.error
      }
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
      qc.invalidateQueries({ queryKey: ['treasuries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditing(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (list.isLoading) return <Spinner />
  if (list.error) return <ErrorState message={errorMessage(list.error)} />
  const rows = list.data ?? []
  const roots = rows.filter((t) => !t.parent_id)
  const set = (patch: Form) => {
    setEditing((e) => ({ ...e, ...patch }))
    setDirty(true)
  }

  return (
    <div>
      <PageHeader
        title="الخزائن"
        description="الرصيد محسوب من الحركات المسجلة فقط، ولا يُعدَّل يدوياً"
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing({ kind: 'cash', is_active: true })
                setDirty(false)
              }}
            >
              <Plus className="size-4" />
              خزينة جديدة
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {roots.map((root) => {
          const children = rows.filter((t) => t.parent_id === root.id)
          const total = root.balance + children.reduce((a, c) => a + c.balance, 0)
          return (
            <Card key={root.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{root.name}</div>
                  <Badge tone="blue">{domainLabels[root.domain]}</Badge>
                </div>
                <div className="text-left">
                  <div className="text-xs text-stone-500">مجموع القطاع</div>
                  <Money value={total} className="text-lg font-bold" />
                </div>
              </div>
              {[root, ...children].map((t) => (
                <div key={t.id} className="flex items-center gap-2 border-t border-stone-100 py-2 text-sm dark:border-stone-800">
                  <div className="flex-1">
                    {t.id === root.id ? 'الخزينة الرئيسية' : t.name}
                    <span className="mr-2 text-xs text-stone-500">
                      {treasuryKindLabels[t.kind]}
                      {t.bank_name ? ` · ${t.bank_name}` : ''}
                    </span>
                    {!t.is_active && <Badge>موقوفة</Badge>}
                  </div>
                  <Money value={t.balance} />
                  <Button variant="ghost" className="size-8 px-0" aria-label="كشف الحركات" onClick={() => setStatementOf(t.view)}>
                    <ScrollText className="size-4" />
                  </Button>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      className="size-8 px-0"
                      aria-label="تعديل"
                      onClick={() => {
                        setEditing(t)
                        setDirty(false)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )
        })}
      </div>

      <SidePanel
        open={editing !== null}
        title={editing?.id ? 'تعديل خزينة' : 'خزينة جديدة'}
        dirty={dirty}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button loading={save.isPending} onClick={() => editing && save.mutate(editing)}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={() => confirmDiscard(dirty) && setEditing(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        {editing && (
          <>
            <Field label="الاسم" required>
              <Input value={editing.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
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
                  .filter((r) => r.id !== editing.id)
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
              <Field label="الرصيد الافتتاحي (د.ل)" hint="يُسجَّل كحركة افتتاحية ولا يمكن تغييره لاحقاً">
                <Input type="number" step="0.001" dir="ltr" value={editing.opening ?? ''} onChange={(e) => set({ opening: e.target.value })} />
              </Field>
            )}
            <Field label="ملاحظات">
              <Textarea value={editing.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand-600" checked={editing.is_active ?? true} onChange={(e) => set({ is_active: e.target.checked })} />
                مستخدمة
              </label>
            )}
          </>
        )}
      </SidePanel>

      <SidePanel open={statementOf !== null} title={`كشف ${statementOf?.name ?? ''}`} onClose={() => setStatementOf(null)}>
        {statementOf && <Statement treasuryId={statementOf.treasury_id!} />}
      </SidePanel>
    </div>
  )
}

function Statement({ treasuryId }: { treasuryId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['treasury_entries', treasuryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treasury_entries')
        .select('*')
        .eq('treasury_id', treasuryId)
        .order('entry_date')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
  if (isLoading) return <Spinner />
  if (error) return <ErrorState message={errorMessage(error)} />
  if (!data?.length) return <p className="text-sm text-stone-500">لا توجد حركات</p>
  let running = 0
  const lines = data.map((e) => {
    const signed = e.direction === 'in' ? Number(e.amount) : -Number(e.amount)
    running += signed
    return { ...e, signed, running }
  })
  return (
    <table className="w-full text-sm">
      <thead className="text-stone-500">
        <tr>
          <th className="py-1 text-right font-medium">التاريخ</th>
          <th className="py-1 text-right font-medium">البيان</th>
          <th className="py-1 text-left font-medium">المبلغ</th>
          <th className="py-1 text-left font-medium">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        {lines.reverse().map((e) => (
          <tr key={e.id} className="border-t border-stone-100 align-top dark:border-stone-800">
            <td className="py-1.5 pl-3 num whitespace-nowrap">{formatDate(e.entry_date)}</td>
            <td>
              {sourceLabels[e.source_type] ?? e.source_type}
              {e.memo && e.memo !== sourceLabels[e.source_type] && <div className="text-xs text-stone-500">{e.memo}</div>}
            </td>
            <td className="text-left">
              <Money value={e.signed} />
            </td>
            <td className="text-left">
              <Money value={e.running} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
