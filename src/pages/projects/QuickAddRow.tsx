import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CornerDownLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatMoney } from '@/lib/format'
import { useUnits } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { cn } from '@/components/ui'
import { useCatalog, type Item } from './ItemForm'

const cell = 'h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15'

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
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const active = (catalog.data ?? []).filter((c) => c.is_active)
  const total = (Number(qty) || 0) * (Number(price) || 0)
  const key = ['project_items', projectId]

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
    setTouched(true)
    if (!name.trim() || !(Number(qty) > 0) || price === '' || Number(price) < 0) return
    setBusy(true)
    const row = {
      project_id: projectId,
      phase_id: phaseId,
      catalog_item_id: catalogId,
      name: name.trim(),
      unit_id: unit || null,
      quantity: Number(qty),
      unit_price: Number(price),
      order_index: nextOrder,
    }
    // تحديث متفائل: يظهر البند فوراً ثم يُستبدل بالسجل الحقيقي
    const temp = { ...row, id: `temp-${Date.now()}`, total_price: Math.round(total * 1000) / 1000, progress: 0, description: null, dimensions: {}, engineer_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Item
    const prev = qc.getQueryData<Item[]>(key)
    qc.setQueryData<Item[]>(key, (old) => [...(old ?? []), temp])
    const { error } = await supabase.from('project_items').insert(row)
    setBusy(false)
    if (error) {
      qc.setQueryData(key, prev)
      toast.error(`${errorMessage(error)} — البند ما زال في السطر`)
      return
    }
    for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing']) qc.invalidateQueries({ queryKey: [k] })
    setName('')
    setCatalogId(null)
    setQty('')
    setPrice('')
    setTouched(false)
    nameRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      setName('')
      setQty('')
      setPrice('')
      setTouched(false)
    }
  }
  const bad = (cond: boolean) => touched && cond && 'border-red-500'

  return (
    <div className="grid grid-cols-2 items-start gap-2 border-t border-line bg-accent-soft/40 p-3 sm:grid-cols-[minmax(12rem,1fr)_6rem_6rem_7.5rem_auto_auto]" data-testid="quick-add-row">
      <div className="col-span-2 sm:col-span-1">
        <input
          ref={nameRef}
          list={'catalog-' + projectId}
          value={name}
          onChange={(e) => pickName(e.target.value)}
          onKeyDown={onKey}
          placeholder="إضافة سريعة: اسم البند أو اختر من البنود العامة…"
          aria-label="اسم البند"
          className={cn(cell, bad(!name.trim()))}
        />
        <datalist id={'catalog-' + projectId}>
          {active.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {catalogId && <span className="mt-0.5 block text-[10px] text-olive-600">من البنود العامة</span>}
      </div>
      <input type="number" dir="ltr" step="0.001" min={0} value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onKey} placeholder="الكمية" aria-label="الكمية" className={cn(cell, bad(!(Number(qty) > 0)))} />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} onKeyDown={onKey} aria-label="الوحدة" className={cn(cell, 'px-1')}>
        <option value="">الوحدة</option>
        {(units.data ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.symbol}
          </option>
        ))}
      </select>
      <input type="number" dir="ltr" step="0.001" min={0} value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={onKey} placeholder="سعر الوحدة" aria-label="سعر الوحدة" className={cn(cell, bad(price === ''))} />
      <div className="num flex h-9 items-center justify-end px-1 text-sm font-semibold">{total ? formatMoney(total) : '—'}</div>
      <button type="button" onClick={save} disabled={busy} className="flex h-9 items-center justify-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-sand-400 dark:text-brand-950">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownLeft className="size-3.5" />}
        حفظ (Enter)
      </button>
    </div>
  )
}
