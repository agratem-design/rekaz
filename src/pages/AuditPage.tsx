import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, ErrorState, PageHeader, Spinner } from '@/components/ui'
import { errorMessage, supabase } from '@/lib/supabase'

const actionLabels: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' }

export function AuditPage() {
  const [open, setOpen] = useState<number | null>(null)
  const { data, isLoading, error } = useQuery({
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
  if (isLoading) return <Spinner />
  if (error) return <ErrorState message={errorMessage(error)} />
  return (
    <div>
      <PageHeader title="سجل العمليات" description="آخر 300 عملية على البيانات" />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 dark:bg-stone-800/50">
            <tr>
              <th className="px-3 py-2 text-right font-medium">الوقت</th>
              <th className="px-3 py-2 text-right font-medium">المستخدم</th>
              <th className="px-3 py-2 text-right font-medium">العملية</th>
              <th className="px-3 py-2 text-right font-medium">الجدول</th>
            </tr>
          </thead>
          <tbody>
            {data!.map((l) => (
              <Fragment key={l.id}>
                <tr className="cursor-pointer border-t border-stone-100 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/40" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <td className="px-3 py-2 num">{new Date(l.created_at).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-2">{l.actor}</td>
                  <td className="px-3 py-2">{actionLabels[l.action] ?? l.action}</td>
                  <td className="px-3 py-2 num">{l.table_name}</td>
                </tr>
                {open === l.id && (
                  <tr>
                    <td colSpan={4} className="bg-stone-50 px-3 py-2 dark:bg-stone-800/40">
                      <pre dir="ltr" className="overflow-x-auto text-xs">{JSON.stringify(l.new_data ?? l.old_data, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
