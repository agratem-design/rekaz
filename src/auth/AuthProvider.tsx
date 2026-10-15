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
export function loginToEmail(login: string) {
  const v = login.trim().toLowerCase()
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
      const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password })
      if (error) throw error
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
