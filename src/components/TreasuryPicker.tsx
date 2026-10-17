import { useEffect } from 'react'
import { useTreasuriesWithBalance } from '@/lib/queries'
import { formatMoney } from '@/lib/format'
import { domainLabels } from '@/lib/labels'
import type { Enums } from '@/lib/supabase'
import { Field, Select } from './ui'

// اختيار الحساب مباشرة مع مساره؛ يشمل الفروع المتداخلة دون اختيار الرئيسية أولاً.
export function TreasuryPicker({ value, onChange, domain, required, error, label = 'الخزينة' }: {
  value: string; onChange: (id: string) => void; domain?: Enums<'treasury_domain'> | null
  required?: boolean; error?: string | null; label?: string
}) {
  const { data, isLoading } = useTreasuriesWithBalance()
  const selected = (data ?? []).find((t) => t.id === value)
  const available = (data ?? []).filter((t) => (t.is_active || t.id === value) && (!domain || t.domain === domain))
  useEffect(() => {
    if (selected && domain && selected.domain !== domain) onChange('')
  }, [domain, selected?.id, selected?.domain]) // eslint-disable-line react-hooks/exhaustive-deps
  const path = (entry: NonNullable<typeof data>[number]) => {
    const names = [entry.name]
    const visited = new Set([entry.id])
    let parent = entry.parent_id
    while (parent && !visited.has(parent)) {
      visited.add(parent)
      const ancestor = (data ?? []).find((t) => t.id === parent)
      if (!ancestor) break
      names.unshift(ancestor.name)
      parent = ancestor.parent_id
    }
    return names.join(' / ')
  }
  return <Field label={label} required={required} error={error}
    hint={selected?.balance != null ? `الرصيد المتاح: ${formatMoney(selected.balance)} د.ل${domain ? ` · قطاع ${domainLabels[domain]}` : ''}` : domain ? `خزائن قطاع ${domainLabels[domain]} فقط` : 'اختر الخزينة أو الحساب المصرفي مباشرة؛ يظهر مسار الفرع بجانب اسمه.'}>
    <Select value={value} disabled={isLoading} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)}>
      <option value="">{isLoading ? 'جارٍ التحميل…' : 'اختر الخزينة أو الحساب'}</option>
      {available.map((t) => <option key={t.id} value={t.id}>{path(t)}{t.kind === 'bank' ? ' · مصرفي' : ''}{t.balance == null ? '' : ` — ${formatMoney(t.balance)} د.ل`}</option>)}
    </Select>
  </Field>
}
