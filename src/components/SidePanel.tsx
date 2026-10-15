import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, cn } from './ui'
import { ask } from './dialog'

export async function confirmDiscard(dirty?: boolean) {
  if (!dirty) return true
  return ask({
    title: 'لديك تعديلات لم تُحفظ',
    message: 'هل تريد الإغلاق دون حفظ؟ ستفقد ما كتبته في هذا النموذج.',
    confirmLabel: 'إغلاق دون حفظ',
    cancelLabel: 'متابعة التعديل',
  })
}

// لوحة جانبية للنماذج؛ تطلب تأكيداً قبل الإغلاق إذا كان في النموذج تعديل لم يُحفظ
export function SidePanel({
  open,
  title,
  description,
  dirty,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  title: string
  description?: ReactNode
  dirty?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  const panelRef = useRef<HTMLElement>(null)
  const close = async () => {
    if (await confirmDiscard(dirty)) onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // التركيز على أول حقل عند الفتح
  useEffect(() => {
    if (!open) return
    const el = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea')
    el?.focus({ preventScroll: true })
  }, [open])

  if (!open) return null
  const w = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' }[size]
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/35 animate-fade-in" onClick={close} />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={cn('side-panel flex h-full w-full flex-col bg-surface shadow-pop animate-panel-in', w)}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="إغلاق">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}
