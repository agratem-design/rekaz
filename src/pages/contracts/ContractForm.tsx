import { useAutomaticDraft } from '@/lib/formDrafts'
import { EntryCard as Section } from '@/components/EntryWorkspace'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { ClientPicker } from '@/components/ClientPicker'
import { Button, Field, Input, Money, Select, Textarea } from '@/components/ui'
import { contractStatusLabels, options } from '@/lib/labels'
import { useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase, type Enums, type Tables } from '@/lib/supabase'
import { useCatalog } from '../projects/ItemForm'

type Contract = Tables<'contracts'>
type Line = { name: string; quantity: string; unit_price: string; project_item_id: string }
type Clause = { title: string; content: string }
type Form = {
  title: string
  contract_number: string
  client_id: string
  project_id: string
  phase_id: string
  status: Enums<'contract_status'>
  amount: string
  start_date: string
  end_date: string
  payment_terms: string
  description: string
  notes: string
}

const blank = (clientId = '', projectId = ''): Form => ({
  title: '',
  contract_number: '',
  client_id: clientId,
  project_id: projectId,
  phase_id: '',
  status: 'draft',
  amount: '',
  start_date: '',
  end_date: '',
  payment_terms: '',
  description: '',
  notes: '',
})

export function ContractForm({ open, onClose, contract, projectId, clientId }: { open: boolean; onClose: () => void; contract: Contract | null; projectId?: string; clientId?: string }) {
  const qc = useQueryClient()
  const projects = useProjectsFinancials()
  const catalog = useCatalog()
  const [form, setForm] = useState<Form>(() => blank(clientId, projectId))
  const [lines, setLines] = useState<Line[]>([])
  const [clauses, setClauses] = useState<Clause[]>([])
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const projectItems = useQuery({
    queryKey: ['project_items', form.project_id],
    enabled: Boolean(form.project_id),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_items').select('id, name, quantity, unit_price').eq('project_id', form.project_id).order('order_index')
      if (error) throw error
      return data
    },
  })

  // تحميل العقد وبنوده وشروطه عند فتح التعديل
  useEffect(() => {
    if (!open) return
    setDirty(false)
    setErrors({})
    if (!contract) {
      setForm(blank(clientId, projectId))
      setLines([])
      setClauses([])
      return
    }
    setForm({
      title: contract.title,
      contract_number: contract.contract_number ?? '',
      client_id: contract.client_id,
      project_id: contract.project_id ?? '',
      phase_id: contract.phase_id ?? '',
      status: contract.status,
      amount: String(contract.amount ?? ''),
      start_date: contract.start_date ?? '',
      end_date: contract.end_date ?? '',
      payment_terms: contract.payment_terms ?? '',
      description: contract.description ?? '',
      notes: contract.notes ?? '',
    })
    Promise.all([
      supabase.from('contract_items').select('*').eq('contract_id', contract.id).order('order_index'),
      supabase.from('contract_clauses').select('*').eq('contract_id', contract.id).order('order_index'),
    ]).then(([i, c]) => {
      setLines((i.data ?? []).map((x) => ({ name: x.name, quantity: String(x.quantity), unit_price: String(x.unit_price), project_item_id: x.project_item_id ?? '' })))
      setClauses((c.data ?? []).map((x) => ({ title: x.title, content: x.content })))
    })
  }, [open, contract, clientId, projectId])

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
  }
  const setLine = (i: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
    setDirty(true)
  }
  const setClause = (i: number, patch: Partial<Clause>) => {
    setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
    setDirty(true)
  }
  const linesTotal = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)

  const loadTemplates = async () => {
    const { data, error } = await supabase.from('clause_templates').select('*').eq('is_active', true).order('order_index')
    if (error) return toast.error(errorMessage(error))
    if (!data.length) return toast.info('لا توجد قوالب شروط مفعّلة')
    setClauses((cs) => [...cs, ...data.map((t) => ({ title: t.title, content: t.content }))])
    setDirty(true)
    toast.success(`تم تحميل ${data.length} شرط من القوالب`)
  }

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        title: form.title.trim(),
        contract_number: form.contract_number.trim() || null,
        client_id: form.client_id,
        project_id: form.project_id || null,
        phase_id: null,
        status: form.status,
        amount: Number(form.amount) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        payment_terms: form.payment_terms.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      }
      let id = contract?.id
      if (id) {
        const { error } = await supabase.from('contracts').update(row).eq('id', id)
        if (error) throw error
        const d1 = await supabase.from('contract_items').delete().eq('contract_id', id)
        if (d1.error) throw d1.error
        const d2 = await supabase.from('contract_clauses').delete().eq('contract_id', id)
        if (d2.error) throw d2.error
      } else {
        const { data, error } = await supabase.from('contracts').insert(row).select('id').single()
        if (error) throw error
        id = data.id
      }
      const items = lines
        .filter((l) => l.name.trim())
        .map((l, i) => ({ contract_id: id!, name: l.name.trim(), quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0, project_item_id: l.project_item_id || null, order_index: i }))
      if (items.length) {
        const r = await supabase.from('contract_items').insert(items)
        if (r.error) throw r.error
      }
      const cls = clauses.filter((c) => c.title.trim() && c.content.trim()).map((c, i) => ({ contract_id: id!, title: c.title.trim(), content: c.content.trim(), order_index: i }))
      if (cls.length) {
        const r = await supabase.from('contract_clauses').insert(cls)
        if (r.error) throw r.error
      }
    },
    onSuccess: () => {
      toast.success(contract ? 'تم تحديث العقد' : 'تم إنشاء العقد')
      for (const k of ['contracts', 'project', 'project_financials', 'dashboard', 'client']) qc.invalidateQueries({ queryKey: [k] })
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'عنوان العقد مطلوب'
    if (!form.client_id) e.client_id = 'اختر الزبون'
    if (form.amount !== '' && Number(form.amount) < 0) e.amount = 'قيمة غير صحيحة'
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'تاريخ الانتهاء قبل البدء'
    setErrors(e)
    if (!Object.keys(e).length) save.mutate()
  }

  const clientProjects = (projects.data ?? []).filter((p) => p.client_id === form.client_id)

  useAutomaticDraft(`contract:${contract?.id??'new'}`, open, { form, lines, clauses }, dirty, (saved) => { setForm(saved.form); setLines(saved.lines); setClauses(saved.clauses); setDirty(true) })

  return (
    <SidePanel
        workspace
      open={open}
      size="xl"
      title={contract ? 'تعديل العقد' : 'عقد جديد'}
      description={contract ? contract.title : 'أنشئ العقد وأضف بنوده المالية وشروطه'}
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <Button loading={save.isPending} onClick={submit}>
            {contract ? 'حفظ التعديلات' : 'حفظ العقد'}
          </Button>
          <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
            إلغاء
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Section title="بيانات العقد">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="عنوان العقد" required error={errors.title}>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثال: عقد تنفيذ الهيكل الخرساني" />
            </Field>
            <Field label="رقم العقد">
              <Input dir="ltr" value={form.contract_number} onChange={(e) => set({ contract_number: e.target.value })} placeholder="K-2026-001" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ClientPicker value={form.client_id} onChange={(id) => set({ client_id: id, project_id: '', phase_id: '' })} error={errors.client_id} disabled={Boolean(projectId)} />
            <Field label="المشروع">
              <Select value={form.project_id} disabled={!form.client_id || Boolean(projectId)} onChange={(e) => set({ project_id: e.target.value, phase_id: '' })}>
                <option value="">— بلا مشروع —</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الحالة" hint="العقد النشط أو المكتمل يصبح التزام الزبون في المقاولات">
              <Select value={form.status} onChange={(e) => set({ status: e.target.value as Form['status'] })}>
                {options(contractStatusLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="تاريخ البدء">
              <Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
            </Field>
            <Field label="تاريخ الانتهاء" error={errors.end_date}>
              <Input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="قيمة العقد (د.ل)" error={errors.amount} hint={linesTotal > 0 ? undefined : 'اتركها صفراً لتُحسب من البنود عند الطباعة'}>
              <div className="flex gap-2">
                <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
                {linesTotal > 0 && Number(form.amount) !== linesTotal && (
                  <Button variant="secondary" size="sm" className="h-9" onClick={() => set({ amount: String(Math.round(linesTotal * 1000) / 1000) })}>
                    = مجموع البنود
                  </Button>
                )}
              </div>
            </Field>
            <Field label="شروط الدفع">
              <Input value={form.payment_terms} onChange={(e) => set({ payment_terms: e.target.value })} placeholder="مثال: دفعة مقدمة 30% والباقي حسب الإنجاز" />
            </Field>
          </div>
          <Field label="التمهيد / الوصف">
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </Section>

        <Section title="بنود العقد المالية">
          {lines.map((l, i) => (
            <div key={i} className="grid min-w-0 grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_auto]">
              <Field className="col-span-2 sm:col-span-1" label={i === 0 ? 'البند' : ''}>
                <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} aria-label="اسم البند" />
              </Field>
              <Field label={i === 0 ? 'الكمية' : ''}>
                <Input type="number" dir="ltr" step="0.001" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="الكمية" />
              </Field>
              <Field label={i === 0 ? 'سعر الوحدة' : ''}>
                <Input type="number" dir="ltr" step="0.001" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} aria-label="سعر الوحدة" />
              </Field>
              <Button variant="ghost" size="icon" className="hover:text-red-600" aria-label="حذف البند" onClick={() => (setLines(lines.filter((_, j) => j !== i)), setDirty(true))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => (setLines([...lines, { name: '', quantity: '1', unit_price: '', project_item_id: '' }]), setDirty(true))}>
              <Plus className="size-3.5" />
              بند يدوي
            </Button>
            <Select
              className="h-8 w-auto max-w-56 text-xs"
              value=""
              aria-label="إضافة من البنود العامة"
              onChange={(e) => {
                const c = (catalog.data ?? []).find((x) => x.id === e.target.value)
                if (c) setLines([...lines, { name: c.name, quantity: '1', unit_price: c.default_unit_price?.toString() ?? '', project_item_id: '' }])
                setDirty(true)
              }}
            >
              <option value="">+ من البنود العامة (بسعرها)</option>
              {(catalog.data ?? [])
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            {form.project_id && (
              <Select
                className="h-8 w-auto max-w-56 text-xs"
                value=""
                aria-label="إضافة من بنود المشروع"
                onChange={(e) => {
                  const it = (projectItems.data ?? []).find((x) => x.id === e.target.value)
                  if (it) setLines([...lines, { name: it.name, quantity: String(it.quantity), unit_price: String(it.unit_price), project_item_id: it.id }])
                  setDirty(true)
                }}
              >
                <option value="">+ من بنود المشروع</option>
                {(projectItems.data ?? []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </Select>
            )}
            <span className="ms-auto text-sm text-muted">
              مجموع البنود <Money value={linesTotal} className="font-semibold text-ink" />
            </span>
          </div>
        </Section>

        <Section title="الشروط والأحكام">
          {clauses.map((c, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{i + 1}</span>
                <Input value={c.title} onChange={(e) => setClause(i, { title: e.target.value })} placeholder="عنوان المادة" aria-label="عنوان المادة" />
                <Button variant="ghost" size="icon" className="hover:text-red-600" aria-label="حذف الشرط" onClick={() => (setClauses(clauses.filter((_, j) => j !== i)), setDirty(true))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea value={c.content} onChange={(e) => setClause(i, { content: e.target.value })} placeholder="نص المادة" aria-label="نص المادة" />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => (setClauses([...clauses, { title: '', content: '' }]), setDirty(true))}>
              <Plus className="size-3.5" />
              مادة جديدة
            </Button>
            <Button variant="ghost" size="sm" onClick={loadTemplates}>
              <FileDown className="size-3.5" />
              تحميل البنود الافتراضية
            </Button>
          </div>
        </Section>

        <Section title="ملاحظات">
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="ملاحظات" />
        </Section>
        <button type="submit" hidden />
      </form>
    </SidePanel>
  )
}
