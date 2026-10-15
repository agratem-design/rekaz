import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CirclePause, Database, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { errorMessage, supabase, type AppRole } from '@/lib/supabase'
import { Avatar, Button, Checkbox, EmptyState, Field, FilterChips, Input, PageHeader, SearchInput, Section, Select, StatCard, Textarea } from './ui'
import { DataTable, RecordCount, type Column } from './DataTable'
import { SidePanel, confirmDiscard } from './SidePanel'
import { ask } from './dialog'

export type Row = Record<string, unknown> & { id: string }

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox' | 'date' | 'tel'
  required?: boolean
  options?: { value: string; label: string }[]
  lookup?: string // اسم جدول تُقرأ منه الخيارات (id, name)
  hint?: string
  placeholder?: string
  section?: string // عنوان مجموعة الحقول في النموذج
}

export type ColumnDef = {
  key: string
  label: string
  render?: (row: Row, lookups: Record<string, Map<string, string>>) => ReactNode
  align?: 'start' | 'end'
  hideBelow?: 'sm' | 'md' | 'lg'
}

export type CrudConfig = {
  table: string
  title: string
  singular: string
  description?: string
  icon?: LucideIcon
  avatar?: boolean // صورة بالأحرف الأولى بجانب الاسم
  columns: ColumnDef[]
  fields: FieldDef[]
  writeRoles: AppRole[]
  deleteRoles?: AppRole[]
  orderBy?: string
  searchKeys?: string[]
  defaults?: Record<string, unknown>
  detailPath?: (row: Row) => string
}

// كل الجداول الأساسية تتبع نفس النمط، فنستدعي القاعدة دون أنواع مولدة لكل جدول
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type StatusFilter = 'all' | 'active' | 'inactive'

