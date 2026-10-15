import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from './supabase'

// استعلامات مشتركة بين الشاشات. الأرقام المالية من العروض فقط (SPEC 4).

export function useClientsList() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useEngineers() {
  return useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('engineers').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useTreasuriesWithBalance() {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  return useQuery({
    queryKey: ['treasuries', 'picker', finance],
    queryFn: async () => {
      const [t, b] = await Promise.all([
        supabase.from('treasuries').select('*').order('name'),
        finance ? supabase.from('treasury_balances').select('treasury_id, balance') : Promise.resolve({ data: [], error: null }),
      ])
      if (t.error) throw t.error
      if (b.error) throw b.error
      const bal = new Map((b.data ?? []).map((x) => [x.treasury_id, Number(x.balance)]))
      return t.data.map((x) => ({ ...x, balance: finance ? (bal.get(x.id) ?? 0) : null }))
    },
  })
}

export function useProjectsFinancials() {
  return useQuery({
    queryKey: ['project_financials'],
    queryFn: async () => {
      const [p, f] = await Promise.all([
        supabase.from('projects').select('*, clients(name), engineers(name)').order('created_at', { ascending: false }),
        supabase.from('project_financials').select('*'),
      ])
      if (p.error) throw p.error
      if (f.error) throw f.error
      const fin = new Map(f.data.map((x) => [x.project_id, x]))
      return p.data.map((x) => ({ ...x, fin: fin.get(x.id) ?? null }))
    },
  })
}
export type ProjectWithFin = NonNullable<ReturnType<typeof useProjectsFinancials>['data']>[number]

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [p, f, c] = await Promise.all([
        supabase.from('projects').select('*, clients(id, name, phone), engineers(name), treasuries(name)').eq('id', id!).single(),
        supabase.from('project_financials').select('*').eq('project_id', id!).maybeSingle(),
        supabase.from('project_costs').select('*').eq('project_id', id!).maybeSingle(),
      ])
      if (p.error) throw p.error
      if (f.error) throw f.error
      if (c.error) throw c.error
      return { ...p.data, fin: f.data, costs: c.data }
    },
  })
}
export type ProjectDetail = NonNullable<ReturnType<typeof useProject>['data']>

export function usePhases(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_phases', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_phases').select('*').eq('project_id', projectId!).order('order_index').order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useUnits() {
  return useQuery({
    queryKey: ['measurement_units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('measurement_units').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

// مفتاح منع التكرار: يُولَّد عند فتح النموذج ويُعاد استخدامه عند إعادة المحاولة (SPEC 5.2)
export function newKey() {
  return crypto.randomUUID()
}
