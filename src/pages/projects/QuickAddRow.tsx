import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CornerDownLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUnits } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { Field, Money, cn } from '@/components/ui'
import { useCatalog } from './ItemForm'

const cell = 'h-12 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'

// سطر إضافة سريعة أسفل جدول المرحلة: اسم (مع اقتراح من البنود العامة) ← وحدة ← كمية ← سعر ← Enter
// يُحفظ في نفس المرحلة مباشرة، ويبقى التركيز على السطر لإدخال البند التالي
export function QuickAddRow({ projectId, phaseId, nextOrder }: { projectId: string; phaseId: string | null; nextOrder: number }) {
  const qc = useQueryClient()
  const catalog = useCatalog()
  const units = useUnits()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [catalogId, setCatalogId] = useState<string | null>(null)
  const [unit, setUnit] = useState('')
  const [qty, setQty] = useState('')
  const [factor, setFactor] = useState('1')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const focusAfterSave = useRef(false)
  useEffect(() => { if (!busy && focusAfterSave.current) { focusAfterSave.current = false; nameRef.current?.focus() } }, [busy])
  const [touched, setTouched] = useState(false)
  const active = (catalog.data ?? []).filter((c) => c.is_active)
  const quantity = Math.round(Number(qty) * Number(factor) * 1000) / 1000
  const total = quantity * (Number(price) || 0)

  const pickName = (v: string) => {
    setName(v)
    const c = active.find((x) => x.name === v.trim())
    setCatalogId(c?.id ?? null)
    if (c) {
      if (c.unit_id) setUnit(c.unit_id)
      if (c.default_unit_price !== null) setPrice(String(c.default_unit_price))
    }
  }

  const save = async () => {
    if (inFlight.current) return
    setTouched(true)
    if (!name.trim() || !unit || !Number.isFinite(Number(qty)) || !(Number(qty) > 0) || !(Number(factor) > 0) || !Number.isFinite(Number(factor)) || !Number.isFinite(quantity) || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return
    inFlight.current = true
    setBusy(true)
    const row = {
      project_id: projectId,
      phase_id: phaseId,
      catalog_item_id: catalogId,
      name: name.trim(),
      unit_id: unit || null,
      base_quantity: Number(qty),
      cubic_factor: Number(factor),
      quantity,
      unit_price: Number(price),
      order_index: nextOrder,
    }
    try {
      const { error } = await supabase.from('project_items').insert(row)
      if (error) throw error
      for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing']) qc.invalidateQueries({ queryKey: [k] })
      setName(''); setCatalogId(null); setQty(''); setFactor('1'); setPrice(''); setTouched(false)
      focusAfterSave.current = true
    } catch (error) {
      toast.error(`${errorMessage(error)} — البند ما زال في السطر`)
    } finally { inFlight.current = false; setBusy(false) }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (inFlight.current) return
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      setName('')
      setCatalogId(null)
      setQty('')
      setFactor('1')
      setPrice('')
      setTouched(false)
    }
  }
  const bad = (cond: boolean) => touched && cond && 'border-red-500'

  return (
    <fieldset disabled={busy} aria-busy={busy} className="m-3 min-w-0 space-y-4 rounded-2xl border border-line-strong bg-surface p-4 sm:m-5 sm:p-5" data-testid="quick-add-row">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-base font-semibold">إضافة بند للمرحلة</h3><p className="mt-1 text-xs leading-6 text-muted">أدخل البيانات واحفظ؛ يبقى السطر جاهزًا للبند التالي.</p></div></div>
      <div className="grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(5rem,1fr))]">
      <Field className="col-span-2 xl:col-span-1" label="اسم البند" required>
        <input
          ref={nameRef}
          list={'catalog-' + projectId}
          value={name}
          onChange={(e) => pickName(e.target.value)}
          onKeyDown={onKey}
          placeholder="اكتب اسم البند أو اختر من الدليل"
          aria-label="اسم البند"
          className={cn(cell, bad(!name.trim()))}
        />
        <datalist id={'catalog-' + projectId}>
          {active.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {catalogId && <span className="mt-0.5 block text-[10px] text-olive-600">من البنود العامة</span>}
      </Field>
      <Field label="الكمية" required><input type="number" dir="ltr" step="0.001" min={0} value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onKey} placeholder="الكمية" aria-label="الكمية" className={cn(cell, bad(!(Number(qty) > 0)))} />
      </Field>
      <Field label="معامل التكعيب" required><input type="number" dir="ltr" step="0.000001" min="0.000001" value={factor} onChange={(e) => setFactor(e.target.value)} onKeyDown={onKey} aria-label="معامل التكعيب" className={cn(cell, bad(!(Number(factor) > 0)))} /></Field>
      <Field label="الوحدة" required><select value={unit} onChange={(e) => setUnit(e.target.value)} onKeyDown={onKey} aria-label="الوحدة" className={cn(cell, 'px-1', bad(!unit))}>
        <option value="">الوحدة</option>
        {(units.data ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.symbol}
          </option>
        ))}
      </select></Field>
      <Field className="col-span-2 sm:col-span-1" label="سعر الوحدة" required><input type="number" dir="ltr" step="0.001" min={0} value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={onKey} placeholder="سعر الوحدة" aria-label="سعر الوحدة" className={cn(cell, bad(price === ''))} />
      </Field></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="text-sm text-muted">الكمية النهائية <bdi className="mx-2" dir="ltr">{qty || 0} × {factor || 0} = {Number.isFinite(quantity) ? quantity : 0}</bdi> · إجمالي البند <Money value={total} className="ms-3 text-lg font-semibold text-ink" /></div>
      <button type="button" onClick={save} disabled={busy} className="flex h-12 cursor-pointer items-center justify-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-sand-400 dark:text-brand-950">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownLeft className="size-3.5" />}
        حفظ (Enter)
      </button></div>
      {touched && (!name.trim() || !unit || !(Number(qty) > 0) || !Number.isFinite(Number(qty)) || !(Number(factor) > 0) || !Number.isFinite(Number(factor)) || !Number.isFinite(quantity) || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) && <p role="alert" className="col-span-full text-xs leading-6 text-red-700 dark:text-red-300">أدخل اسم البند ووحدته وكمية ومعامل تكعيب موجبين وسعراً صحيحاً صفراً أو أكثر.</p>}
    </fieldset>
  )
}
