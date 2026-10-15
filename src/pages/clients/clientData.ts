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

// أرصدة من عرض (supplier_balances / technician_balances) مفهرسة بمعرّف الطرف
export function useBalanceMap(view: 'supplier_balances' | 'technician_balances', idKey: 'supplier_id' | 'technician_id') {
  const { hasRole } = useAuth()
  const { data } = useQuery({
    queryKey: [view],
    // غير المالية لا ترى الدفعات، فالرصيد عندها ناقص؛ لا نعرضه لها
    enabled: hasRole('admin', 'accountant'),
    queryFn: async () => {
      const { data, error } = await supabase.from(view).select('*')
      if (error) throw error
      return data as Record<string, unknown>[]
    },
  })
  return useMemo(() => (data ? new Map(data.map((b) => [String(b[idKey]), b])) : undefined), [data, idKey])
}

export function useClientBalanceMap() {
  const { data } = useClientBalances()
  return useMemo(() => (data ? new Map(data.map((b) => [b.client_id!, b as Record<string, unknown>])) : undefined), [data])
}
