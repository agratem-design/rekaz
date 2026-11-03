import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useProjectsFinancials } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { Button, Card, EmptyState, ErrorState, Money, Skeleton, cn } from './ui'

export type BreakdownRow = { projectId: string | null; billed: number; paid: number; due: number }

// حساب مورد أو فني مجمّعاً: الزبون ثم مشاريعه ثم المستحق في كل مشروع، مع التسديد من الصف نفسه
export function ProjectBreakdown({ rows, billedLabel, loading, error, onRetry, onPay }: {
  rows: BreakdownRow[]
  billedLabel: string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  onPay: (row: BreakdownRow) => void
}) {
  const projects = useProjectsFinancials()
  if (loading || projects.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />
  if (error || projects.error) return <ErrorState message={errorMessage(error ?? projects.error)} onRetry={onRetry} />
  const info = new Map((projects.data ?? []).map((p) => [p.id, p]))
  const groups = new Map<string, { key: string; client: string; to: string | null; rows: BreakdownRow[] }>()
  for (const row of rows) {
    const p = row.projectId ? info.get(row.projectId) : undefined
    const key = p?.client_id ?? 'general'
    const group = groups.get(key) ?? { key, client: p?.clients?.name ?? 'عام وعلى الحساب', to: p ? `/clients/${p.client_id}` : null, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  // ما ليس له مشروع يأتي أخيراً
  const ordered = [...groups.values()].sort((a, b) => Number(a.key === 'general') - Number(b.key === 'general') || a.client.localeCompare(b.client, 'ar'))
  if (!ordered.length) return <Card><EmptyState icon={Building2} title="لا توجد حركات على أي مشروع" /></Card>
  return (
    <div className="space-y-4">
      {ordered.map((g) => (
        <Card key={g.key} className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            {g.to ? <Link to={g.to} className="font-semibold hover:underline">{g.client}</Link> : <span className="font-semibold">{g.client}</span>}
            <span className="text-xs text-muted">
              صافي الحساب <Money value={g.rows.reduce((a, r) => a + r.due, 0)} className="font-semibold text-ink" />
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-right font-semibold">المشروع</th>
                <th className="hidden px-4 py-2 text-left font-semibold sm:table-cell">{billedLabel}</th>
                <th className="hidden px-4 py-2 text-left font-semibold sm:table-cell">المدفوع</th>
                <th className="px-4 py-2 text-left font-semibold">الرصيد</th>
                <th className="w-20 px-2 py-2 sm:px-4" />
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => {
                const p = r.projectId ? info.get(r.projectId) : undefined
                return (
                  <tr key={r.projectId ?? 'general'} className="border-t border-line">
                    <td className="px-4 py-2">
                      {p ? <Link to={`/projects/${p.id}/accounts`} className="font-medium hover:underline">{p.name}</Link> : <span className="text-muted">بلا مشروع</span>}
                    </td>
                    <td className="hidden px-4 py-2 text-left sm:table-cell"><Money value={r.billed} /></td>
                    <td className="hidden px-4 py-2 text-left sm:table-cell"><Money value={r.paid} /></td>
                    <td className="px-4 py-2 text-left">
                      <span className="inline-flex flex-col items-end">
                        <Money value={Math.abs(r.due)} className={cn('font-semibold', r.due > 0 && 'text-red-700 dark:text-red-400', r.due < 0 && 'text-sand-600')} />
                        {r.due < 0 && <span className="text-[10px] text-sand-600">مقدم</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-left sm:px-4">
                      <Button size="sm" variant={r.due > 0 ? 'primary' : 'secondary'} onClick={() => onPay(r)}>
                        تسديد
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}
