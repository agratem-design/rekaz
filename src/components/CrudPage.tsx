import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { errorMessage, supabase, type AppRole } from '@/lib/supabase'
import { Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, Spinner, Textarea } from './ui'
import { SidePanel, confirmDiscard } from './SidePanel'

type Row = Record<string, unknown> & { id: string }

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox' | 'date'
  required?: boolean
  options?: { value: string; label: string }[]
  lookup?: string // اسم جدول تُقرأ منه الخيارات (id, name)
  hint?: string
}

export type ColumnDef = {
  key: string
  label: string
  render?: (row: Row, lookups: Record<string, Map<string, string>>) => ReactNode
}

export type CrudConfig = {
  table: string
  title: string
  singular: string
  description?: string
  columns: ColumnDef[]
  fields: FieldDef[]
  writeRoles: AppRole[]
  deleteRoles?: AppRole[]
  orderBy?: string
  searchKeys?: string[]
  defaults?: Record<string, unknown>
}

// كل الجداول الأساسية تتبع نفس النمط، فنستدعي القاعدة دون أنواع مولدة لكل جدول
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function CrudPage({ config }: { config: CrudConfig }) {
  const { hasRole } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)

  const canWrite = hasRole(...config.writeRoles)
  const canDelete = config.deleteRoles ? hasRole(...config.deleteRoles) : false

  const rows = useQuery({
    queryKey: [config.table],
    queryFn: async () => {
      const { data, error } = await db.from(config.table).select('*').order(config.orderBy ?? 'name')
      if (error) throw error
      return data as Row[]
    },
  })

  const lookupTables = useMemo(() => [...new Set(config.fields.flatMap((f) => (f.lookup ? [f.lookup] : [])))], [config.fields])
  const lookups = useQuery({
    queryKey: ['lookups', ...lookupTables],
    enabled: lookupTables.length > 0,
    queryFn: async () => {
      const out: Record<string, Map<string, string>> = {}
      for (const t of lookupTables) {
        const { data, error } = await db.from(t).select('id, name').order('name')
        if (error) throw error
        out[t] = new Map((data as { id: string; name: string }[]).map((r) => [r.id, r.name]))
      }
      return out
    },
  })
  const lk = lookups.data ?? {}

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      for (const f of config.fields) {
        let v = form[f.key]
        if (v === '' || v === undefined) v = f.type === 'checkbox' ? false : null
        if (f.type === 'number' && v !== null) v = Number(v)
        payload[f.key] = v
      }
      const q = editing === 'new' ? db.from(config.table).insert(payload) : db.from(config.table).update(payload).eq('id', (editing as Row).id)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
      qc.invalidateQueries({ queryKey: [config.table] })
      qc.invalidateQueries({ queryKey: ['lookups'] })
      setEditing(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await db.from(config.table).delete().eq('id', row.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم الحذف')
      qc.invalidateQueries({ queryKey: [config.table] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const open = (row: Row | 'new') => {
    setEditing(row)
    setDirty(false)
    setForm(row === 'new' ? { ...(config.defaults ?? {}) } : Object.fromEntries(config.fields.map((f) => [f.key, row[f.key] ?? ''])))
  }
  const set = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const keys = config.searchKeys ?? ['name']
  const filtered = (rows.data ?? []).filter((r) => {
    const q = search.trim()
    return !q || keys.some((k) => String(r[k] ?? '').includes(q))
  })

  const cell = (row: Row, col: ColumnDef): ReactNode => {
    if (col.render) return col.render(row, lk)
    const v = row[col.key]
    return v === null || v === undefined || v === '' ? '—' : String(v)
  }

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          canWrite && (
            <Button onClick={() => open('new')}>
              <Plus className="size-4" />
              إضافة {config.singular}
            </Button>
          )
        }
      />
      <Card className="p-0">
        <div className="border-b border-stone-200 p-3 dark:border-stone-800">
          <Input placeholder="بحث…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        {rows.isLoading ? (
          <Spinner />
        ) : rows.error ? (
          <div className="p-3">
            <ErrorState message={errorMessage(rows.error)} />
          </div>
        ) : !filtered.length ? (
          <EmptyState>{search ? 'لا نتائج مطابقة' : 'لا توجد سجلات بعد'}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 dark:bg-stone-800/50">
                <tr>
                  {config.columns.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                  {(canWrite || canDelete) && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/40">
                    {config.columns.map((c) => (
                      <td key={c.key} className="px-3 py-2">
                        {cell(row, c)}
                      </td>
                    ))}
                    {(canWrite || canDelete) && (
                      <td className="px-2 py-1 text-left whitespace-nowrap">
                        {canWrite && (
                          <Button variant="ghost" className="size-8 px-0" onClick={() => open(row)} aria-label="تعديل">
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            className="size-8 px-0 text-red-600"
                            aria-label="حذف"
                            onClick={() => window.confirm(`حذف «${String(row.name ?? '')}»؟`) && remove.mutate(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SidePanel
        open={editing !== null}
        title={editing === 'new' ? `إضافة ${config.singular}` : `تعديل ${config.singular}`}
        dirty={dirty}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={() => confirmDiscard(dirty) && setEditing(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          {config.fields.map((f) => (
            <FieldInput key={f.key} def={f} value={form[f.key]} onChange={(v) => set(f.key, v)} lookup={f.lookup ? lk[f.lookup] : undefined} />
          ))}
          <button type="submit" hidden />
        </form>
      </SidePanel>
    </div>
  )
}

function FieldInput({
  def,
  value,
  onChange,
  lookup,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  lookup?: Map<string, string>
}) {
  const v = (value ?? '') as string
  if (def.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-600" />
        {def.label}
      </label>
    )
  }
  let control: ReactNode
  if (def.type === 'textarea') control = <Textarea value={v} onChange={(e) => onChange(e.target.value)} />
  else if (def.type === 'select' || def.lookup) {
    const opts = def.options ?? [...(lookup ?? new Map<string, string>())].map(([value, label]) => ({ value, label }))
    control = (
      <Select value={v} onChange={(e) => onChange(e.target.value)} required={def.required}>
        <option value="">— اختر —</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  } else
    control = (
      <Input
        type={def.type === 'number' ? 'number' : def.type === 'email' ? 'email' : def.type === 'date' ? 'date' : 'text'}
        step={def.type === 'number' ? '0.001' : undefined}
        value={v}
        required={def.required}
        dir={def.type === 'number' || def.type === 'email' ? 'ltr' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  return (
    <Field label={def.label} required={def.required} hint={def.hint}>
      {control}
    </Field>
  )
}
