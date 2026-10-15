import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Spinner } from '@/components/ui'
import { options, storageLabels } from '@/lib/labels'
import { errorMessage, supabase, type Tables } from '@/lib/supabase'

type Settings = Tables<'company_settings'>

export function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').single()
      if (error) throw error
      return data
    },
  })
  const [form, setForm] = useState<Settings | null>(null)
  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: async (f: Settings) => {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: f.company_name,
          tagline: f.tagline || null,
          phone: f.phone || null,
          address: f.address || null,
          logo_path: f.logo_path || null,
          signee_name: f.signee_name || null,
          signee_title: f.signee_title || null,
          storage_provider: f.storage_provider,
          google_drive_folder_url: f.google_drive_folder_url || null,
          allow_negative_treasury: f.allow_negative_treasury,
        })
        .eq('id', f.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات')
      qc.invalidateQueries({ queryKey: ['company_settings'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !form) return error ? <ErrorState message={errorMessage(error)} /> : <Spinner />
  const text = (key: keyof Settings, label: string, ltr = false) => (
    <Field label={label}>
      <Input dir={ltr ? 'ltr' : undefined} value={(form[key] as string) ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  )

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" description="بيانات الشركة هنا تظهر على كل المطبوعات" />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
      >
        <Card className="space-y-4">
          <h2 className="font-semibold">بيانات الشركة</h2>
          {text('company_name', 'اسم الشركة')}
          {text('tagline', 'الوصف المختصر')}
          {text('phone', 'الهاتف', true)}
          {text('address', 'العنوان')}
          {text('logo_path', 'رابط الشعار', true)}
          {form.logo_path && <img src={form.logo_path} alt="الشعار" className="h-16 rounded border border-stone-200 object-contain p-1" />}
          {text('signee_name', 'اسم المفوض بالتوقيع')}
          {text('signee_title', 'صفة المفوض')}
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">الملفات والصور</h2>
          <Field label="مكان حفظ المرفقات">
            <Select value={form.storage_provider} onChange={(e) => setForm({ ...form, storage_provider: e.target.value as Settings['storage_provider'] })}>
              {options(storageLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {form.storage_provider === 'google_drive' && text('google_drive_folder_url', 'رابط مجلد Google Drive', true)}
        </Card>
        <Card className="space-y-2">
          <h2 className="font-semibold">قواعد مالية</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-brand-600"
              checked={form.allow_negative_treasury}
              onChange={(e) => setForm({ ...form, allow_negative_treasury: e.target.checked })}
            />
            السماح بالصرف من خزينة رصيدها لا يكفي (غير مستحسن)
          </label>
        </Card>
        <Button type="submit" loading={save.isPending}>
          حفظ الإعدادات
        </Button>
      </form>
    </div>
  )
}
