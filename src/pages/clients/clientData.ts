import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

// أرصدة الزبائن من العرض client_balances (للمالية فقط)
export function useClientBalances() {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  return useQuery({
    queryKey: ['client_balances'],
    enabled: finance,
    queryFn: async () => {
      const { data, error } = await supabase.from('client_balances').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useClientBalanceMap() {
  const { data } = useClientBalances()
  return useMemo(() => (data ? new Map(data.map((b) => [b.client_id!, b as Record<string, unknown>])) : undefined), [data])
}
