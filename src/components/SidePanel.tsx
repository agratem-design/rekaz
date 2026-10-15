import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui'

export function confirmDiscard(dirty?: boolean) {
  if (!dirty) return true
  return window.confirm('لديك تعديلات لم تُحفظ. هل تريد الإغلاق دون حفظ؟')
}

// لوحة جانبية للنماذج؛ تطلب تأكيداً قبل الإغلاق إذا كان في النموذج تعديل لم يُحفظ
export function SidePanel({
  open,
  title,
  dirty,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  dirty?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const close = () => {
    if (!confirmDiscard(dirty)) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={close} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-stone-900">
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" className="size-8 px-0" onClick={close} aria-label="إغلاق">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="flex gap-2 border-t border-stone-200 p-4 dark:border-stone-800">{footer}</footer>}
      </aside>
    </div>
  )
}
