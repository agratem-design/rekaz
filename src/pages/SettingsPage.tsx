import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FolderOpen, Palette, Save, ShieldAlert, Type } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Checkbox, ErrorState, Field, Input, Money, PageHeader, Select, Skeleton, Tabs } from '@/components/ui'
import { options, storageLabels } from '@/lib/labels'
import { errorMessage, supabase, type Tables } from '@/lib/supabase'
import { googleUploadUrl, uploadFile, validGoogleUploadUrl, validImageUrl } from '@/lib/fileUploads'
import { todayISO } from '@/lib/format'
import { defaultInterfaceTypography, interfaceFonts, resolveInterfaceTypography, type InterfaceTypography } from '@/lib/interfaceTypography'
import type { Json } from '@/lib/database.types'
import { CompanyLogoField } from '@/components/CompanyLogoField'
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
  const [typography, setTypography] = useState<InterfaceTypography>(defaultInterfaceTypography)
  const [dirty, setDirty] = useState(false)
  const [uploadScript, setUploadScript] = useState('')
  const [uploadTest, setUploadTest] = useState({busy:false,url:'',error:''})
  const [logoBusy, setLogoBusy] = useState(false)
  useEffect(() => {
    if (data && !dirty) {
      setForm(data)
      setPrint(resolvePrintSettings(data))
      setTypography(resolveInterfaceTypography(data.print_settings))
      setUploadScript(googleUploadUrl(data))
      setDirty(false)
    }
  }, [data, dirty])
  useEffect(() => ensurePrintFont(print.print_font_family), [print.print_font_family])
  useEffect(() => { ensurePrintFont(typography.ui_font_family); ensurePrintFont(typography.ui_heading_font_family) }, [typography.ui_font_family, typography.ui_heading_font_family])

  const save = useMutation({
    mutationFn: async (f: Settings) => {
      if (!f.company_name.trim()) throw new Error('اسم الشركة مطلوب')
      if (['ui_primary_color','ui_dark_background','ui_dark_surface','ui_dark_accent','ui_light_background'].some((key) => !/^#[0-9a-f]{6}$/i.test(String(typography[key as keyof InterfaceTypography])))) throw new Error('أدخل الألوان بصيغة صحيحة مثل #704b32')
      if (f.storage_provider === 'google_drive' && uploadScript && !validGoogleUploadUrl(uploadScript)) throw new Error('رابط سكريبت Google غير صحيح؛ استخدم رابط النشر المنتهي بـ /exec')
      if (logoBusy) throw new Error('انتظر اكتمال تجهيز الصورة')
      const logo = f.logo_path?.trim() || null
      if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) {
        if (!validImageUrl(logo)) throw new Error('رابط الشعار ناقص أو غير صحيح؛ أدخل الرابط الكامل أو ارفع الصورة من جهازك')
      }
      const { data: saved, error } = await supabase
        .from('company_settings')
        .update({
          company_name: f.company_name.trim(),
          tagline: f.tagline || null,
          phone: f.phone || null,
          address: f.address || null,
          logo_path: logo,
          signee_name: f.signee_name || null,
          signee_title: f.signee_title || null,
          storage_provider: f.storage_provider,
          google_drive_folder_url: f.google_drive_folder_url || null,
          allow_negative_treasury: f.allow_negative_treasury,
          print_settings: { ...(f.print_settings && typeof f.print_settings === 'object' && !Array.isArray(f.print_settings) ? f.print_settings : {}), ...print, ...typography, google_drive_script_url: uploadScript.trim() } as Json,
        })
        .eq('id', f.id)
        .select('*')
        .single()
      if (error) throw error
      return saved
    },
    onSuccess: (saved) => {
      toast.success('تم حفظ الإعدادات')
      setDirty(false)
      qc.setQueryData(['company_settings'], saved)
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
    setForm((current) => current ? { ...current, ...patch } : current)
    setDirty(true)
  }
  const updPrint = (patch: Partial<PrintSettings>) => {
    setPrint((current) => ({ ...current, ...patch }))
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="الإعدادات"
        description="بيانات الشركة هنا تظهر في الترويسة على كل المطبوعات"

      />
      {dirty && <div className="mb-4 rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-sm text-sand-700 dark:border-sand-700 dark:bg-sand-700/15 dark:text-sand-200">لديك تعديلات لم تُحفظ بعد.</div>}
      <Tabs
        active={tab}
        onChange={(value) => { if (logoBusy || uploadTest.busy) { toast.info('انتظر اكتمال الرفع أولاً'); return } setTab(value) }}
        items={[
          { key: 'company', label: 'بيانات الشركة', icon: Building2 },
          { key: 'interface', label: 'مظهر الواجهة', icon: Type },
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
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]"><Card className="space-y-5">
            <CardHeader title="بيانات الشركة" description="الاسم وبيانات التواصل والتوقيع المعتمدة في الفواتير والسندات والعقود" />
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
            <section className="space-y-4 rounded-xl border border-line bg-surface-2 p-4" aria-label="إعدادات المحاسب">
              <div><h3 className="font-semibold">المحاسب في المطبوعات</h3><p className="mt-1 text-sm leading-6 text-muted">يظهر الاسم في الفواتير والسندات والعقود والتقارير حسب المكان الذي تختاره. ترك الاسم فارغًا يخفيه.</p></div>
              <Field label="اسم المحاسب"><Input value={print.accountant_name} onChange={(e) => updPrint({ accountant_name: e.target.value })} placeholder="اسم المحاسب المعتمد" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="مكان ظهور المحاسب"><Select value={print.accountant_position} onChange={(e) => updPrint({ accountant_position: e.target.value as PrintSettings['accountant_position'] })}>
                  <option value="header">أعلى المستند بعد الترويسة</option><option value="footer">أسفل المستند مع خانة التوقيع</option><option value="hidden">عدم الإظهار</option>
                </Select></Field>
                <Field label="محاذاة المحاسب"><Select value={print.accountant_align} disabled={print.accountant_position === 'hidden'} onChange={(e) => updPrint({ accountant_align: e.target.value as PrintSettings['accountant_align'] })}>
                  <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                </Select></Field>
              </div>
              <div aria-label="معاينة موضع المحاسب" className="rounded-lg border border-line bg-surface p-4">
                <p className="mb-3 text-xs text-muted">معاينة الموضع — تُطبق بعد حفظ الإعدادات</p>
                <div className="border-b border-line pb-2 text-center text-xs text-muted">ترويسة المستند</div>
                {print.accountant_position === 'header' && print.accountant_name.trim() && <p style={{textAlign:print.accountant_align}} className="my-3 text-sm">المحاسب: {print.accountant_name}</p>}
                <div className="py-5 text-center text-xs text-faint">محتوى المستند</div>
                {print.accountant_position === 'footer' && print.accountant_name.trim() && <div style={{textAlign:print.accountant_align}}><div className="inline-block min-w-32 text-center text-sm"><p>المحاسب</p><p className="font-semibold">{print.accountant_name}</p><div className="mt-5 border-t border-line-strong pt-1 text-xs text-muted">التوقيع</div></div></div>}
                {(print.accountant_position === 'hidden' || !print.accountant_name.trim()) && <p className="text-center text-xs text-muted">المحاسب مخفي في المطبوعات</p>}
              </div>
            </section>
            <CompanyLogoField settings={{...form,print_settings:{google_drive_script_url:uploadScript}}} value={form.logo_path} onBusyChange={setLogoBusy} disabled={save.isPending}
              onUploaded={async (logo_path) => {
                const latest = await supabase.from('company_settings').select('*').eq('id', form.id).single()
                if (latest.error) throw new Error(`تم رفع الشعار، لكن تعذر قراءة الإعدادات لاعتماده: ${errorMessage(latest.error)}`)
                const existing = latest.data.print_settings
                const result = await supabase.from('company_settings').update({ logo_path, print_settings: { ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}), header_show_logo: true } }).eq('id', form.id).select('*').single()
                if (result.error) throw new Error(`تم رفع الشعار، لكن لم يُحفظ اعتماده: ${errorMessage(result.error)}. الشعار السابق ما زال معتمدًا.`)
                setForm((current) => current ? { ...current, logo_path } : current)
                setPrint((current) => ({ ...current, header_show_logo: true }))
                qc.setQueryData(['company_settings'], result.data)
                toast.success('تم رفع الشعار واعتماده في الواجهة والمطبوعات')
              }}
              onChange={(logo_path) => { setForm((current) => current ? { ...current, logo_path } : current); if (logo_path) setPrint((current) => ({ ...current, header_show_logo: true })); if (!logo_path || logo_path !== qc.getQueryData<Settings>(['company_settings'])?.logo_path) setDirty(true) }} />
          </Card>
          <Card className="space-y-5 xl:sticky xl:top-5"><CardHeader title="معاينة هوية الشركة" description="تأكد من وضوح الشعار والبيانات قبل الحفظ" />
            <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-5 text-center">
              <div className="mx-auto flex size-24 items-center justify-center rounded-2xl border border-line bg-transparent p-3">{form.logo_path ? <img src={form.logo_path} alt="شعار الشركة في بطاقة المعاينة" className="max-h-full max-w-full object-contain" /> : <Building2 className="size-9 text-stone-400" />}</div>
              <h3 className="font-display text-lg font-semibold">{form.company_name || 'اسم الشركة'}</h3>
              <p className="text-sm leading-7 text-muted">{form.tagline || 'الوصف المختصر للشركة'}</p>
              {(form.phone || form.address) && <div className="space-y-2 border-t border-line pt-4 text-sm leading-7 text-muted">{form.phone && <p className="num">{form.phone}</p>}{form.address && <p>{form.address}</p>}</div>}
            </div>
            <div className="rounded-xl bg-accent-soft p-4 text-sm leading-7"><p className="font-semibold text-accent">بيانات موحدة في مستنداتك</p><p className="mt-1 text-muted">تظهر بيانات الشركة والشعار في ترويسة الفواتير والسندات والعقود. يمكن ضبط خط المطبوعات وألوانها من قسم تصميم الطباعة.</p></div>
          </Card></div>
        )}

        {tab === 'interface' && <Card className="space-y-5">
          <CardHeader title="ألوان وخطوط واجهة المنظومة" description="هوية سوداء وبنية متناسقة مع الشعار. تحكّم في الألوان والخطوط وحجم العرض، ثم احفظ لتطبيقها. إعدادات المطبوعات مستقلة." />
          <div className="grid gap-4 sm:grid-cols-2">{([['ui_primary_color','البني الأساسي والأزرار'],['ui_dark_background','خلفية الوضع الداكن'],['ui_dark_surface','بطاقات الوضع الداكن'],['ui_dark_accent','لون التمييز في الوضع الداكن'],['ui_light_background','خلفية الوضع الفاتح']] as const).map(([key,label]) => <Field key={key} label={label}><div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2"><input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(typography[key]) ? typography[key] : String(defaultInterfaceTypography[key])} onInput={(e)=>{setTypography({...typography,[key]:e.currentTarget.value});setDirty(true)}} onChange={(e)=>{setTypography({...typography,[key]:e.target.value});setDirty(true)}} className="h-10 w-14 cursor-pointer rounded-md bg-transparent" /><Input dir="ltr" aria-label={`${label} - القيمة`} value={typography[key]} maxLength={7} onChange={(e)=>{setTypography({...typography,[key]:e.target.value});setDirty(true)}} /></div></Field>)}</div>
          <div className="rounded-xl border p-5" aria-label="معاينة ألوان الواجهة" style={{background:typography.ui_dark_background,borderColor:typography.ui_primary_color,color:'#f8f0e6'}}><div className="rounded-xl p-4" style={{background:typography.ui_dark_surface}}><p style={{color:typography.ui_dark_accent}} className="font-semibold">هوية ركاز · الأسود والبني</p><p className="mt-2 text-sm">معاينة الخلفية والبطاقات ولون التمييز</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="خط النصوص والقوائم"><Select value={typography.ui_font_family} onChange={(e) => { setTypography({ ...typography, ui_font_family: e.target.value }); setDirty(true) }}>{interfaceFonts.map((font) => <option key={font} value={font}>{font}</option>)}</Select></Field>
            <Field label="خط عناوين الواجهة"><Select value={typography.ui_heading_font_family} onChange={(e) => { setTypography({ ...typography, ui_heading_font_family: e.target.value }); setDirty(true) }}>{interfaceFonts.map((font) => <option key={font} value={font}>{font}</option>)}</Select></Field>
            <Field label="حجم عرض الواجهة"><Select value={String(typography.ui_font_scale)} onChange={(e) => { setTypography({ ...typography, ui_font_scale: Number(e.target.value) }); setDirty(true) }}><option value="90">صغير · 90%</option><option value="100">افتراضي · 100%</option><option value="110">كبير · 110%</option><option value="115">أكبر · 115%</option></Select></Field>
          </div>
          <div aria-label="معاينة خطوط الواجهة" className="space-y-4 rounded-xl border border-line bg-surface-2 p-5" style={{fontFamily:`"${typography.ui_font_family}", sans-serif`,fontSize:`${typography.ui_font_scale}%`}}>
            <p style={{fontFamily:`"${typography.ui_heading_font_family}", sans-serif`,fontSize:'1.5em',fontWeight:700}}>مشروعك وحساباتك بوضوح</p>
            <p style={{fontSize:'1em',lineHeight:1.9}}>إدخال البنود، حساب مستحقات الفنيين، وتسجيل فواتير الموردين وسدادها.</p>
            <div className="rounded-lg border border-line bg-surface p-3" style={{fontSize:'1em'}}>قيمة الفاتورة <Money value={12500.150} /></div>
          </div>
          <p className="text-xs leading-6 text-muted">يحتاج تحميل خط جديد إلى اتصال بالإنترنت. عند تعذر تحميله تُستخدم الخطوط البديلة المتاحة.</p>
          <Button variant="secondary" onClick={() => { setTypography(defaultInterfaceTypography); setDirty(true) }}>استعادة ألوان وخطوط الواجهة الافتراضية</Button>
        </Card>}

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
              <Button variant="secondary" onClick={() => (setPrint({ ...defaultPrintSettings, accountant_name: print.accountant_name, accountant_position: print.accountant_position, accountant_align: print.accountant_align }), setDirty(true))}>
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
          <Card className="mx-auto max-w-4xl space-y-4">
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
            {form.storage_provider === 'google_drive' && <div className="space-y-4">
              <div className="rounded-xl bg-accent-soft p-4 text-sm leading-7"><p className="font-semibold text-accent">رفع مباشر إلى Google Drive</p><p className="mt-1 text-muted">يُستخدم سكريبت رفع مستقل عن التقويم. تُرسل له بيانات الملف والاسم والنوع والمجلد، ثم تحفظ المنظومة رابط الملف الذي يرجعه.</p></div>
              <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">إظهار أو تعديل رابط سكريبت الرفع</summary><div className="mt-3"><Field label="رابط نشر سكريبت Google Drive" hint="رابط تطبيق الويب المنتهي بـ /exec؛ احفظ الإعدادات بعد إدخاله"><Input dir="ltr" type="url" value={uploadScript} onChange={(e)=>{setUploadScript(e.target.value);setDirty(true)}} placeholder="https://script.google.com/macros/s/.../exec" /></Field></div></details>
              <Button variant="secondary" loading={uploadTest.busy} disabled={!validGoogleUploadUrl(uploadScript)} onClick={async()=>{
                setUploadTest({busy:true,url:'',error:''})
                try { const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const url=await uploadFile(new File([bytes],'rekaz-connection-test.png',{type:'image/png'}),{...form,print_settings:{google_drive_script_url:uploadScript}},'ركاز/اختبار الاتصال');setUploadTest({busy:false,url,error:''}) } catch(e) {setUploadTest({busy:false,url:'',error:errorMessage(e)})}
              }}>اختبار الرفع إلى Google Drive</Button>
              <p className="text-xs leading-6 text-muted">يرفع الاختبار صورة صغيرة إلى مجلد «ركاز/اختبار الاتصال». سكريبتك يتيح فتح الملفات لمن لديه الرابط.</p>
              {uploadTest.error && <p role="alert" className="text-sm leading-7 text-red-700 dark:text-red-300">{uploadTest.error}</p>}
              {uploadTest.url && <div role="status" className="rounded-lg bg-olive-50 p-3 text-sm text-olive-800"><p>نجح الرفع وأعاد Google Drive رابط الملف.</p><a className="underline" href={uploadTest.url} target="_blank" rel="noopener noreferrer">فتح صورة الاختبار</a></div>}
              <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">إظهار أو تعديل رابط مجلد Google Drive (اختياري)</summary><div className="mt-3">{text('google_drive_folder_url', 'رابط مجلد Google Drive', true, 'رابط مرجعي للمجلد؛ جذر الحفظ الفعلي يحدده MAIN_FOLDER_ID داخل سكريبت الرفع')}</div></details>
            </div>}

          </Card>
        )}

        {tab === 'rules' && (
          <Card className="mx-auto max-w-4xl space-y-3">
            <CardHeader title="قواعد مالية" />
            <Checkbox label="السماح بالصرف من خزينة رصيدها لا يكفي (غير مستحسن)" checked={form.allow_negative_treasury} onChange={(v) => upd({ allow_negative_treasury: v })} />
            <p className="text-xs text-muted">عند التعطيل ترفض المنظومة أي صرف يجعل رصيد الخزينة سالباً.</p>
          </Card>
        )}
        <button type="submit" hidden />
      </form>
      <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop">
        <p role="status" className="text-sm text-muted">{logoBusy ? 'جارٍ تجهيز صورة الشعار…' : dirty ? 'التغييرات جاهزة للمعاينة وتحتاج إلى الحفظ' : 'جميع الإعدادات محفوظة'}</p>
        <Button loading={save.isPending} disabled={!dirty || logoBusy || !form.company_name.trim()} onClick={() => save.mutate(form)}><Save className="size-4" />حفظ الإعدادات</Button>
      </div>
    </div>
  )
}
