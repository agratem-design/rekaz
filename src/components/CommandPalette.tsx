import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { allNavItems } from '@/nav'
import { useVisibleItems } from './AppLayout'
import { cn } from './ui'

// بحث سريع بين الشاشات (Ctrl+K)؛ يتوسع لاحقاً ليشمل المشاريع والأطراف
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const visible = useVisibleItems()
  const navigate = useNavigate()

  const results = useMemo(
    () => allNavItems.filter(visible).filter((i) => i.label.includes(q.trim())),
    [q, visible],
  )

  if (!open) return null
  const go = (path: string) => {
    navigate(path)
    setQ('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-stone-900" onClick={(e) => e.stopPropagation()}>
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
          className="w-full border-b border-stone-200 bg-transparent px-4 py-3 outline-none dark:border-stone-800"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {results.map((item, i) => (
            <li key={item.path}>
              <button
                onClick={() => go(item.path)}
                className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm', i === active && 'bg-stone-100 dark:bg-stone-800')}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-4 text-center text-sm text-stone-500">لا نتائج</li>}
        </ul>
      </div>
    </div>
  )
}
