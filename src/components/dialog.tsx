import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button, Field, Textarea, cn } from './ui'

// نافذة تأكيد موحدة تُستدعى كدالة: const ok = await ask({...})
// مع requireReason تعيد نص السبب (أو null عند الإلغاء)

type AskOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  requireReason?: boolean
  reasonLabel?: string
}

type Pending = AskOptions & { resolve: (v: string | boolean | null) => void }

let current: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function open(opts: AskOptions) {
  return new Promise<string | boolean | null>((resolve) => {
    current?.resolve(opts.requireReason ? null : false)
    current = { ...opts, resolve }
    emit()
  })
}

export function ask(opts: Omit<AskOptions, 'requireReason'>): Promise<boolean> {
  return open(opts) as Promise<boolean>
}

export function askReason(opts: Omit<AskOptions, 'requireReason'>): Promise<string | null> {
  return open({ ...opts, requireReason: true }) as Promise<string | null>
}

function close(value: string | boolean | null) {
  const c = current
  current = null
  emit()
  c?.resolve(value)
}

export function DialogHost() {
  const pending = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  if (!pending) return null
  return <AskDialog key={pending.title + String(pending.message)} p={pending} />
}

function AskDialog({ p }: { p: Pending }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelValue = p.requireReason ? null : false

  useEffect(() => {
    if (!p.requireReason) confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(cancelValue)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [p.requireReason, cancelValue])

  const submit = () => {
    if (p.requireReason) {
      setTouched(true)
      if (!reason.trim()) return
      close(reason.trim())
    } else close(true)
  }
  const danger = (p.tone ?? 'danger') === 'danger'

  return (
    <Modal onClose={() => close(cancelValue)} labelledBy="ask-title" size="sm">
      <div className="flex gap-3 p-5">
        <span className={cn('h-fit rounded-full p-2', danger ? 'bg-red-50 text-red-600 dark:bg-red-950/60' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/60')}>
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ask-title" className="font-semibold">
            {p.title}
          </h2>
          {p.message && <div className="mt-1 text-sm text-muted">{p.message}</div>}
          {p.requireReason && (
            <Field label={p.reasonLabel ?? 'سبب الإلغاء'} required error={touched && !reason.trim() ? 'السبب مطلوب' : null} className="mt-4">
              <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !reason.trim()} />
            </Field>
          )}
        </div>
      </div>
      <div className="flex justify-start gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={submit}>
          {p.confirmLabel ?? 'تأكيد'}
        </Button>
        <Button variant="secondary" onClick={() => close(cancelValue)}>
          {p.cancelLabel ?? 'تراجع'}
        </Button>
      </div>
    </Modal>
  )
}

// نافذة وسطية عامة
export function Modal({
  children,
  onClose,
  title,
  labelledBy,
  size = 'md',
  footer,
}: {
  children: ReactNode
  onClose: () => void
  title?: string
  labelledBy?: string
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}) {
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' }[size]
  useEffect(() => {
    if (!title) return
    // التقاط مبكر حتى لا يُغلق Escape اللوحة الجانبية التي خلف النافذة
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [title, onClose])
  return createPortal(
    <div data-modal-overlay onClick={(e) => e.stopPropagation()} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? (title ? 'modal-title' : undefined)} className={cn('flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop animate-pop-in sm:rounded-2xl', w)}>
        {title && (
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 id="modal-title" className="font-semibold">
              {title}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق">
              <X className="size-4" />
            </Button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</footer>}
      </div>
    </div>, document.body
  )
}
