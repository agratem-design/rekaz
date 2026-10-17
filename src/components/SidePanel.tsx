import { createPortal } from 'react-dom'
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
  workspace = false,
}: {
  open: boolean
  title: string
  description?: ReactNode
  dirty?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  workspace?: boolean
}) {
  const panelRef = useRef<HTMLElement>(null)
  const close = async () => {
    if (await confirmDiscard(dirty)) onClose()
  }

  useEffect(() => {
    if (!open) return
    // عند تراكب لوحتين يُغلق Escape العليا فقط
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-modal-overlay]')) return
      const panels = document.querySelectorAll('aside.side-panel')
      if (panels[panels.length - 1] !== panelRef.current) return
      if (e.key === 'Tab') {
        const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0)
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        return
      }
      if (e.key !== 'Escape') return
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // التركيز على أول حقل عند الفتح
  useEffect(() => {
    if (!open) return
    const el = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
    const previous = document.activeElement as HTMLElement | null
    el?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [open])

  if (!open) return null
  const w = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' }[size]
  return createPortal(
    <div dir="rtl" className={cn('fixed inset-0 z-50 flex', workspace && 'items-center justify-center bg-black/55 sm:p-5')} onClick={(e) => e.stopPropagation()}>
      {!workspace && <div className="min-w-0 flex-1 bg-black/35 animate-fade-in" onClick={close} />}
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={cn('side-panel flex h-full w-full min-w-0 shrink-0 flex-col bg-surface shadow-pop motion-safe:animate-panel-in', workspace ? 'entry-workspace max-w-6xl sm:max-h-[94dvh] sm:rounded-2xl sm:border sm:border-line' : w)}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="إغلاق">
            <X className="size-4" />
          </Button>
        </header>
        <div className={cn('min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5', workspace && 'bg-surface-2 sm:px-8 sm:py-6')}>{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">{footer}</footer>}
      </aside>
    </div>, document.body
  )
}