export function CrudPage({ config }: { config: CrudConfig }) {
  const { hasRole } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const canWrite = hasRole(...config.writeRoles)
  const canDelete = config.deleteRoles ? hasRole(...config.deleteRoles) : false
  const hasStatus = config.fields.some((f) => f.key === 'is_active')
  const Icon = config.icon ?? Database

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

  const validate = () => {
    const e: Record<string, string> = {}
    for (const f of config.fields) {
      const v = form[f.key]
      if (f.required && (v === '' || v === undefined || v === null || (typeof v === 'string' && !v.trim()))) e[f.key] = `${f.label} مطلوب`
      if (f.type === 'number' && v !== '' && v !== undefined && v !== null && Number.isNaN(Number(v))) e[f.key] = 'أدخل رقماً صحيحاً'
      if (f.type === 'email' && typeof v === 'string' && v && !/^\S+@\S+\.\S+$/.test(v)) e[f.key] = 'بريد إلكتروني غير صحيح'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      for (const f of config.fields) {
        let v = form[f.key]
        if (typeof v === 'string') v = v.trim()
        if (v === '' || v === undefined) v = f.type === 'checkbox' ? false : null
        if (f.type === 'number' && v !== null) v = Number(v)
        payload[f.key] = v
      }
      const q = editing === 'new' ? db.from(config.table).insert(payload) : db.from(config.table).update(payload).eq('id', (editing as Row).id)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? `تمت إضافة ${config.singular}` : 'تم حفظ التعديلات')
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
    setErrors({})
    setForm(row === 'new' ? { ...(config.defaults ?? {}) } : Object.fromEntries(config.fields.map((f) => [f.key, row[f.key] ?? ''])))
  }
  const set = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    if (errors[key])
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
  }
  const submit = () => validate() && save.mutate()

  const all = rows.data ?? []
  const keys = config.searchKeys ?? ['name']
  const filtered = all.filter((r) => {
    const q = search.trim()
    if (q && !keys.some((k) => String(r[k] ?? '').includes(q))) return false
    if (status === 'active') return Boolean(r.is_active)
    if (status === 'inactive') return !r.is_active
    return true
  })
  const activeCount = all.filter((r) => r.is_active).length

  const columns: Column<Row>[] = config.columns.map((c, i) => ({
    key: c.key,
    label: c.label,
    align: c.align,
    hideBelow: c.hideBelow,
    render: (row: Row) => {
      const content = c.render ? c.render(row, lk) : row[c.key] === null || row[c.key] === undefined || row[c.key] === '' ? <span className="text-faint">—</span> : String(row[c.key])
      if (i === 0 && config.avatar)
        return (
          <span className="flex items-center gap-2.5 font-medium">
            <Avatar name={String(row.name ?? '')} />
            {content}
          </span>
        )
      return i === 0 ? <span className="font-medium">{content}</span> : content
    },
  }))

  // تجميع الحقول في أقسام
  const sections: { title?: string; fields: FieldDef[] }[] = []
  for (const f of config.fields) {
    const last = sections[sections.length - 1]
    if (last && last.title === f.section) last.fields.push(f)
    else sections.push({ title: f.section, fields: [f] })
  }

  const addButton = canWrite && (
    <Button onClick={() => open('new')}>
      <Plus className="size-4" />
      إضافة {config.singular}
    </Button>
  )

  return (
    <div>
      <PageHeader title={config.title} description={config.description} actions={addButton} />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Icon} label={`عدد ${config.title}`} value={<span className="num">{rows.isLoading ? '…' : all.length}</span>} />
        {hasStatus && <StatCard icon={CheckCircle2} label="نشط / مستخدم" value={<span className="num">{rows.isLoading ? '…' : activeCount}</span>} tone="blue" />}
        {hasStatus && <StatCard icon={CirclePause} label="موقوف" value={<span className="num">{rows.isLoading ? '…' : all.length - activeCount}</span>} tone="sand" />}
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        getKey={(r) => r.id}
        loading={rows.isLoading}
        error={rows.error ? errorMessage(rows.error) : null}
        onRetry={() => rows.refetch()}
        onRowClick={config.detailPath ? (r) => navigate(config.detailPath!(r)) : canWrite ? (r) => open(r) : undefined}
        rowClassName={(r) => hasStatus && !r.is_active && 'text-muted'}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder={`بحث في ${config.title}…`} />
            {hasStatus && (
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'الكل', count: all.length },
                  { value: 'active', label: 'نشط', count: activeCount },
                  { value: 'inactive', label: 'موقوف', count: all.length - activeCount },
                ]}
              />
            )}
            <div className="ms-auto">
              <RecordCount shown={filtered.length} total={all.length} />
            </div>
          </>
        }
        empty={
          search || status !== 'all' ? (
            <EmptyState title="لا نتائج مطابقة" action={<Button variant="secondary" onClick={() => (setSearch(''), setStatus('all'))}>مسح البحث</Button>}>
              جرّب كلمة أخرى أو أزل الفلتر.
            </EmptyState>
          ) : (
            <EmptyState icon={Icon} title={`لا يوجد ${config.title} بعد`} action={addButton}>
              ابدأ بإضافة أول {config.singular}.
            </EmptyState>
          )
        }
        rowActions={
          canWrite || canDelete
            ? (row) => (
                <>
                  {canWrite && (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => open(row)} aria-label="تعديل" title="تعديل">
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-red-600"
                      aria-label="حذف"
                      title="حذف"
                      onClick={async () => {
                        const ok = await ask({
                          title: `حذف «${String(row.name ?? '')}»؟`,
                          message: 'لا يمكن التراجع عن الحذف. إذا كان السجل مرتبطاً بعمليات فسترفض المنظومة حذفه.',
                          confirmLabel: 'حذف',
                        })
                        if (ok) remove.mutate(row)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

      <SidePanel
        open={editing !== null}
        title={editing === 'new' ? `إضافة ${config.singular}` : `تعديل ${config.singular}`}
        description={editing !== 'new' && editing ? String(editing.name ?? '') : undefined}
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
        <form
          className="space-y-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {sections.map((s, i) => {
            const body = (
              <div className="space-y-4">
                {s.fields.map((f) => (
                  <FieldInput key={f.key} def={f} value={form[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} lookup={f.lookup ? lk[f.lookup] : undefined} />
                ))}
              </div>
            )
            return s.title ? (
              <Section key={i} title={s.title}>
                {body}
              </Section>
            ) : (
              <div key={i}>{body}</div>
            )
          })}
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
  error,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  lookup?: Map<string, string>
  error?: string
}) {
  const v = (value ?? '') as string
  if (def.type === 'checkbox') return <Checkbox label={def.label} checked={Boolean(value)} onChange={onChange} />
  let control: ReactNode
  if (def.type === 'textarea') control = <Textarea value={v} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
  else if (def.type === 'select' || def.lookup) {
    const opts = def.options ?? [...(lookup ?? new Map<string, string>())].map(([value, label]) => ({ value, label }))
    control = (
      <Select value={v} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)}>
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
        type={def.type === 'number' ? 'number' : def.type === 'email' ? 'email' : def.type === 'date' ? 'date' : def.type === 'tel' ? 'tel' : 'text'}
        step={def.type === 'number' ? '0.001' : undefined}
        inputMode={def.type === 'number' ? 'decimal' : undefined}
        value={v}
        placeholder={def.placeholder}
        aria-invalid={Boolean(error)}
        dir={def.type === 'number' || def.type === 'email' || def.type === 'tel' ? 'ltr' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  return (
    <Field label={def.label} required={def.required} hint={def.hint} error={error}>
      {control}
    </Field>
  )
}
