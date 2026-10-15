import { useEffect, useState } from 'react'
import { useTreasuriesWithBalance } from '@/lib/queries'
import { formatMoney } from '@/lib/format'
import { domainLabels } from '@/lib/labels'
import type { Enums } from '@/lib/supabase'
import { Field, Select } from './ui'

// اختيار الخزينة على مستويين كما في النظام السابق: الخزينة الرئيسية ثم الحساب/الفرع التابع لها.
// domain: قطاع المشروع؛ عمليات المشروع لا تقبل إلا خزائن قطاعه (القاعدة تفرض ذلك أيضاً)
export function TreasuryPicker({
  value,
  onChange,
  domain,
  required,
  error,
  label = 'الخزينة',
}: {
  value: string
  onChange: (id: string) => void
  domain?: Enums<'treasury_domain'> | null
  required?: boolean
  error?: string | null
  label?: string
}) {
  const { data, isLoading } = useTreasuriesWithBalance()
  const all = (data ?? []).filter((t) => t.is_active || t.id === value)
  const roots = all.filter((t) => !t.parent_id && (!domain || t.domain === domain))
  const selected = all.find((t) => t.id === value)
  const [root, setRoot] = useState<string>(selected ? (selected.parent_id ?? selected.id) : '')

  // مزامنة الخزينة الرئيسية مع القيمة القادمة من الخارج
  useEffect(() => {
    if (selected) setRoot(selected.parent_id ?? selected.id)
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // إن تغيّر القطاع وأصبحت القيمة خارجه نفرغها
  useEffect(() => {
    if (selected && domain && selected.domain !== domain) {
      onChange('')
      setRoot('')
    }
  }, [domain]) // eslint-disable-line react-hooks/exhaustive-deps

  const branches = all.filter((t) => t.id === root || t.parent_id === root)
  const bal = (b: number | null) => (b === null ? '' : ` — ${formatMoney(b)} د.ل`)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} الرئيسية`} required={required} error={error} hint={domain ? `خزائن قطاع ${domainLabels[domain]} فقط` : undefined}>
        <Select
          value={root}
          disabled={isLoading}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const r = e.target.value
            setRoot(r)
            const kids = all.filter((t) => t.parent_id === r)
            onChange(r && !kids.length ? r : '') // خزينة بلا فروع تُختار مباشرة
          }}
        >
          <option value="">{isLoading ? 'جارٍ التحميل…' : '— اختر الخزينة الرئيسية —'}</option>
          {roots.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="الحساب / الفرع" required={required}>
        <Select value={value} disabled={!root} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)}>
          <option value="">{root ? '— اختر الحساب —' : 'اختر الرئيسية أولاً'}</option>
          {branches.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === root ? `${t.name} (الرئيسية نفسها)` : t.name}
              {t.kind === 'bank' ? ' · مصرفي' : ''}
              {bal(t.balance)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
