import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// سجل الإنجاز هو المصدر الوحيد لمستحق الفني (SPEC 3.6)
export function useTechnicianWork(filter: { technicianId?: string; projectId?: string }) {
  return useQuery({
    queryKey: ['technician_work', filter.technicianId ?? null, filter.projectId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('technician_work')
        .select('*, technicians(name), projects(name), project_phases(name), project_items(name)')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (filter.technicianId) q = q.eq('technician_id', filter.technicianId)
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}
export type WorkRow = NonNullable<ReturnType<typeof useTechnicianWork>['data']>[number]

export function useTechnicianPayments(technicianId?: string) {
  return useQuery({
    queryKey: ['technician_payments', technicianId ?? null],
    queryFn: async () => {
      let q = supabase.from('technician_payments').select('*, technicians(name), treasuries(name), projects(name)').order('payment_date', { ascending: false })
      if (technicianId) q = q.eq('technician_id', technicianId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useTechnicianReceipts(technicianId?: string) {
  return useQuery({
    queryKey: ['technician_receipts', technicianId ?? null],
    queryFn: async () => {
      let q = supabase.from('technician_receipts').select('*, technicians(name), treasuries(name)').order('receipt_date', { ascending: false })
      if (technicianId) q = q.eq('technician_id', technicianId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useTechnicianBalance(technicianId?: string) {
  return useQuery({
    queryKey: ['technician_balances', technicianId ?? null],
    queryFn: async () => {
      let q = supabase.from('technician_balances').select('*')
      if (technicianId) q = q.eq('technician_id', technicianId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}
