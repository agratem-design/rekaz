import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// حساب كل طرف داخل كل مشروع. المفاتيح تحت أرصدة الطرف لتتحدث بعد كل عملية مالية.
export function useSupplierProjects(filter: { supplierId?: string; projectId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['supplier_balances', 'projects', filter.supplierId ?? null, filter.projectId ?? null],
    enabled,
    queryFn: async () => {
      let q = supabase.from('supplier_project_balances').select('*')
      if (filter.supplierId) q = q.eq('supplier_id', filter.supplierId)
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useTechnicianProjects(filter: { technicianId?: string; projectId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['technician_balances', 'projects', filter.technicianId ?? null, filter.projectId ?? null],
    enabled,
    queryFn: async () => {
      let q = supabase.from('technician_project_balances').select('*')
      if (filter.technicianId) q = q.eq('technician_id', filter.technicianId)
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useProjectCash(projectId: string) {
  return useQuery({
    queryKey: ['project_financials', 'cash', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_cash_position').select('*').eq('project_id', projectId).single()
      if (error) throw error
      return data
    },
  })
}
