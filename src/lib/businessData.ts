import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { financeKeys } from '@/components/pickers'
import type { BusinessTables, BusinessViews } from './businessTypes'
import type { Json } from './database.types'
export type BusinessName = keyof BusinessTables | keyof BusinessViews
type Schema = BusinessTables & BusinessViews
export function useBusinessTable<T extends BusinessName>(table: T) {
 return useQuery({ queryKey: ['business', table], queryFn: async () => {
  const query = ['employee_advance_balances','payroll_balances','stock_balances','stock_ledger'].includes(table)
   ? supabase.from(table as keyof BusinessViews) : supabase.from(table as keyof BusinessTables)
  const { data, error } = await query.select('*')
  if (error) throw error
  return data as unknown as Schema[T]['Row'][]
 } })
}
export async function businessCommand(action: string, data: object, key: string) {
 const result = await supabase.rpc('business_command', { p_key: key, p_action: action, p_data: data as Json })
 if (result.error) throw result.error
 return result.data
}
export function useRefreshBusiness() {
 const qc = useQueryClient()
 return () => {
  qc.invalidateQueries({queryKey:['business']})
  for (const key of [...financeKeys, 'employees', 'project_items', 'catalog_items', 'units']) qc.invalidateQueries({queryKey:[key]})
 }
}
