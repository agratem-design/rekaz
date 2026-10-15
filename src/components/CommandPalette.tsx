import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { allNavItems } from '@/nav'
import { useVisibleItems } from './AppLayout'
import { cn } from './ui'

// بحث سريع بين الشاشات (Ctrl+K)
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const visible = useVisibleItems()
  const navigate = useNavigate()

  const results = useMemo(() => {
    const term = q.trim()
    return allNavItems.filter(visible).filter((i) => !term || i.label.includes(term) || (i.keywords ?? '').includes(term))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  if (!open) return null
  const go = (path: string) => {
    navigate(path)
    setQ('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              if (e.key === 'Enter' && results[active]) go(results[active].path)
            }}
            placeholder="اكتب اسم الشاشة…"
            aria-label="اسم الشاشة"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.map((item, i) => (
            <li key={item.path}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.path)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm', i === active ? 'bg-accent-soft text-brand-800 dark:text-brand-100' : 'text-ink')}
              >
                <item.icon className="size-4 text-brand-600 dark:text-brand-300" />
                <span className="flex-1 text-right">{item.label}</span>
                {item.stage && <span className="text-[10px] text-faint">قريباً</span>}
                {i === active && <CornerDownLeft className="size-3.5 text-faint" />}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-6 text-center text-sm text-muted">لا نتائج</li>}
        </ul>
      </div>
    </div>
  )
}
