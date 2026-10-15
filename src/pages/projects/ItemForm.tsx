import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Button, Field, Input, KeyValue, Money, Section, Select, Textarea } from '@/components/ui'
import { formatMoney } from '@/lib/format'
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
  quantity: string
  unit_price: string
  progress: string
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

// بند مقايسة: من بند عام أو جديد، بالوحدة وأبعادها (طول×عرض×ارتفاع) أو كمية مباشرة
export function ItemForm({ open, onClose, projectId, item, defaultPhase, nextOrder }: { open: boolean; onClose: () => void; projectId: string; item: Item | null; defaultPhase?: string; nextOrder: number }) {
  const qc = useQueryClient()
  const units = useUnits()
  const phases = usePhases(projectId)
  const engineers = useEngineers()
  const catalog = useCatalog()
  const [form, setForm] = useState<Form>(() => blank(defaultPhase))
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setDirty(false)
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
            quantity: String(item.quantity),
            unit_price: String(item.unit_price),
            progress: String(item.progress),
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
    if (vals.some((v) => !v || Number.isNaN(v))) return null
    return Math.round(vals.reduce((a, b) => a * b, 1) * Number(unit?.factor ?? 1) * 1000) / 1000
  }, [components, form.dims, unit?.factor])
  const quantity = computed ?? Number(form.quantity)
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
        quantity,
        unit_price: Number(form.unit_price) || 0,
        progress: Number(form.progress) || 0,
        engineer_id: form.engineer_id || null,
      }
      const { error } = item
        ? await supabase.from('project_items').update(row).eq('id', item.id)
        : await supabase.from('project_items').insert({ ...row, project_id: projectId, order_index: nextOrder })
      if (error) throw error
    },
    // المسودة تُمسح بعد نجاح الحفظ فقط (الخطأ 12 في النظام السابق)
    onSuccess: () => {
      toast.success(item ? 'تم حفظ البند' : 'تمت إضافة البند')
      for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing']) qc.invalidateQueries({ queryKey: [k] })
      onClose()
    },
    onError: (e) => toast.error(`${errorMessage(e)} — بياناتك ما زالت في النموذج`),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'اسم البند مطلوب'
    if (!(quantity >= 0) || Number.isNaN(quantity)) e.quantity = 'كمية غير صحيحة'
    if (components.length && computed === null && !form.quantity) e.quantity = 'أدخل الأبعاد أو الكمية'
    if (form.unit_price === '' || Number(form.unit_price) < 0) e.unit_price = 'سعر غير صحيح'
    const p = Number(form.progress)
    if (Number.isNaN(p) || p < 0 || p > 100) e.progress = 'بين 0 و 100'
    setErrors(e)
    if (!Object.keys(e).length) save.mutate()
  }

  return (
    <SidePanel
      open={open}
      size="lg"
      title={item ? 'تعديل بند' : 'بند مقايسة جديد'}
      description={item?.name}
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <Button loading={save.isPending} onClick={submit}>
            حفظ البند
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
        <Section title="البند">
          {!item && (
            <Field label="من البنود العامة (اختياري)" hint="يملأ الاسم والوحدة والسعر، وتُنسخ متطلبات الفنيين للبند">
              <Select
                value={form.catalog_item_id}
                onChange={(e) => {
                  const c = (catalog.data ?? []).find((x) => x.id === e.target.value)
                  set(c ? { catalog_item_id: c.id, name: c.name, unit_id: c.unit_id ?? '', unit_price: c.default_unit_price?.toString() ?? '', description: c.description ?? '' } : { catalog_item_id: '' })
                }}
              >
                <option value="">— بند جديد —</option>
                {(catalog.data ?? [])
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.default_unit_price ? ` — ${formatMoney(c.default_unit_price)} د.ل` : ''}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="اسم البند" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المرحلة">
              <Select value={form.phase_id} onChange={(e) => set({ phase_id: e.target.value })}>
                <option value="">بدون مرحلة (المشروع الرئيسي)</option>
                {(phases.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference_number} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المهندس المسؤول">
              <Select value={form.engineer_id} onChange={(e) => set({ engineer_id: e.target.value })}>
                <option value="">—</option>
                {(engineers.data ?? []).map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="الوصف">
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </Section>

        <Section title="الكمية والسعر">
          <Field label="وحدة القياس">
            <Select value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value, dims: {} })}>
              <option value="">—</option>
              {(units.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </Select>
          </Field>
          {components.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {components.map((c) => (
                <Field key={c} label={dimLabels[c] ?? c}>
                  <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={form.dims[c] ?? ''} onChange={(e) => set({ dims: { ...form.dims, [c]: e.target.value } })} />
                </Field>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`الكمية${unit ? ` (${unit.symbol})` : ''}`} required error={errors.quantity} hint={computed !== null ? 'محسوبة من الأبعاد' : undefined}>
              <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={computed !== null ? String(computed) : form.quantity} disabled={computed !== null} onChange={(e) => set({ quantity: e.target.value })} />
            </Field>
            <Field label="سعر الوحدة (د.ل)" required error={errors.unit_price}>
              <Input type="number" dir="ltr" step="0.001" min={0} inputMode="decimal" value={form.unit_price} onChange={(e) => set({ unit_price: e.target.value })} />
            </Field>
            <Field label="نسبة الإنجاز %" error={errors.progress}>
              <Input type="number" dir="ltr" step="1" min={0} max={100} value={form.progress} onChange={(e) => set({ progress: e.target.value })} />
            </Field>
          </div>
          <div className="rounded-lg bg-surface-2 px-4 py-2">
            <KeyValue label="إجمالي البند">
              <Money value={total} className="text-base font-semibold" />
            </KeyValue>
          </div>
        </Section>
        <button type="submit" hidden />
      </form>
    </SidePanel>
  )
}

function blank(phase?: string): Form {
  return { catalog_item_id: '', name: '', description: '', phase_id: phase ?? '', unit_id: '', dims: {}, quantity: '', unit_price: '', progress: '0', engineer_id: '' }
}
