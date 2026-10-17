import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react'
import { Button, Field, Input, cn } from './ui'
import { uploadFile, type UploadSettings } from '@/lib/fileUploads'

// شعار صغير داخل إعدادات الشركة؛ يُحفظ مع البيانات نفسها ويعمل في الطباعة والنسخ الاحتياطي.
export function CompanyLogoField({ value, onChange, onUploaded, onBusyChange, disabled, settings }: {
  value: string | null
  onChange: (value: string | null) => void
  onUploaded?: (value: string) => Promise<void>
  onBusyChange: (busy: boolean) => void
  disabled?: boolean
  settings: UploadSettings
}) {
  const input = useRef<HTMLInputElement>(null)
  const operation = useRef(0)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [broken, setBroken] = useState(false)
  const [showLink, setShowLink] = useState(false)
  useEffect(() => setBroken(false), [value])
  useEffect(() => () => { operation.current++; onBusyChange(false) }, [onBusyChange])

  const choose = async (file?: File) => {
    if (!file || disabled || busy) return
    setError('')
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    if (!isSvg && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('اختر صورة بصيغة SVG أو PNG أو JPG أو WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة أكبر من 5 ميجابايت؛ اختر صورة أصغر')
      return
    }
    const current = ++operation.current
    setBusy(true)
    onBusyChange(true)
    // بعض الأجهزة لا تحدد نوع ملف SVG؛ نمرره كصورة ونحوّله إلى PNG شفاف عالي الدقة دون إدراج XML في الصفحة.
    const url = URL.createObjectURL(isSvg ? new Blob([file], { type: 'image/svg+xml' }) : file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 24_000_000) throw new Error('اختر صورة شعار بأبعاد أصغر')
      // Keep raster bytes and transparency; SVG is rendered losslessly for Drive display.
      let prepared = file
      if (isSvg) {
        const scale = 3072 / Math.max(img.naturalWidth, img.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d', { alpha: true })
        if (!ctx) throw new Error('تعذرت معالجة الصورة؛ حاول اختيارها من جديد')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('تعذرت معالجة الصورة')), 'image/png'))
        prepared = new File([blob], 'company-logo.png', { type: 'image/png' })
      }
      const data = await uploadFile(prepared, settings, 'ركاز/هوية الشركة')
      if (current !== operation.current) return
      const preview = new Image()
      preview.src = data
      try { await preview.decode() } catch { throw new Error('تم رفع الشعار، لكن تعذر فتح رابط الصورة. لم يُستبدل الشعار المعتمد؛ تحقق من مشاركة الملف في Google Drive ثم أعد المحاولة.') }
      if (current !== operation.current) return
      if (onUploaded) await onUploaded(data)
      if (current !== operation.current) return
      onChange(data)
      setBroken(false)
      setShowLink(false)
    } catch (e) {
      if (current === operation.current) setError(e instanceof Error && e.message !== 'The source image cannot be decoded.' ? e.message : 'الملف ليس صورة صالحة؛ اختر صورة أخرى')
    } finally {
      URL.revokeObjectURL(url)
      if (current === operation.current) { setBusy(false); onBusyChange(false) }
    }
  }

  return <section aria-label="شعار الشركة" className="space-y-4 rounded-xl border border-line bg-surface-2 p-4 sm:p-5">
    <div><h3 className="font-semibold">شعار الشركة</h3><p className="mt-1 text-sm leading-7 text-muted">ارفع الشعار إلى {settings.storage_provider === 'google_drive' ? 'Google Drive' : 'مساحة التخزين'}. {onUploaded ? 'يُعتمد تلقائيًا بعد التأكد من رفعه وحفظه، ويُحدّث في الواجهة والمطبوعات.' : 'ثم احفظ الإعدادات لاعتماد الصورة.'}</p></div>
    <div className={cn('flex flex-col gap-4 rounded-xl border border-dashed p-4 transition-colors sm:flex-row sm:items-center', dragging ? 'border-brand-500 bg-accent-soft' : 'border-line-strong bg-surface')}
      onDragOver={(e) => { e.preventDefault(); if (!disabled && !busy) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void choose(e.dataTransfer.files[0]) }}>
      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-transparent p-3">
        {value && !broken ? <img src={value} alt="معاينة شعار الشركة" className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} /> : <ImagePlus className="size-9 text-stone-400" />}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-muted">{busy ? 'جارٍ تجهيز الصورة…' : broken ? 'تعذر عرض الشعار الحالي. ارفع صورة بديلة أو حدّث الرابط.' : value ? 'الشعار جاهز للمعاينة' : 'اسحب الصورة هنا أو اخترها من جهازك'}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{value ? 'تغيير الصورة' : 'رفع صورة الشعار'}</Button>
          {value && <Button variant="ghost" disabled={disabled || busy} onClick={() => { onChange(null); setError(''); setBroken(false) }}><Trash2 className="size-4" />إزالة الشعار</Button>}
        </div>
        <p className="text-xs leading-6 text-muted">SVG أو PNG أو JPG أو WebP، حتى 5 ميجابايت. تُحفظ الصور الأصلية دون تصغير أو ضغط إضافي، وتبقى الخلفية الشفافة كما هي. يُجهّز SVG للعرض بصيغة PNG شفافة عالية الدقة.</p>
      </div>
      <input ref={input} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden aria-label="ملف شعار الشركة" disabled={disabled || busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = '' }} />
    </div>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <Button variant="ghost" size="sm" aria-expanded={showLink} aria-controls="company-logo-link" disabled={disabled || busy} onClick={() => setShowLink((v) => !v)}><Link2 className="size-4" />{showLink ? 'إخفاء رابط الصورة' : 'استخدام رابط أو عرض الرابط الحالي'}</Button>
    {showLink && <div id="company-logo-link"><Field label="رابط صورة الشعار" hint={value?.startsWith('data:') ? 'الشعار الحالي صورة مرفوعة. أدخل رابطاً فقط إذا أردت استبدالها.' : 'اختياري: أدخل رابط صورة مباشر بدلاً من رفع ملف'}><Input type="url" dir="ltr" placeholder="https://example.com/logo.png" value={value?.startsWith('data:') ? '' : value ?? ''} disabled={disabled || busy} onChange={(e) => { onChange(e.target.value || null); setError('') }} /></Field></div>}
  </section>
}
