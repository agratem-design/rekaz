import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// فواتير الموردين مع المسدد والمتبقي من العرض purchase_balances (مصدر واحد للحقيقة)
export function usePurchases(filter: { projectId?: string; supplierId?: string } = {}) {
  return useQuery({
    queryKey: ['purchases', filter.projectId ?? null, filter.supplierId ?? null],
    queryFn: async () => {
      let q = supabase
        .from('purchases')
        .select('*, suppliers(name), projects(name, project_type), project_phases(name, reference_number), project_items(name)')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      if (filter.supplierId) q = q.eq('supplier_id', filter.supplierId)
      const [p, b] = await Promise.all([q, supabase.from('purchase_balances').select('purchase_id, paid, remaining')])
      if (p.error) throw p.error
      if (b.error) throw b.error
      const bal = new Map(b.data.map((x) => [x.purchase_id, x]))
      return p.data.map((x) => ({ ...x, paid: Number(bal.get(x.id)?.paid ?? 0), remaining: Number(bal.get(x.id)?.remaining ?? 0) }))
    },
  })
}
export type PurchaseRow = NonNullable<ReturnType<typeof usePurchases>['data']>[number]

export type PurchaseLine = { name: string; quantity: number; unit: string; unit_price: number; total: number }

export const purchaseKindLabels = { material: 'مواد', service: 'خدمات مورد', return: 'مرتجع' } as const
export const purchaseKindTone = { material: 'blue', service: 'brand', return: 'amber' } as const
