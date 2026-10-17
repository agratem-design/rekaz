import { useAutomaticDraft } from '@/lib/formDrafts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EntryCard, EntryDetails, EntryLayout } from '@/components/EntryWorkspace'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Button, Field, Input, KeyValue, Money, NumberWithUnit, Select, Textarea } from '@/components/ui'
import { useEngineers, usePhases, useUnits } from '@/lib/queries'
import { errorMessage, supabase, type Tables } from '@/lib/supabase'

export type Item = Tables<'project_items'>
const dimLabels: Record<string, string> = { length: 'الطول (م)', width: 'العرض (م)', height: 'الارتفاع (م)' }

type Form = {
  catalog_item_id: string
  name: string
  description: string
  phase_id: string
  unit_id: string
  dims: Record<string, string>
  cubic_factor: string
  quantity: string
  unit_price: string
  engineer_id: string
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catalog_items').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

// بند مقاولات: من بند عام أو جديد، بالوحدة وأبعادها (طول×عرض×ارتفاع) أو كمية مباشرة
export function ItemForm({ open, onClose, projectId, item, defaultPhase, nextOrder }: { open: boolean; onClose: () => void; projectId: string; item: Item | null; defaultPhase?: string; nextOrder: number }) {
  const qc = useQueryClient()
  const units = useUnits()
  const phases = usePhases(projectId)
  const engineers = useEngineers()
  const catalog = useCatalog()
  const [form, setForm] = useState<Form>(() => blank(defaultPhase))
  const nameRef = useRef<HTMLInputElement>(null)
  const continueEntry = useRef(false)
  const saving = useRef(false)
  const orderCursor = useRef(nextOrder)
  orderCursor.current = Math.max(orderCursor.current, nextOrder)
  const [savedCount, setSavedCount] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setDirty(false)
    orderCursor.current = nextOrder
    setSavedCount(0)
    setErrors({})
    setForm(
      item
        ? {
            catalog_item_id: item.catalog_item_id ?? '',
            name: item.name,
            description: item.description ?? '',
            phase_id: item.phase_id ?? '',
            unit_id: item.unit_id ?? '',
            dims: Object.fromEntries(Object.entries((item.dimensions ?? {}) as Record<string, number>).map(([k, v]) => [k, String(v)])),
            quantity: String(item.base_quantity ?? item.quantity),
            cubic_factor: String(item.cubic_factor ?? 1),
            unit_price: String(item.unit_price),
            engineer_id: item.engineer_id ?? '',
          }
        : blank(defaultPhase),
    )
  }, [open, item, defaultPhase])

  const unit = (units.data ?? []).find((u) => u.id === form.unit_id)
  const components = (unit?.components as string[] | undefined) ?? []
  const computed = useMemo(() => {
    if (!components.length) return null
    const vals = components.map((c) => Number(form.dims[c]))
    if (vals.some((v) => v <= 0 || !Number.isFinite(v))) return null
    return Math.round(vals.reduce((a, b) => a * b, 1) * Number(unit?.factor ?? 1) * 1000) / 1000
  }, [components, form.dims, unit?.factor])
  const baseQuantity = computed ?? Number(form.quantity)
  const quantity = Math.round(baseQuantity * Number(form.cubic_factor) * 1000) / 1000
  const total = Math.round((quantity || 0) * (Number(form.unit_price) || 0) * 1000) / 1000

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      const dims = components.length && computed !== null ? Object.fromEntries(components.map((c) => [c, Number(form.dims[c])])) : {}
      const row = {
        catalog_item_id: form.catalog_item_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        phase_id: form.phase_id || null,
        unit_id: form.unit_id || null,
        dimensions: dims,
        base_quantity: baseQuantity,
        cubic_factor: Number(form.cubic_factor),
        quantity,
        unit_price: Number(form.unit_price) || 0,
        engineer_id: form.engineer_id || null,
      }
      const { error } = item
        ? await supabase.from('project_items').update(row).eq('id', item.id)
        : await supabase.from('project_items').insert({ ...row, project_id: projectId, order_index: orderCursor.current })
      if (error) throw error
    },
    // المسودة تُمسح بعد نجاح الحفظ فقط (الخطأ 12 في النظام السابق)
    onSuccess: () => {
      toast.success(item ? 'تم حفظ البند' : 'تمت إضافة البند')
      for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing']) qc.invalidateQueries({ queryKey: [k] })
      if (continueEntry.current && !item) {
        orderCursor.current += 1
        setSavedCount((n) => n + 1)
        setForm((previous) => ({ ...blank(previous.phase_id), unit_id: previous.unit_id, engineer_id: previous.engineer_id }))
        setDirty(false)
        setErrors({})
        requestAnimationFrame(() => nameRef.current?.focus())
      } else onClose()
    },
    onSettled: () => { saving.current = false },
    onError: (e) => toast.error(`${errorMessage(e)} — بياناتك ما زالت في النموذج`),
  })

  const submit = (another = false) => {
    if (saving.current) return
    continueEntry.current = another
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'اسم البند مطلوب'
    if (!(Number(form.cubic_factor) > 0) || !Number.isFinite(Number(form.cubic_factor))) e.cubic_factor = 'أدخل معاملًا موجبًا'
    if (!form.unit_id) e.unit_id = 'اختر وحدة القياس'
    if (!(quantity > 0) || !Number.isFinite(quantity)) e.quantity = 'كمية غير صحيحة'
    if (components.length && computed === null && !form.quantity) e.quantity = 'أدخل الأبعاد أو الكمية'
    if (form.unit_price === '' || !Number.isFinite(Number(form.unit_price)) || Number(form.unit_price) < 0) e.unit_price = 'سعر غير صحيح'
    setErrors(e)
    if (!Object.keys(e).length) { saving.current = true; save.mutate() }
  }

  useAutomaticDraft(`item:${projectId}:${item?.id??'new'}:${defaultPhase??''}`, open, { form }, dirty, (saved) => { setForm(saved.form); setDirty(true) })

  return (
    <SidePanel open={open} workspace title={item ? 'تعديل بند' : 'إضافة بنود المرحلة'}
      description="اكتب البند والكمية والسعر. احفظ وأضف التالي دون مغادرة مساحة الإدخال."
      dirty={dirty} onClose={() => { if (!saving.current) onClose() }}
      footer={<>
        <Button loading={save.isPending} onClick={() => submit(false)}>حفظ البند</Button>
        {!item && <Button variant="secondary" disabled={save.isPending} onClick={() => submit(true)}>حفظ وإضافة التالي</Button>}
        <Button variant="ghost" disabled={save.isPending} onClick={async () => (await confirmDiscard(dirty)) && onClose()}>إلغاء</Button>
        {savedCount > 0 && <span role="status" className="text-sm text-muted">تم حفظ {savedCount} بنود في هذه الجلسة</span>}
      </>}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(!item) }}>
        <fieldset disabled={save.isPending} className="min-w-0">
          <EntryLayout summary={<div className="space-y-3">
            <p className="break-words font-semibold">{form.name || 'بند جديد'}</p>
            <p className="text-sm text-muted">{(phases.data ?? []).find((p) => p.id === form.phase_id)?.name ?? 'بدون مرحلة'}</p>
            <KeyValue label="الكمية الأصلية"><NumberWithUnit value={baseQuantity} unit={unit?.symbol} /></KeyValue>
            <KeyValue label="معامل التكعيب"><bdi dir="ltr">{form.cubic_factor}</bdi></KeyValue>
            <KeyValue label="الكمية النهائية"><NumberWithUnit value={quantity} unit={unit?.symbol} /></KeyValue>
            <KeyValue label="سعر الوحدة"><Money value={Number(form.unit_price) || 0} /></KeyValue>
            <div className="border-t border-line pt-4"><span className="text-sm text-muted">إجمالي البند</span><Money value={total} className="mt-2 block text-2xl font-semibold" /></div>
          </div>}>
            <EntryCard title="ما البند الذي تريد إضافته؟" description="اكتب اسمًا جديدًا أو اختر اقتراحًا من دليل البنود.">
              <Field label="اسم البند" required error={errors.name}>
                <Input ref={nameRef} list="item-entry-catalog" className="h-12 text-base" value={form.name} placeholder="مثال: صب خرسانة القواعد" onChange={(e) => {
                  const c = (catalog.data ?? []).find((x) => x.is_active && x.name === e.target.value)
                  set(c ? { name: c.name, catalog_item_id: c.id, unit_id: c.unit_id ?? '', unit_price: c.default_unit_price?.toString() ?? '', description: c.description ?? '' } : { name: e.target.value, catalog_item_id: '' })
                }} />
                <datalist id="item-entry-catalog">{(catalog.data ?? []).filter((c) => c.is_active).map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <Field label="المرحلة">
                <Select value={form.phase_id} onChange={(e) => set({ phase_id: e.target.value })}>
                  <option value="">بدون مرحلة (المشروع الرئيسي)</option>
                  {(phases.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference_number} — {p.name}</option>)}
                </Select>
              </Field>
            </EntryCard>
            <EntryCard title="الكمية والتسعير" description="الإجمالي يُحسب مباشرة أثناء الكتابة.">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field className="col-span-2 sm:col-span-1" label="وحدة القياس" required error={errors.unit_id}><Select value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value, dims: {} })}>
                  <option value="">اختر الوحدة</option>{(units.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                </Select></Field>
                <Field label="الكمية" required error={errors.quantity} hint={computed !== null ? 'محسوبة من الأبعاد' : undefined}>
                  <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={computed !== null ? String(computed) : form.quantity} disabled={computed !== null} onChange={(e) => set({ quantity: e.target.value })} />
                </Field>
                <Field label="معامل التكعيب" required error={errors.cubic_factor} hint="الكمية النهائية = الكمية × المعامل"><Input type="number" dir="ltr" step="0.000001" min="0.000001" inputMode="decimal" value={form.cubic_factor} onChange={(e) => set({ cubic_factor: e.target.value })} /></Field>
                <Field label="سعر الوحدة (د.ل)" required error={errors.unit_price}><Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={form.unit_price} onChange={(e) => set({ unit_price: e.target.value })} /></Field>
              </div>
              {components.length > 0 && <EntryDetails title="حساب الكمية من الأبعاد (اختياري)">
                <p className="text-xs leading-6 text-muted">يمكنك إدخال الكمية مباشرة أعلاه، أو ملء جميع الأبعاد لحسابها تلقائيًا. امسح الأبعاد للعودة إلى الكمية اليدوية.</p>
                <div className="grid gap-3 sm:grid-cols-3">{components.map((c) => <Field key={c} label={dimLabels[c] ?? c}><Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={form.dims[c] ?? ''} onChange={(e) => set({ dims: { ...form.dims, [c]: e.target.value } })} /></Field>)}</div>
              </EntryDetails>}
            </EntryCard>
            <EntryDetails title="الوصف والمهندس المسؤول (اختياري)">
              <Field label="المهندس المسؤول"><Select value={form.engineer_id} onChange={(e) => set({ engineer_id: e.target.value })}><option value="">غير محدد</option>{(engineers.data ?? []).map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}</Select></Field>
              <Field label="الوصف"><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            </EntryDetails>
          </EntryLayout>
          <button type="submit" hidden />
        </fieldset>
      </form>
    </SidePanel>
  )
}

function blank(phase?: string): Form {
  return { catalog_item_id: '', name: '', description: '', phase_id: phase ?? '', unit_id: '', dims: {}, cubic_factor: '1', quantity: '', unit_price: '', engineer_id: '' }
}
