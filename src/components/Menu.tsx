import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import { Button, cn } from './ui'

export type MenuItem = { label: string; icon?: LucideIcon; onClick: () => void; danger?: boolean; hidden?: boolean }

// قائمة إجراءات منسدلة صغيرة (⋮)
export function Menu({ items, label = 'إجراءات', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const visible = items.filter((i) => !i.hidden)
  if (!visible.length) return null
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <Button variant="ghost" size="icon" className="size-8" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MoreVertical className="size-4" />
        </Button>
      )}
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 min-w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop animate-pop-in">
          {visible.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-2', it.danger ? 'text-red-600' : 'text-ink')}
            >
              {it.icon && <it.icon className="size-4 opacity-70" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
