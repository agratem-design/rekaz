import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type AppRole, type Tables } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  profile: Tables<'profiles'> | null
  roles: AppRole[]
  loading: boolean
  hasRole: (...roles: AppRole[]) => boolean
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// المستخدمون الجدد يُنشؤون بعنوان داخلي من اسم المستخدم؛ ويمكن الدخول بالبريد مباشرة أيضاً
export const USERNAME_EMAIL_DOMAIN = 'rikaz.local'

export async function resolveLoginIdentifier(login: string): Promise<string> {
  const v = login.trim().toLowerCase()
  if (v === 'admin' || v === 'rekazabdo' || v === 'admin@rikaz.local') {
    return 'rekazabdo@admin.com'
  }
  if (v === 'tester' || v === 'tester@rikaz.local') {
    return 'tester@rikaz.local'
  }
  if (v.includes('@')) {
    return v
  }
  try {
    const { data } = await (supabase.rpc as any)('get_auth_email_by_username', { p_identifier: v })
    if (typeof data === 'string' && data) return data
  } catch {
    // fallback to local domain
  }
  return `${v}@${USERNAME_EMAIL_DOMAIN}`
}

export function loginToEmail(login: string) {
  const v = login.trim().toLowerCase()
  if (v === 'admin' || v === 'rekazabdo' || v === 'admin@rikaz.local') {
    return 'rekazabdo@admin.com'
  }
  return v.includes('@') ? v : `${v}@${USERNAME_EMAIL_DOMAIN}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]).then(([p, r]) => {
      if (cancelled) return
      setProfile(p.data)
      setRoles((r.data ?? []).map((x) => x.role))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value: AuthState = {
    session,
    profile,
    roles,
    loading,
    hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
    signIn: async (login, password) => {
      const email = await resolveLoginIdentifier(login)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // إذا كان خطأ وكان الحساب admin، جرب أيضاً admin@rikaz.local
        if (!login.includes('@') && email !== `${login.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`) {
          const fallbackEmail = `${login.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`
          const fallbackRes = await supabase.auth.signInWithPassword({ email: fallbackEmail, password })
          if (!fallbackRes.error) return
        }
        throw error
      }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth خارج AuthProvider')
  return ctx
}
