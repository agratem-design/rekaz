import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ScrollText } from 'lucide-react'
import { Avatar, Badge, Card, EmptyState, ErrorState, FilterChips, PageHeader, SearchInput, TableSkeleton, cn } from '@/components/ui'
import { RecordCount } from '@/components/DataTable'
import { formatDateTime } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'

const actionLabels: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' }
const actionTone = { INSERT: 'green', UPDATE: 'blue', DELETE: 'red' } as const

export const tableLabels: Record<string, string> = {
  clients: 'الزبائن',
  suppliers: 'الموردون',
  technicians: 'الفنيون',
  technician_types: 'تخصصات الفنيين',
  employees: 'الموظفون',
  engineers: 'المهندسون',
  treasuries: 'الخزائن',
  projects: 'المشاريع',
  project_phases: 'المراحل',
  project_items: 'بنود المقاولات',
  project_item_assignments: 'تعيينات الفنيين',
  catalog_items: 'البنود العامة',
  measurement_units: 'وحدات القياس',
  expense_categories: 'فئات المصروفات',
  contracts: 'العقود',
  client_receipts: 'إيصالات القبض',
  purchases: 'فواتير المشتريات',
  supplier_payments: 'دفعات الموردين',
  technician_work: 'إنجاز الفنيين',
  technician_payments: 'دفعات الفنيين',
  custodies: 'العهد',
  expenses: 'المصروفات',
  transfers: 'التحويلات',
  company_settings: 'الإعدادات',
  profiles: 'المستخدمون',
  user_roles: 'الصلاحيات',
}

type Filter = 'all' | 'INSERT' | 'UPDATE' | 'DELETE'

export function AuditPage() {
  const [open, setOpen] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const [log, users] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('profiles').select('id, display_name'),
      ])
      if (log.error) throw log.error
      const names = new Map((users.data ?? []).map((u) => [u.id, u.display_name]))
      return log.data.map((l) => ({ ...l, actor: l.actor_id ? (names.get(l.actor_id) ?? '—') : 'النظام' }))
    },
  })

  const all = data ?? []
  const q = search.trim()
  const shown = all.filter(
    (l) => (filter === 'all' || l.action === filter) && (!q || l.actor.includes(q) || l.table_name.includes(q) || (tableLabels[l.table_name] ?? '').includes(q)),
  )
  const count = (a: Filter) => all.filter((l) => l.action === a).length

  return (
    <div>
      <PageHeader title="سجل التعديلات والرقابة" description="آخر 300 عملية على البيانات، بمن نفذها ومتى" />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالمستخدم أو الجدول…" />
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل', count: all.length },
              { value: 'INSERT', label: 'إضافة', count: count('INSERT') },
              { value: 'UPDATE', label: 'تعديل', count: count('UPDATE') },
              { value: 'DELETE', label: 'حذف', count: count('DELETE') },
            ]}
          />
          <div className="ms-auto">
            <RecordCount shown={shown.length} total={all.length} />
          </div>
        </div>
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
          </div>
        ) : !shown.length ? (
          <EmptyState icon={ScrollText} title="لا توجد عمليات مطابقة" />
        ) : (
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  {['الوقت', 'المستخدم', 'العملية', 'الجدول', ''].map((h, i) => (
                    <th key={i} className="sticky top-0 border-b border-line bg-surface-2 px-4 py-2.5 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer hover:bg-surface-2" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                      <td className="num border-b border-line px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(l.created_at)}</td>
                      <td className="border-b border-line px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar name={l.actor} size="sm" />
                          {l.actor}
                        </span>
                      </td>
                      <td className="border-b border-line px-4 py-2.5">
                        <Badge tone={actionTone[l.action as keyof typeof actionTone] ?? 'neutral'}>{actionLabels[l.action] ?? l.action}</Badge>
                      </td>
                      <td className="border-b border-line px-4 py-2.5">
                        {tableLabels[l.table_name] ?? l.table_name} <span className="num text-xs text-faint">{l.table_name}</span>
                      </td>
                      <td className="w-8 border-b border-line px-2">
                        <ChevronDown className={cn('size-4 text-faint transition', open === l.id && 'rotate-180')} />
                      </td>
                    </tr>
                    {open === l.id && (
                      <tr>
                        <td colSpan={5} className="border-b border-line bg-surface-2 px-4 py-3">
                          <pre dir="ltr" className="max-h-72 overflow-auto rounded-lg bg-surface p-3 text-xs leading-relaxed ring-1 ring-line">
                            {JSON.stringify(l.new_data ?? l.old_data, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
