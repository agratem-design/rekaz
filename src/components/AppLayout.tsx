import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { navSections, type NavItem } from '@/nav'
import { roleLabels } from '@/lib/labels'
import { supabase } from '@/lib/supabase'
import { Avatar, Button, Spinner, cn } from './ui'
import { CommandPalette } from './CommandPalette'
import { useTheme } from './theme'

export function useVisibleItems() {
  const { hasRole } = useAuth()
  return (item: NavItem) => !item.roles || hasRole(...item.roles)
}

export function useCompany() {
  return useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function AppLayout() {
  const { profile, roles, signOut } = useAuth()
  const visible = useVisibleItems()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { data: company } = useCompany()

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

  // إغلاق القائمة على الجوال عند الانتقال
  useEffect(() => setMenuOpen(false), [location.pathname])

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/'))

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-950 text-brand-100" aria-label="القائمة الرئيسية">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        {company?.logo_path ? (
          <img src={company.logo_path} alt="" className="size-9 rounded-lg bg-white object-contain p-0.5" />
        ) : (
          <span className="font-display flex size-9 items-center justify-center rounded-lg bg-sand-400 text-lg font-bold text-brand-950">ر</span>
        )}
        <div className="min-w-0">
          <div className="font-display truncate text-[15px] leading-tight font-semibold text-white">{company?.company_name ?? 'ركاز'}</div>
          <div className="truncate text-[11px] text-brand-300">{company?.tagline || 'منظومة إدارة المقاولات'}</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-color:#24433a_transparent]">
        {navSections.map((section) => {
          const items = section.items.filter(visible)
          if (!items.length) return null
          return (
            <div key={section.title}>
              <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-brand-400">{section.title}</div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.path)
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                        active ? 'bg-white/10 font-semibold text-white' : 'text-brand-100/85 hover:bg-white/5 hover:text-white',
                        item.stage && !active && 'text-brand-100/50',
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 -right-3 w-1 rounded-l-full bg-sand-400" />}
                      <item.icon className={cn('size-4 shrink-0', active ? 'text-sand-300' : 'text-brand-300 group-hover:text-brand-200')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.stage && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-brand-300">قريباً</span>}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
          <Avatar name={profile?.display_name ?? '؟'} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{profile?.display_name}</div>
            <div className="truncate text-[11px] text-brand-300">{roles.map((r) => roleLabels[r]).join('، ') || 'بلا دور'}</div>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-brand-300 hover:bg-white/10 hover:text-white"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            onClick={async () => {
              await signOut()
              qc.clear() // الخروج يمسح كل البيانات المخزنة مؤقتاً (SPEC 5.7)
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex h-dvh">
      <aside className="no-print hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="no-print fixed inset-0 z-30 flex lg:hidden">
          <aside className="relative w-72 max-w-[85vw] animate-panel-in">
            {sidebar}
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" className="absolute top-4 -left-11 rounded-full bg-surface p-2 text-ink shadow">
              <X className="size-4" />
            </button>
          </aside>
          <div className="flex-1 bg-black/40 animate-fade-in" onClick={() => setMenuOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-faint transition hover:border-line-strong"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-right">بحث سريع عن شاشة…</span>
            <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] text-muted sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="تبديل المظهر" title={dark ? 'المظهر الفاتح' : 'المظهر الداكن'}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
