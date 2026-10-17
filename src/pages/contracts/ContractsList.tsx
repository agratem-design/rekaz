import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileSignature, Pencil, Plus, Printer, Scale } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable, RecordCount } from '@/components/DataTable'
import { Badge, Button, EmptyState, FilterChips, Money, PageHeader, SearchInput, StatCard } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { contractStatusLabels, contractStatusTone } from '@/lib/labels'
import type { ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase, type Enums, type Tables } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { ContractForm } from './ContractForm'

type Status = 'all' | Enums<'contract_status'>

export function useContracts(projectId?: string) {
  return useQuery({
    queryKey: ['contracts', projectId ?? null],
    queryFn: async () => {
      let q = supabase.from('contracts').select('*, clients(name), projects(name), project_phases(name, reference_number)').order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

// قائمة العقود: داخل تبويب المشروع، أو في «سجل العقود» لكل المشاريع
export function ContractsList({ project }: { project?: ProjectDetail }) {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin')
  const { data, isLoading, error, refetch } = useContracts(project?.id)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [editing, setEditing] = useState<Tables<'contracts'> | 'new' | null>(null)

  const all = data ?? []
  const q = search.trim()
  const shown = all.filter((c) => (status === 'all' || c.status === status) && (!q || c.title.includes(q) || (c.contract_number ?? '').includes(q) || (c.clients?.name ?? '').includes(q) || (c.projects?.name ?? '').includes(q)))
  const effective = all.filter((c) => c.status === 'active' || c.status === 'completed')
  const count = (s: Status) => all.filter((c) => c.status === s).length
  const addButton = canWrite && (
    <Button onClick={() => setEditing('new')}>
      <Plus className="size-4" />
      عقد جديد
    </Button>
  )

  return (
    <div>
      {project ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">عقود المشروع</h2>
            <p className="text-xs text-muted">العقد النشط أو المكتمل يحدد قيمة المشروع في المقاولات</p>
          </div>
          {addButton}
        </div>
      ) : (
        <PageHeader title="سجل العقود" description="كل عقود الزبائن والمشاريع، مع الطباعة" actions={addButton} />
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={FileSignature} label="إجمالي العقود" value={<span className="num">{all.length}</span>} />
        <StatCard icon={CheckCircle2} label="العقود النشطة" value={<span className="num">{count('active')}</span>} tone="blue" />
        <StatCard icon={Scale} label="قيمة العقود السارية" value={<Money value={effective.reduce((a, c) => a + Number(c.amount), 0)} />} tone="sand" />
      </div>

      <DataTable
        rows={shown}
        getKey={(c) => c.id}
        loading={isLoading}
        error={error ? errorMessage(error) : null}
        onRetry={() => refetch()}
        onRowClick={canWrite ? (c) => setEditing(c) : (c) => openPrint('contract', c.id)}
        rowClassName={(c) => c.status === 'cancelled' && 'text-faint'}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالعنوان، الرقم، الزبون…" />
            <FilterChips
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'الكل', count: all.length },
                { value: 'draft', label: contractStatusLabels.draft, count: count('draft') },
                { value: 'active', label: contractStatusLabels.active, count: count('active') },
                { value: 'completed', label: contractStatusLabels.completed, count: count('completed') },
                { value: 'cancelled', label: contractStatusLabels.cancelled, count: count('cancelled') },
              ]}
            />
            <div className="ms-auto">
              <RecordCount shown={shown.length} total={all.length} />
            </div>
          </>
        }
        empty={
          <EmptyState icon={FileSignature} title={q || status !== 'all' ? 'لا توجد عقود مطابقة' : project ? 'لا توجد عقود لهذا المشروع' : 'لا توجد عقود بعد'} action={!q && addButton}>
            {!q && 'أنشئ عقداً جديداً وأضف بنوده وشروطه، ثم اطبعه.'}
          </EmptyState>
        }
        columns={[
          { key: 'no', label: 'رقم العقد', render: (c) => <span className="num font-medium">{c.contract_number ?? '—'}</span> },
          {
            key: 'title',
            label: 'العنوان',
            render: (c) => (
              <div>
                <div className="font-medium">{c.title}</div>
              </div>
            ),
          },
          ...(!project
            ? [
                { key: 'client', label: 'الزبون', render: (c: (typeof all)[number]) => c.clients?.name },
                {
                  key: 'project',
                  label: 'المشروع',
                  hideBelow: 'md' as const,
                  render: (c: (typeof all)[number]) =>
                    c.project_id ? (
                      <Link to={`/projects/${c.project_id}/contracts`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.projects?.name}
                      </Link>
                    ) : (
                      <span className="text-faint">—</span>
                    ),
                },
              ]
            : []),
          { key: 'status', label: 'الحالة', render: (c) => <Badge tone={contractStatusTone[c.status]} dot>{contractStatusLabels[c.status]}</Badge> },
          { key: 'date', label: 'تاريخ البدء', hideBelow: 'sm', render: (c) => <span className="num text-muted">{formatDate(c.start_date)}</span> },
          { key: 'amount', label: 'القيمة', align: 'end', render: (c) => <Money value={c.amount} className="font-semibold" /> },
        ]}
        rowActions={(c) => (
          <>
            <Button variant="ghost" size="icon" className="size-8" aria-label="طباعة العقد" title="طباعة العقد" onClick={() => openPrint('contract', c.id)}>
              <Printer className="size-4" />
            </Button>
            {canWrite && (
              <Button variant="ghost" size="icon" className="size-8" aria-label="تعديل" title="تعديل" onClick={() => setEditing(c)}>
                <Pencil className="size-4" />
              </Button>
            )}
          </>
        )}
      />
      {canWrite && <ContractForm open={editing !== null} onClose={() => setEditing(null)} contract={editing === 'new' ? null : editing} projectId={project?.id} clientId={project?.client_id} />}
    </div>
  )
}

export function ContractsPage() {
  return <ContractsList />
}
