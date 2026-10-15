import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FolderOpen, Palette, Save, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Checkbox, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tabs } from '@/components/ui'
import { options, storageLabels } from '@/lib/labels'
import { errorMessage, supabase, type Tables } from '@/lib/supabase'
import { todayISO } from '@/lib/format'
import { AmountBox, InfoGrid, PrintDocument, PrintTable, Signatures } from '@/print/PrintDocument'
import { defaultPrintSettings, ensurePrintFont, printFonts, resolvePrintSettings, type PrintSettings } from '@/print/printSettings'

type Settings = Tables<'company_settings'>

export function SettingsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('company')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').single()
      if (error) throw error
      return data
    },
  })
  const [form, setForm] = useState<Settings | null>(null)
  const [print, setPrint] = useState<PrintSettings>(defaultPrintSettings)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (data) {
      setForm(data)
      setPrint(resolvePrintSettings(data))
      setDirty(false)
    }
  }, [data])
  useEffect(() => ensurePrintFont(print.print_font_family), [print.print_font_family])

  const save = useMutation({
    mutationFn: async (f: Settings) => {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: f.company_name.trim(),
          tagline: f.tagline || null,
          phone: f.phone || null,
          address: f.address || null,
          logo_path: f.logo_path || null,
          signee_name: f.signee_name || null,
          signee_title: f.signee_title || null,
          storage_provider: f.storage_provider,
          google_drive_folder_url: f.google_drive_folder_url || null,
          allow_negative_treasury: f.allow_negative_treasury,
          print_settings: print,
        })
        .eq('id', f.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['company_settings'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
  if (isLoading || !form)
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )

  const upd = (patch: Partial<Settings>) => {
    setForm({ ...form, ...patch })
    setDirty(true)
  }
  const updPrint = (patch: Partial<PrintSettings>) => {
    setPrint({ ...print, ...patch })
    setDirty(true)
  }
  const text = (key: keyof Settings, label: string, ltr = false, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input dir={ltr ? 'ltr' : undefined} value={(form[key] as string) ?? ''} onChange={(e) => upd({ [key]: e.target.value } as Partial<Settings>)} />
    </Field>
  )
  const color = (key: keyof PrintSettings, label: string) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={String(print[key])} onChange={(e) => updPrint({ [key]: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-line-strong bg-surface p-1" aria-label={label} />
        <Input dir="ltr" value={String(print[key])} onChange={(e) => updPrint({ [key]: e.target.value })} className="font-mono text-xs" />
      </div>
    </Field>
  )

  return (
    <div>
      <PageHeader
        title="الإعدادات"
        description="بيانات الشركة هنا تظهر في الترويسة على كل المطبوعات"
        actions={
          <Button loading={save.isPending} onClick={() => save.mutate(form)} disabled={!form.company_name.trim()}>
            <Save className="size-4" />
            حفظ الإعدادات
          </Button>
        }
      />
      {dirty && <div className="mb-4 rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-sm text-sand-700 dark:border-sand-700 dark:bg-sand-700/15 dark:text-sand-200">لديك تعديلات لم تُحفظ بعد.</div>}
      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'company', label: 'بيانات الشركة', icon: Building2 },
          { key: 'print', label: 'تصميم الطباعة والهوية', icon: Palette },
          { key: 'files', label: 'الملفات', icon: FolderOpen },
          { key: 'rules', label: 'قواعد مالية', icon: ShieldAlert },
        ]}
      />
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
      >
        {tab === 'company' && (
          <Card className="max-w-3xl space-y-4">
            <CardHeader title="بيانات الشركة" description="الاسم الافتراضي: شركة ركاز العقارية" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم الشركة" required error={!form.company_name.trim() ? 'اسم الشركة مطلوب' : null}>
                <Input value={form.company_name} onChange={(e) => upd({ company_name: e.target.value })} />
              </Field>
              {text('tagline', 'الوصف المختصر')}
              {text('phone', 'الهاتف', true)}
              {text('address', 'العنوان')}
              {text('signee_name', 'اسم المفوض بالتوقيع')}
              {text('signee_title', 'صفة المفوض', false, 'مثل: المدير العام')}
            </div>
            {text('logo_path', 'رابط الشعار', true, 'رابط صورة مباشر (PNG أو SVG)')}
            {form.logo_path && <img src={form.logo_path} alt="الشعار" className="h-16 rounded-lg border border-line bg-white object-contain p-1" />}
          </Card>
        )}

        {tab === 'print' && (
          <div className="grid gap-5 2xl:grid-cols-[22rem_1fr]">
            <Card className="space-y-4">
              <CardHeader title="الهوية في المطبوعات" />
              <Field label="خط الطباعة">
                <Select value={print.print_font_family} onChange={(e) => updPrint({ print_font_family: e.target.value })}>
                  {printFonts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="حجم خط الجداول (نقطة)">
                <Input type="number" step="0.5" min={8} max={14} dir="ltr" value={print.print_table_font_size} onChange={(e) => updPrint({ print_table_font_size: Number(e.target.value) || 10.5 })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {color('print_section_title_color', 'العناوين والترويسة')}
                {color('print_table_header_color', 'رأس الجدول')}
                {color('print_header_text_color', 'نص رأس الجدول')}
                {color('print_table_border_color', 'الحدود')}
                {color('print_totals_bg_color', 'خلفية الإجماليات')}
                {color('print_totals_text_color', 'نص الإجماليات')}
              </div>
              <div className="space-y-2">
                <Checkbox label="إظهار الشعار" checked={print.header_show_logo} onChange={(v) => updPrint({ header_show_logo: v })} />
                <Checkbox label="إظهار الوصف المختصر" checked={print.header_show_tagline} onChange={(v) => updPrint({ header_show_tagline: v })} />
                <Checkbox label="إظهار الهاتف والعنوان" checked={print.header_show_contact} onChange={(v) => updPrint({ header_show_contact: v })} />
              </div>
              <Field label="عنوان العقد المطبوع">
                <Input value={print.contract_title_text} onChange={(e) => updPrint({ contract_title_text: e.target.value })} />
              </Field>
              <Field label="ملاحظة أسفل المستندات" hint="اختياري، مثل: هذا المستند صادر من المنظومة">
                <Input value={print.footer_note} onChange={(e) => updPrint({ footer_note: e.target.value })} />
              </Field>
              <Button variant="secondary" onClick={() => (setPrint(defaultPrintSettings), setDirty(true))}>
                استعادة الألوان الافتراضية
              </Button>
            </Card>
            <div className="min-w-0 overflow-x-auto rounded-xl border border-line bg-stone-200/60 p-4 dark:bg-stone-900">
              <div className="mb-2 text-xs text-muted">معاينة سند قبض بالإعدادات الحالية</div>
              <div className="origin-top-right scale-[0.8] sm:scale-100">
                <PrintDocument company={form} settings={print} title="سند قبض" number="125" date={todayISO()} compact>
                  <InfoGrid
                    items={[
                      { label: 'استلمنا من', value: 'زبون تجريبي', wide: true },
                      { label: 'وذلك عن', value: 'دفعة على مشروع فيلا سكنية', wide: true },
                      { label: 'طريقة الدفع', value: 'نقداً' },
                      { label: 'الخزينة', value: 'خزينة المقاولات' },
                    ]}
                  />
                  <AmountBox amount={12500.25} />
                  <PrintTable
                    columns={[
                      { label: 'البند', render: (r: { n: string; v: number }) => r.n },
                      { label: 'القيمة', align: 'end', render: (r) => r.v.toLocaleString('en-US') },
                    ]}
                    rows={[
                      { n: 'أعمال خرسانة', v: 8000 },
                      { n: 'أعمال مباني', v: 4500.25 },
                    ]}
                    totals={[{ label: 'الإجمالي', value: '12,500.25' }]}
                  />
                  <Signatures items={[{ label: 'المستلم', name: form.signee_name ?? undefined }, { label: 'الدافع' }]} />
                </PrintDocument>
              </div>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <Card className="max-w-3xl space-y-4">
            <CardHeader title="الملفات والصور" description="مكان حفظ المرفقات مثل صور الفواتير" />
            <Field label="مكان حفظ المرفقات">
              <Select value={form.storage_provider} onChange={(e) => upd({ storage_provider: e.target.value as Settings['storage_provider'] })}>
                {options(storageLabels).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.storage_provider === 'google_drive' && text('google_drive_folder_url', 'رابط مجلد Google Drive', true)}
          </Card>
        )}

        {tab === 'rules' && (
          <Card className="max-w-3xl space-y-3">
            <CardHeader title="قواعد مالية" />
            <Checkbox label="السماح بالصرف من خزينة رصيدها لا يكفي (غير مستحسن)" checked={form.allow_negative_treasury} onChange={(v) => upd({ allow_negative_treasury: v })} />
            <p className="text-xs text-muted">عند التعطيل ترفض المنظومة أي صرف يجعل رصيد الخزينة سالباً.</p>
          </Card>
        )}
        <button type="submit" hidden />
      </form>
    </div>
  )
}
