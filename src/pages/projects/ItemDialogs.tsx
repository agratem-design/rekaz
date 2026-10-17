import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, PackagePlus, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { Modal } from '@/components/dialog'
import { SidePanel } from '@/components/SidePanel'
import { Badge, Button, Checkbox, EmptyState, Field, FilterChips, Input, Money, SearchInput, Section, Select, Spinner, cn } from '@/components/ui'
import { WorkForm } from '../technicians/TechForms'
import { WorkTable } from '../technicians/WorkTable'
import { financeKeys } from '@/components/pickers'
import { newKey } from '@/lib/queries'
import { todayISO } from '@/lib/format'
import { Link } from 'react-router-dom'
import { formatMoney } from '@/lib/format'
import { options, rateUnitLabels } from '@/lib/labels'
import { usePhases, useUnits } from '@/lib/queries'
import { errorMessage, supabase, type Enums } from '@/lib/supabase'
import { useCatalog, type Item } from './ItemForm'

const refreshItems = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ['project_items', 'project', 'project_financials', 'project_item_staffing', 'item_staff', 'assignment', ...financeKeys]) qc.invalidateQueries({ queryKey: [k] })
}

// ───────────── استيراد عدة بنود عامة دفعة واحدة ─────────────
export function ImportCatalogModal({ projectId, nextOrder, defaultPhase, onClose }: { projectId: string; nextOrder: number; defaultPhase?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const catalog = useCatalog()
  const units = useUnits()
  const phases = usePhases(projectId)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [phase, setPhase] = useState(defaultPhase ?? '')
  const [picked, setPicked] = useState<Record<string, { qty: string; price: string }>>({})

  const active = (catalog.data ?? []).filter((c) => c.is_active)
  const categories = [...new Set(active.map((c) => c.category).filter(Boolean))] as string[]
  const shown = active.filter((c) => (category === 'all' || c.category === category) && (!search.trim() || c.name.includes(search.trim())))
  const unitSym = useMemo(() => new Map((units.data ?? []).map((u) => [u.id, u.symbol])), [units.data])
  const chosen = Object.entries(picked)
  const total = chosen.reduce((a, [, v]) => a + (Number(v.qty) || 0) * (Number(v.price) || 0), 0)
  const invalid = chosen.some(([, v]) => !(Number(v.qty) > 0) || Number(v.price) < 0 || v.price === '')

  const imp = useMutation({
    mutationFn: async () => {
      const rows = chosen.map(([id, v], i) => {
        const c = active.find((x) => x.id === id)!
        return {
          project_id: projectId,
          catalog_item_id: c.id,
          name: c.name,
          description: c.description,
          unit_id: c.unit_id,
          phase_id: phase || null,
          quantity: Number(v.qty),
          unit_price: Number(v.price),
          order_index: nextOrder + i,
        }
      })
      const { error } = await supabase.from('project_items').insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: (n) => {
      toast.success(`تم استيراد ${n} بند`)
      refreshItems(qc)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const toggle = (id: string, on: boolean) => {
    const c = active.find((x) => x.id === id)
    setPicked((p) => {
      const n = { ...p }
      if (on) n[id] = { qty: '1', price: c?.default_unit_price?.toString() ?? '' }
      else delete n[id]
      return n
    })
  }

  return (
    <Modal
      title="استيراد من البنود العامة"
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button loading={imp.isPending} disabled={!chosen.length || invalid} onClick={() => imp.mutate()}>
            <PackagePlus className="size-4" />
            استيراد ({chosen.length})
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <span className="ms-auto text-sm text-muted">
            الإجمالي <Money value={total} className="font-semibold text-ink" />
          </span>
        </div>
      }
    >
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث في البنود العامة…" />
          <Field label="إلى المرحلة" className="min-w-48">
            <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">بدون مرحلة</option>
              {(phases.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference_number} — {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {categories.length > 0 && <FilterChips value={category} onChange={setCategory} options={[{ value: 'all', label: 'الكل' }, ...categories.map((c) => ({ value: c, label: c }))]} />}
      </div>
      {catalog.isLoading ? (
        <Spinner />
      ) : !shown.length ? (
        <EmptyState title="لا توجد بنود عامة" children="أضف البنود العامة من شاشة «البنود العامة» أولاً." />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((c) => {
            const p = picked[c.id]
            return (
              <li key={c.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-2.5', p && 'bg-accent-soft/60')}>
                <Checkbox checked={Boolean(p)} onChange={(on) => toggle(c.id, on)} label={<span className="font-medium">{c.name}</span>} />
                {c.category && <Badge>{c.category}</Badge>}
                <span className="ms-auto text-xs text-muted">{c.default_unit_price ? `${formatMoney(c.default_unit_price)} د.ل / ${unitSym.get(c.unit_id ?? '') ?? 'وحدة'}` : 'بلا سعر'}</span>
                {p && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Input aria-label="الكمية" placeholder="الكمية" type="number" dir="ltr" step="0.001" min={0} className="h-8 w-24" value={p.qty} onChange={(e) => setPicked({ ...picked, [c.id]: { ...p, qty: e.target.value } })} />
                    <Input aria-label="سعر الوحدة" placeholder="السعر" type="number" dir="ltr" step="0.001" min={0} className="h-8 w-28" value={p.price} onChange={(e) => setPicked({ ...picked, [c.id]: { ...p, price: e.target.value } })} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

// ───────────── نقل بنود إلى مرحلة ─────────────
export function MovePhaseModal({ projectId, itemIds, onClose, onDone }: { projectId: string; itemIds: string[]; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const phases = usePhases(projectId)
  const [phase, setPhase] = useState('')
  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_items').update({ phase_id: phase || null }).in('id', itemIds)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`تم نقل ${itemIds.length} بند`)
      refreshItems(qc)
      onDone()
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal
      title={itemIds.length > 1 ? `نقل ${itemIds.length} بنود إلى مرحلة أخرى` : 'نقل البند إلى مرحلة أخرى'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={move.isPending} onClick={() => move.mutate()}>
            نقل
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="p-5">
        <Field label="المرحلة الهدف">
          <Select value={phase} onChange={(e) => setPhase(e.target.value)} autoFocus>
            <option value="">بدون مرحلة (المشروع الرئيسي)</option>
            {(phases.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference_number} — {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

// ───────────── الفنيون على البند: المتطلبات والتعيينات (خطة عمل، صفر أثر مالي) ─────────────
export function StaffingPanel({ item, siblings, onClose }: { item: Item | null; siblings: Item[]; onClose: () => void }) {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'engineer', 'supervisor')
  const qc = useQueryClient()
  const id = item?.id
  const [workTech, setWorkTech] = useState<string | null>(null)
  const [workKey, setWorkKey] = useState(newKey)
  const [postDue, setPostDue] = useState(true)
  const [retryDue, setRetryDue] = useState(false)
  const data = useQuery({
    queryKey: ['item_staff', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [req, asg, types, techs] = await Promise.all([
        supabase.from('project_item_staffing').select('*').eq('project_item_id', id!),
        supabase.from('project_item_assignments').select('*, technicians(name, technician_type_id)').eq('project_item_id', id!).order('created_at'),
        supabase.from('technician_types').select('id, name, is_active').order('name'),
        supabase.from('technicians').select('id, name, technician_type_id, default_rate, default_rate_unit, is_active').order('name'),
      ])
      for (const r of [req, asg, types, techs]) if (r.error) throw r.error
      return { req: req.data!, asg: asg.data!, types: types.data!, techs: techs.data! }
    },
  })
  const [newReq, setNewReq] = useState({ type: '', count: '1' })
  const [newAsg, setNewAsg] = useState<{ tech: string; unit: Enums<'rate_unit'> | ''; rate: string; qty: string }>({ tech: '', unit: '', rate: '', qty: '' })
  const [copyFrom, setCopyFrom] = useState('')

  const run = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await fn()
      if (error) throw error
    },
    onSuccess: () => refreshItems(qc),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const typeName = new Map((data.data?.types ?? []).map((t) => [t.id, t.name]))
  const assignedIds = new Set((data.data?.asg ?? []).map((a) => a.technician_id))
  const missing = (data.data?.req ?? []).reduce((a, r) => a + Number(r.missing_count), 0)

  return (
    <><SidePanel open={item !== null && !workTech} size="lg" title="عمال البند ومستحقاتهم" description={item?.name} dirty={Boolean(newAsg.tech)} onClose={() => { if (!run.isPending) onClose() }}>
      {data.isLoading ? (
        <Spinner />
      ) : data.error ? (
        <div className="text-sm text-red-600">{errorMessage(data.error)}</div>
      ) : (
        data.data && (
          <>
            <div className="mb-5 rounded-xl border border-line bg-accent-soft p-4 text-sm leading-7">أضف أكثر من عامل لهذا البند، وحدد الكمية والسعر لكل عامل. عند اختيار تسجيل المستحق، يظهر المبلغ في حساب العامل وتكلفة المشروع مباشرة.</div>
            <Section title="التخصصات المطلوبة">
              {!data.data.req.length ? (
                <p className="text-sm text-muted">لا توجد متطلبات عمالة لهذا البند.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {data.data.req.map((r) => (
                    <li key={r.technician_type_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="flex-1 font-medium">{typeName.get(r.technician_type_id!)}</span>
                      <span className="num text-muted">
                        {r.assigned_count} / {r.required_count}
                      </span>
                      {Number(r.missing_count) > 0 ? <Badge tone="amber">ناقص {r.missing_count}</Badge> : <Badge tone="green">مكتمل</Badge>}
                      {canWrite && (
                        <Button variant="ghost" size="icon" className="size-7 hover:text-red-600" aria-label="حذف المتطلب" onClick={() => run.mutate(() => supabase.from('project_item_requirements').delete().eq('project_item_id', id!).eq('technician_type_id', r.technician_type_id!))}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && (
                <div className="flex items-end gap-2">
                  <Field label="تخصص" className="flex-1">
                    <Select value={newReq.type} onChange={(e) => setNewReq({ ...newReq, type: e.target.value })}>
                      <option value="">— اختر —</option>
                      {data.data.types
                        .filter((t) => t.is_active && !data.data!.req.some((r) => r.technician_type_id === t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="العدد" className="w-20">
                    <Input type="number" min={1} dir="ltr" value={newReq.count} onChange={(e) => setNewReq({ ...newReq, count: e.target.value })} />
                  </Field>
                  <Button
                    variant="secondary"
                    disabled={!newReq.type || !(Number(newReq.count) > 0)}
                    onClick={() =>
                      run.mutate(async () => {
                        const r = await supabase.from('project_item_requirements').insert({ project_item_id: id!, technician_type_id: newReq.type, required_count: Number(newReq.count) })
                        if (!r.error) setNewReq({ type: '', count: '1' })
                        return r
                      })
                    }
                  >
                    <Plus className="size-4" />
                    إضافة
                  </Button>
                </div>
              )}
            </Section>

            <Section title="الفنيون المعيّنون">
              {missing > 0 && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">خطة العمالة ناقصة بـ {missing} فني</div>}
              {!data.data.asg.length ? (
                <EmptyState icon={Users} title="لم يُعيَّن فنيون لهذا البند" />
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {data.data.asg.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <Link to={`/technicians/${a.technician_id}`} className="flex-1 font-medium text-accent hover:underline">{a.technicians?.name}</Link>
                      <span className="text-xs text-muted">{typeName.get(a.technicians?.technician_type_id ?? '') ?? ''}</span>
                      {a.agreed_rate !== null && (
                        <span className="text-xs">
                          <Money value={a.agreed_rate} /> {a.rate_unit ? rateUnitLabels[a.rate_unit] : ''}
                          {a.planned_quantity ? <span className="num text-muted"> × {a.planned_quantity}</span> : null}
                        </span>
                      )}
                      {canWrite && <Button size="sm" variant="soft" onClick={() => setWorkTech(a.technician_id)}>تسجيل مستحق</Button>}
                      {canWrite && (
                        <Button variant="ghost" size="icon" className="size-7 hover:text-red-600" aria-label="إزالة الفني" onClick={() => run.mutate(() => supabase.from('project_item_assignments').delete().eq('id', a.id))}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && (
                <div className="space-y-3 rounded-lg border border-dashed border-line-strong p-3">
                  <fieldset disabled={run.isPending || retryDue} className="grid gap-3 sm:grid-cols-2">
                    <Field label="الفني">
                      <Select
                        value={newAsg.tech}
                        onChange={(e) => {
                          const t = data.data!.techs.find((x) => x.id === e.target.value)
                          setNewAsg({ ...newAsg, tech: e.target.value, unit: t?.default_rate_unit ?? '', rate: t?.default_rate?.toString() ?? '' })
                        }}
                      >
                        <option value="">— اختر الفني —</option>
                        {data.data.techs
                          .filter((t) => t.is_active && (!assignedIds.has(t.id) || t.id === newAsg.tech))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                              {t.technician_type_id ? ` — ${typeName.get(t.technician_type_id) ?? ''}` : ''}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field label="طريقة الحساب">
                      <Select value={newAsg.unit} onChange={(e) => setNewAsg({ ...newAsg, unit: e.target.value as Enums<'rate_unit'> })}>
                        <option value="">—</option>
                        {options(rateUnitLabels).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="السعر المتفق (د.ل)">
                      <Input type="number" dir="ltr" step="0.001" min={0} value={newAsg.rate} onChange={(e) => setNewAsg({ ...newAsg, rate: e.target.value })} />
                    </Field>
                    <Field label={postDue ? "الكمية المستحقة" : "الكمية المخططة"}>
                      <Input type="number" dir="ltr" step="0.001" min={0} value={newAsg.qty} onChange={(e) => setNewAsg({ ...newAsg, qty: e.target.value })} />
                    </Field>
                  </fieldset>
                  <Checkbox disabled={run.isPending || retryDue} checked={postDue} onChange={setPostDue} label="تسجيل المبلغ مستحقاً في حساب العامل الآن" />
                  {postDue && <div className="flex justify-between rounded-lg bg-accent-soft p-3 text-sm"><span>المبلغ الذي سيضاف لحساب العامل</span><Money value={Number(newAsg.rate || 0) * Number(newAsg.qty || 0)} className="font-semibold" /></div>}
                  <Button
                    variant="soft"
                    loading={run.isPending}
                    disabled={!newAsg.tech || (postDue && (!newAsg.unit || newAsg.rate === '' || !Number.isFinite(Number(newAsg.rate)) || Number(newAsg.rate) < 0 || !Number.isFinite(Number(newAsg.qty)) || Number(newAsg.qty) <= 0))}
                    onClick={() =>
                      run.mutate(async () => {
                        const r = await supabase.from('project_item_assignments').upsert({
                          project_item_id: id!,
                          technician_id: newAsg.tech,
                          rate_unit: newAsg.unit || null,
                          agreed_rate: newAsg.rate === '' ? null : Number(newAsg.rate),
                          planned_quantity: newAsg.qty === '' ? null : Number(newAsg.qty),
                        }, { onConflict: 'project_item_id,technician_id' })
                        if (r.error) return r
                        if (postDue) {
                          const posted = await supabase.rpc('record_technician_work', { p_key: workKey, p_technician_id: newAsg.tech, p_project_id: item!.project_id, p_item_id: id!, p_phase_id: item!.phase_id as string, p_date: todayISO(), p_rate_unit: newAsg.unit as Enums<'rate_unit'>, p_quantity: Number(newAsg.qty), p_rate: Number(newAsg.rate), p_description: `مستحق البند: ${item!.name}` })
                          if (posted.error) { setRetryDue(true); toast.info('تم تعيين العامل، لكن لم يُسجل المستحق. أعد المحاولة بنفس البيانات.'); return posted }
                        }
                        toast.success(postDue ? 'تم ربط العامل بالبند وتسجيل مستحقه في حسابه' : 'تم تعيين العامل')
                        setRetryDue(false)
                        setWorkKey(newKey())
                        setNewAsg({ tech: '', unit: '', rate: '', qty: '' })
                        return r
                      })
                    }
                  >
                    <UserPlus className="size-4" />
                    {retryDue ? 'إعادة محاولة تسجيل المستحق' : postDue ? 'إضافة العامل وتسجيل المستحق' : 'تعيين العامل فقط'}
                  </Button>
                </div>
              )}
              {canWrite && siblings.length > 1 && (
                <div className="flex items-end gap-2">
                  <Field label="نسخ الفنيين من بند آخر" className="flex-1">
                    <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                      <option value="">— اختر البند المصدر —</option>
                      {siblings
                        .filter((s) => s.id !== id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Button
                    variant="secondary"
                    disabled={!copyFrom}
                    onClick={() =>
                      run.mutate(async () => {
                        const src = await supabase.from('project_item_assignments').select('technician_id, rate_unit, agreed_rate, planned_quantity').eq('project_item_id', copyFrom)
                        if (src.error) return src
                        const rows = src.data.filter((s) => !assignedIds.has(s.technician_id)).map((s) => ({ ...s, project_item_id: id! }))
                        if (!rows.length) {
                          toast.info('كل فنيي البند المصدر موجودون بالفعل')
                          return { error: null }
                        }
                        const r = await supabase.from('project_item_assignments').insert(rows)
                        if (!r.error) toast.success(`تم نسخ ${rows.length} فني`)
                        return r
                      })
                    }
                  >
                    <Copy className="size-4" />
                    نسخ
                  </Button>
                </div>
              )}
            </Section>
            <Section title="المستحقات المسجلة على هذا البند"><WorkTable projectId={item!.project_id} itemId={id} /></Section>
          </>
        )
      )}
    </SidePanel>
    {item && <WorkForm open={Boolean(workTech)} onClose={() => setWorkTech(null)} technicianId={workTech ?? undefined} projectId={item.project_id} phaseId={item.phase_id ?? undefined} itemId={item.id} />}
    </>
  )
}
