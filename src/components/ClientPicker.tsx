import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { useClientsList } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { Modal } from './dialog'
import { Button, Field, Input, Select } from './ui'

// اختيار زبون مع إضافة سريعة دون مغادرة النموذج (SPEC 7)
export function ClientPicker({ value, onChange, error, disabled, required = true }: { value: string; onChange: (id: string) => void; error?: string | null; disabled?: boolean; required?: boolean }) {
  const { hasRole } = useAuth()
  const { data, isLoading } = useClientsList()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <Field label="الزبون" required={required} error={error}>
        <div className="flex gap-2">
          <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || isLoading} aria-invalid={Boolean(error)}>
            <option value="">{isLoading ? 'جارٍ التحميل…' : '— اختر الزبون —'}</option>
            {(data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {hasRole('admin', 'accountant') && !disabled && (
            <Button variant="secondary" size="icon" onClick={() => setAdding(true)} aria-label="زبون جديد" title="زبون جديد">
              <UserPlus className="size-4" />
            </Button>
          )}
        </div>
      </Field>
      {adding && (
        <QuickAddClient
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

function QuickAddClient({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [touched, setTouched] = useState(false)
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('clients').insert({ name: name.trim(), phone: phone || null, city: city || null }).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: (id) => {
      toast.success('تمت إضافة الزبون')
      qc.invalidateQueries({ queryKey: ['clients'] })
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
      title="زبون جديد"
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
        <Field label="اسم الزبون" required error={touched && !name.trim() ? 'الاسم مطلوب' : null}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الهاتف">
            <Input dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="المدينة">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
