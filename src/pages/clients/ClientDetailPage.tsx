import { CustomerInvoices } from '../billing/CustomerInvoices'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Banknote, Building2, CircleDollarSign, Copy, MapPin, Pencil, Phone, Plus, Printer, Scale, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { DataTable } from '@/components/DataTable'
import { Modal, askReason } from '@/components/dialog'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Money, PageHeader, Select, Skeleton, StatCard, Tabs, Textarea } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { projectStatusLabels, projectStatusTone, projectTypeLabels } from '@/lib/labels'
import { newKey, useProjectsFinancials, type ProjectWithFin } from '@/lib/queries'
import { errorMessage, supabase, type Tables } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { ProjectForm } from '../projects/ProjectForm'
import { Remaining } from '../projects/ProjectsPage'
import { ReceiptForm, invalidateFinance } from '../receipts/ReceiptForm'
import { ReceiptsTable } from '../receipts/ReceiptsTable'

const creditKindLabels: Record<string, string> = {
  advance_receipt: 'دفعة مقدمة بلا مشروع',
  from_project: 'نقل زيادة من مشروع',
  application: 'تطبيق على مشروع',
  reversal: 'قيد عكسي',
}

export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const canCreateProject = hasRole('admin', 'engineer', 'supervisor')
  const qc = useQueryClient()
  const [tab, setTab] = useState('projects')
  const [receipt, setReceipt] = useState(false)
  const [applying, setApplying] = useState<ProjectWithFin | 'pick' | null>(null)
  const [editing, setEditing] = useState(false)
  const [newProject, setNewProject] = useState<'contracting' | 'finishing' | null>(null)

  const client = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const [c, b, e] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        finance ? supabase.from('client_balances').select('*').eq('client_id', id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        finance ? supabase.from('client_credit_entries').select('*, projects(name)').eq('client_id', id).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ])
      if (c.error) throw c.error
      if (b.error) throw b.error
      if (e.error) throw e.error
      return { client: c.data, balance: b.data, credit: e.data ?? [] }
    },
  })
  const projects = useProjectsFinancials()
  const mine = (projects.data ?? []).filter((p) => p.client_id === id)

  const reverseCredit = useMutation({
    mutationFn: async ({ entry, reason }: { entry: string; reason: string }) => {
      const { error } = await supabase.rpc('reverse_client_credit_entry', { p_entry_id: entry, p_reason: reason })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم عكس القيد')
      invalidateFinance(qc)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (client.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  if (client.error)
    return (client.error as { code?: string }).code === 'PGRST116' ? (
      <Card>
        <EmptyState title="الزبون غير موجود" action={<Button variant="secondary" onClick={() => navigate('/clients')}>العودة للزبائن</Button>} />
      </Card>
    ) : (
      <ErrorState message={`تعذر تحميل بيانات الحساب كاملة: ${errorMessage(client.error)}. لم نعرض أرصدة جزئية.`} onRetry={() => client.refetch()} />
    )

  const c = client.data!.client
  const b = client.data!.balance
  const credit = Number(b?.available_credit ?? 0)
  const reversed = new Set(client.data!.credit.filter((e) => e.reverses_entry_id).map((e) => e.reverses_entry_id))

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'الزبائن', to: '/clients' }, { label: c.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} size="lg" />
            {c.name}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {c.phone && (
              <button
                type="button"
                className="num flex items-center gap-1 hover:text-ink"
                title="نسخ رقم الهاتف"
                onClick={() => {
                  navigator.clipboard?.writeText(c.phone!).then(() => toast.success('تم نسخ رقم الهاتف'))
                }}
              >
                <Phone className="size-3.5" />
                {c.phone}
                <Copy className="size-3 opacity-50" />
              </button>
            )}
            {(c.city || c.address) && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {[c.city, c.address].filter(Boolean).join('، ')}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {finance && (
              <Button onClick={() => setReceipt(true)}>
                <Banknote className="size-4" />
                إضافة دفعة أو رصيد مقدم
              </Button>
            )}
            {finance && credit > 0 && (
              <Button variant="soft" onClick={() => setApplying('pick')}>
                <ArrowLeftRight className="size-4" />
                تطبيق الرصيد على مشروع
              </Button>
            )}
            {finance && (
              <Button variant="secondary" onClick={() => openPrint('client-statement', c.id)}>
                <Printer className="size-4" />
                كشف الحساب
              </Button>
            )}
            {finance && (
              <Button variant="ghost" size="icon" aria-label="تعديل بيانات الزبون" title="تعديل البيانات" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </Button>
            )}
          </>
        }
      />

      {finance && b && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <StatCard icon={Scale} label="إجمالي الأعمال والمطالبات" value={<Money value={b.total_obligation} />} />
          <StatCard icon={Banknote} label="المسدد للمشاريع" value={<Money value={b.total_collected} />} tone="blue" />
          <StatCard icon={CircleDollarSign} label="المتبقي المستحق" value={<Money value={b.total_due} />} tone="red" hint="مجموع المتبقي على المشاريع غير المسددة" />
          <StatCard icon={Wallet} label="رصيد دائن متاح" value={<Money value={credit} />} tone="sand" hint={Number(b.total_overpaid_on_projects) > 0 ? `وزيادات على مشاريع ${formatMoney(b.total_overpaid_on_projects)}` : 'دفعات غير مخصصة لمشروع'} />
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { key: 'projects', label: 'كشف المشاريع', icon: Building2 },
          ...(finance ? [{ key: 'invoices', label: 'الفواتير والمطالبات', icon: Printer }, { key: 'receipts', label: 'سجل المقبوضات', icon: Banknote }] : []),
          ...(finance ? [{ key: 'credit', label: 'دفتر الرصيد الدائن', icon: Wallet }] : []),
        ]}
      />
      <div className="mt-4">
        {tab === 'projects' && (
          <>
            {canCreateProject && (
              <div className="mb-3 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setNewProject('contracting')}>
                  <Plus className="size-3.5" />
                  مشروع مقاولات
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setNewProject('finishing')}>
                  <Plus className="size-3.5" />
                  مشروع تشطيبات
                </Button>
              </div>
            )}
            <DataTable
              rows={mine}
              getKey={(p) => p.id}
              loading={projects.isLoading}
              onRowClick={(p) => navigate(`/projects/${p.id}`)}
              empty={<EmptyState icon={Building2} title="لا توجد مشاريع لهذا الزبون" />}
              columns={[
                { key: 'name', label: 'المشروع', render: (p) => <span className="font-medium">{p.name}</span> },
                { key: 'type', label: 'النوع', hideBelow: 'sm', render: (p) => projectTypeLabels[p.project_type] },
                { key: 'status', label: 'الحالة', hideBelow: 'md', render: (p) => <Badge tone={projectStatusTone[p.status]} dot>{projectStatusLabels[p.status]}</Badge> },
                ...(finance
                  ? [
                      { key: 'ob', label: 'الالتزام', align: 'end' as const, render: (p: ProjectWithFin) => <Money value={p.fin?.client_obligation} /> },
                      { key: 'col', label: 'المقبوض', align: 'end' as const, hideBelow: 'sm' as const, render: (p: ProjectWithFin) => <Money value={p.fin?.collected} /> },
                      { key: 'rem', label: 'المتبقي', align: 'end' as const, render: (p: ProjectWithFin) => <Remaining value={p.fin?.client_remaining} /> },
                    ]
                  : []),
              ]}
              rowActions={
                finance && credit > 0
                  ? (p) =>
                      Number(p.fin?.client_remaining) > 0 ? (
                        <Button variant="ghost" size="sm" onClick={() => setApplying(p)}>
                          تطبيق الرصيد
                        </Button>
                      ) : null
                  : undefined
              }
            />
          </>
        )}
        {tab === 'invoices' && <CustomerInvoices clientId={c.id} />}
        {tab === 'receipts' && <ReceiptsTable clientId={c.id} onNew={() => setReceipt(true)} />}
        {tab === 'credit' && (
          <Card className="p-0">
            <div className="border-b border-line px-4 py-3">
              <CardHeader title="دفتر الرصيد الدائن" description="لا يتحرك أي مبلغ بين المشاريع أو إلى الرصيد إلا بقيد صريح هنا. التصحيح بقيد عكسي." />
            </div>
            {!client.data!.credit.length ? (
              <EmptyState icon={Wallet} title="لا توجد قيود رصيد دائن" />
            ) : (
              <ul className="divide-y divide-line">
                {client.data!.credit.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="num w-20 text-xs text-muted">{formatDate(e.created_at)}</span>
                    <span className="flex-1">
                      {creditKindLabels[e.kind]}
                      {e.projects?.name && <span className="text-muted"> — {e.projects.name}</span>}
                      {e.notes && <span className="block text-xs text-muted">{e.notes}</span>}
                    </span>
                    {reversed.has(e.id) && <Badge tone="red">معكوس</Badge>}
                    <Money value={e.amount} signed className={Number(e.amount) > 0 ? 'font-semibold text-olive-700 dark:text-olive-400' : 'font-semibold'} />
                    {(e.kind === 'application' || e.kind === 'from_project') && !reversed.has(e.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-red-600"
                        aria-label="عكس القيد"
                        title="عكس القيد"
                        onClick={async () => {
                          const reason = await askReason({ title: 'عكس قيد الرصيد؟', message: 'يُسجَّل قيد عكسي مرتبط بهذا القيد.', confirmLabel: 'عكس القيد' })
                          if (reason) reverseCredit.mutate({ entry: e.id, reason })
                        }}
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {finance && <ReceiptForm open={receipt} onClose={() => setReceipt(false)} clientId={c.id} />}
      {applying && <ApplyCredit clientId={c.id} credit={credit} projects={mine} initial={applying === 'pick' ? null : applying} onClose={() => setApplying(null)} />}
      <EditClient open={editing} client={c} onClose={() => setEditing(false)} />
      {newProject && <ProjectForm open onClose={() => setNewProject(null)} type={newProject} clientId={c.id} />}
    </div>
  )
}

function ApplyCredit({ clientId, credit, projects, initial, onClose }: { clientId: string; credit: number; projects: ProjectWithFin[]; initial: ProjectWithFin | null; onClose: () => void }) {
  const qc = useQueryClient()
  const due = projects.filter((p) => Number(p.fin?.client_remaining) > 0)
  const [projectId, setProjectId] = useState(initial?.id ?? due[0]?.id ?? '')
  const project = due.find((p) => p.id === projectId)
  const max = Math.min(credit, Number(project?.fin?.client_remaining ?? 0))
  const [amount, setAmount] = useState(String(max || ''))
  const [notes, setNotes] = useState('')
  const [key] = useState(newKey)
  const amt = Number(amount)
  const invalid = !project || !amount || Number.isNaN(amt) || amt <= 0 || amt > max
  const apply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('apply_client_credit', { p_key: key, p_client_id: clientId, p_project_id: projectId, p_amount: amt, p_notes: (notes.trim() || null) as string })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تطبيق الرصيد على المشروع')
      invalidateFinance(qc)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal
      title="تطبيق الرصيد الدائن على مشروع"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={apply.isPending} disabled={invalid} onClick={() => apply.mutate()}>
            تطبيق
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">
          الرصيد المتاح <Money value={credit} className="font-semibold text-ink" />. لا يتجاوز التطبيق المتبقي على المشروع، ولا تتحرك أي خزينة.
        </p>
        {!due.length ? (
          <p className="text-sm">لا توجد مشاريع عليها مبالغ متبقية.</p>
        ) : (
          <>
            <Field label="المشروع">
              <Select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  const p = due.find((x) => x.id === e.target.value)
                  setAmount(String(Math.min(credit, Number(p?.fin?.client_remaining ?? 0))))
                }}
              >
                {due.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — متبقٍ {formatMoney(p.fin?.client_remaining)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المبلغ (د.ل)" required hint={`الحد الأعلى ${formatMoney(max)}`} error={amount && invalid ? `بين 0 و ${formatMoney(max)}` : null}>
              <Input type="number" dir="ltr" step="0.001" min={0} max={max} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="ملاحظات">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}

function EditClient({ open, client, onClose }: { open: boolean; client: Tables<'clients'>; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState(client)
  const [dirty, setDirty] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setF(client)
      setDirty(false)
    }
  }
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .update({ name: f.name.trim(), phone: f.phone || null, email: f.email || null, city: f.city || null, address: f.address || null, notes: f.notes || null })
        .eq('id', client.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات الزبون')
      qc.invalidateQueries({ queryKey: ['client', client.id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const set = (p: Partial<Tables<'clients'>>) => {
    setF({ ...f, ...p })
    setDirty(true)
  }
  return (
    <SidePanel
      open={open}
      title="تعديل بيانات الزبون"
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <Button loading={save.isPending} disabled={!f.name.trim()} onClick={() => save.mutate()}>
            حفظ
          </Button>
          <Button variant="secondary" onClick={async () => (await confirmDiscard(dirty)) && onClose()}>
            إلغاء
          </Button>
        </>
      }
    >
      <Field label="الاسم" required error={!f.name.trim() ? 'الاسم مطلوب' : null}>
        <Input value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الهاتف">
          <Input dir="ltr" type="tel" value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="المدينة">
          <Input value={f.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        </Field>
      </div>
      <Field label="البريد">
        <Input dir="ltr" type="email" value={f.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <Field label="العنوان">
        <Input value={f.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Field label="ملاحظات">
        <Textarea value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </SidePanel>
  )
}
