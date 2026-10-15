import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { navSections, type NavItem } from '@/nav'
import { roleLabels } from '@/lib/labels'
import { supabase } from '@/lib/supabase'
import { Button, cn } from './ui'
import { CommandPalette } from './CommandPalette'
import { useTheme } from './theme'

export function useVisibleItems() {
  const { hasRole } = useAuth()
  return (item: NavItem) => !item.roles || hasRole(...item.roles)
}

export function AppLayout() {
  const { profile, roles, signOut } = useAuth()
  const visible = useVisibleItems()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()

  const { data: company } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => (await supabase.from('company_settings').select('*').single()).data,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sidebar = (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div className="px-2 pt-1">
        <div className="text-lg font-bold text-brand-700 dark:text-brand-100">{company?.company_name ?? 'ركاز'}</div>
        {company?.tagline && <div className="text-xs text-stone-500">{company.tagline}</div>}
      </div>
      {navSections.map((section) => {
        const items = section.items.filter(visible)
        if (!items.length) return null
        return (
          <div key={section.title}>
            <div className="mb-1 px-2 text-xs font-semibold text-stone-400">{section.title}</div>
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                    isActive ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-700/20 dark:text-brand-100' : 'hover:bg-stone-100 dark:hover:bg-stone-800',
                    item.stage && 'text-stone-400',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.stage && <span className="text-[10px]">قريباً</span>}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-60 shrink-0 border-l border-stone-200 bg-white lg:block dark:border-stone-800 dark:bg-stone-900">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-30 flex lg:hidden">
          <aside className="w-64 bg-white dark:bg-stone-900">{sidebar}</aside>
          <div className="flex-1 bg-black/30" onClick={() => setMenuOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-stone-200 bg-white px-4 dark:border-stone-800 dark:bg-stone-900">
          <Button variant="ghost" className="size-9 px-0 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-stone-200 px-3 text-sm text-stone-400 dark:border-stone-700"
          >
            <Search className="size-4" />
            <span className="flex-1 text-right">بحث سريع…</span>
            <kbd className="hidden text-xs sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex-1" />
          <Button variant="ghost" className="size-9 px-0" onClick={toggle} aria-label="تبديل المظهر">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <div className="hidden text-left text-sm leading-tight sm:block">
            <div className="font-medium">{profile?.display_name}</div>
            <div className="text-xs text-stone-500">{roles.map((r) => roleLabels[r]).join('، ') || 'بلا دور'}</div>
          </div>
          <Button
            variant="ghost"
            className="size-9 px-0"
            aria-label="تسجيل الخروج"
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
