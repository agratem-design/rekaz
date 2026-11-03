import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { usePhases, useProjectsFinancials } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { askReason, Modal } from './dialog'
import { Badge, Button, Field, Input, Money, Select } from './ui'

// ───────────── قوائم الأطراف ─────────────
export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useTechnicians() {
  return useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase.from('technicians').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

type PartyTable = 'suppliers' | 'technicians'

// اختيار مورد/فني مع إضافة سريعة دون مغادرة النموذج
export function PartyPicker({
  table,
  value,
  onChange,
  error,
  disabled,
  label,
}: {
  table: PartyTable
  value: string
  onChange: (id: string) => void
  error?: string | null
  disabled?: boolean
  label?: string
}) {
  const { hasRole } = useAuth()
  const suppliers = useSuppliers()
  const techs = useTechnicians()
  const list = table === 'suppliers' ? suppliers : techs
  const [adding, setAdding] = useState(false)
  const canAdd = table === 'suppliers' ? hasRole('admin', 'accountant') : hasRole('admin', 'accountant', 'engineer', 'supervisor')
  const singular = table === 'suppliers' ? 'مورد' : 'فني'
  return (
    <>
      <Field label={label ?? (table === 'suppliers' ? 'المورد' : 'الفني')} required error={error}>
        <div className="flex gap-2">
          <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || list.isLoading} aria-invalid={Boolean(error)}>
            <option value="">{list.isLoading ? 'جارٍ التحميل…' : `— اختر ال${singular} —`}</option>
            {(list.data ?? [])
              .filter((x) => !('is_active' in x) || x.is_active || x.id === value)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
          {canAdd && !disabled && (
            <Button variant="secondary" size="icon" onClick={() => setAdding(true)} aria-label={`${singular} جديد`} title={`إضافة ${singular} جديد`}>
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      </Field>
      {adding && (
        <QuickAddParty
          table={table}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            onChange(id)
            setAdding(false)
          }}
        />
      )}
    </>
  )
}

function QuickAddParty({ table, onClose, onCreated }: { table: PartyTable; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [extra, setExtra] = useState('')
  const [touched, setTouched] = useState(false)
  const create = useMutation({
    mutationFn: async () => {
      const row = table === 'suppliers' ? { name: name.trim(), phone: phone || null, category: extra || null } : { name: name.trim(), phone: phone || null, is_active: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any).insert(row).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      toast.success('تمت الإضافة')
      qc.invalidateQueries({ queryKey: [table] })
      onCreated(id)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const submit = () => {
    setTouched(true)
    if (name.trim()) create.mutate()
  }
  return (
    <Modal
      title={table === 'suppliers' ? 'مورد جديد' : 'فني جديد'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={create.isPending} onClick={submit}>
            إضافة واختيار
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="الاسم" required error={touched && !name.trim() ? 'الاسم مطلوب' : null}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الهاتف">
            <Input dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {table === 'suppliers' && (
            <Field label="المجال">
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="حديد، إسمنت…" />
            </Field>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

// ───────────── المشروع ← المرحلة ← البند ─────────────
export function ProjectRefPicker({
  projectId,
  phaseId,
  itemId,
  onChange,
  fixedProject,
  optionalProject = true,
  error,
}: {
  projectId: string
  phaseId: string
  itemId: string
  onChange: (v: { projectId: string; phaseId: string; itemId: string }) => void
  fixedProject?: boolean
  optionalProject?: boolean
  error?: string | null
}) {
  const projects = useProjectsFinancials()
  const phases = usePhases(projectId || undefined)
  const items = useQuery({
    queryKey: ['project_items', projectId, 'picker'],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_items').select('id, name, phase_id').eq('project_id', projectId).order('order_index')
      if (error) throw error
      return data
    },
  })
  const itemList = (items.data ?? []).filter((i) => !phaseId || i.phase_id === phaseId)
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="المشروع" required={!optionalProject} error={error}>
        <Select value={projectId} disabled={fixedProject} onChange={(e) => onChange({ projectId: e.target.value, phaseId: '', itemId: '' })}>
          <option value="">{optionalProject ? '— عام (بلا مشروع) —' : '— اختر المشروع —'}</option>
          {(projects.data ?? [])
            .filter((p) => p.status !== 'cancelled' || p.id === projectId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="المرحلة">
        <Select value={phaseId} disabled={!projectId} onChange={(e) => onChange({ projectId, phaseId: e.target.value, itemId: '' })}>
          <option value="">بدون مرحلة</option>
          {(phases.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.reference_number} — {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="بند المقاولات">
        <Select value={itemId} disabled={!projectId} onChange={(e) => onChange({ projectId, phaseId: phaseId || (items.data ?? []).find((i) => i.id === e.target.value)?.phase_id || '', itemId: e.target.value })}>
          <option value="">بدون ارتباط ببند</option>
          {itemList.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

// ───────────── الإلغاء بقيد عكسي ─────────────
export function ReverseButton({ title, message, onReverse, label = 'إلغاء بقيد عكسي' }: { title: string; message?: React.ReactNode; onReverse: (reason: string) => void; label?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 hover:text-red-600"
      aria-label={label}
      title={label}
      onClick={async () => {
        const reason = await askReason({ title, message: message ?? 'يبقى السجل ظاهراً كملغى، وتُعكس حركته المالية بتاريخ اليوم. لا يمكن التراجع.', confirmLabel: 'تأكيد الإلغاء' })
        if (reason) onReverse(reason)
      }}
    >
      <Undo2 className="size-4" />
    </Button>
  )
}

export function AmountCell({ value, reversed }: { value: number | null | undefined; reversed?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end">
      <Money value={value} className="font-semibold" />
      {reversed && <Badge tone="red">ملغى</Badge>}
    </span>
  )
}

// تنفيذ دالة مالية مع رسالة الخطأ العربية
export function useRpc<A>(fn: (args: A) => PromiseLike<{ error: unknown }>, opts: { success: string; invalidate?: string[]; onDone?: () => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: A) => {
      const { error } = await fn(args)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(opts.success)
      for (const k of opts.invalidate ?? financeKeys) qc.invalidateQueries({ queryKey: [k] })
      opts.onDone?.()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export const financeKeys = [
  'purchases', 'purchase_balances', 'supplier_balances', 'supplier_payments', 'supplier', 'technician_balances', 'technician', 'technician_work', 'technician_payments',
  'expenses', 'custodies', 'transfers', 'treasuries', 'treasury_entries', 'project', 'project_financials', 'dashboard', 'client_receipts', 'client_balances', 'reports',
]
