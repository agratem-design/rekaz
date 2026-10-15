import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useExpenses(filter: { projectId?: string; custodyId?: string } = {}) {
  return useQuery({
    queryKey: ['expenses', filter.projectId ?? null, filter.custodyId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, expense_categories(name), projects(name), project_phases(name), project_items(name), treasuries(name)')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      if (filter.custodyId) q = q.eq('custody_id', filter.custodyId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}
export type ExpenseRow = NonNullable<ReturnType<typeof useExpenses>['data']>[number]

// العهد المفتوحة مع المتبقي من العرض custody_balances
export function useCustodies() {
  return useQuery({
    queryKey: ['custodies'],
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from('custodies').select('*, employees(name), engineers(name), projects(name, project_type), treasuries(name)').order('issue_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('custody_balances').select('*'),
      ])
      if (c.error) throw c.error
      if (b.error) throw b.error
      const bal = new Map(b.data.map((x) => [x.custody_id, x]))
      return c.data.map((x) => ({
        ...x,
        holder: x.employees?.name ?? x.engineers?.name ?? '—',
        spent: Number(bal.get(x.id)?.spent ?? 0),
        returned: Number(bal.get(x.id)?.returned ?? 0),
        remaining: Number(bal.get(x.id)?.remaining ?? 0),
      }))
    },
  })
}
export type CustodyRow = NonNullable<ReturnType<typeof useCustodies>['data']>[number]

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_categories').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}
