import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Banknote, CircleDollarSign, Coins, Layers, Package, PiggyBank, Scale, TrendingUp, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { Modal } from '@/components/dialog'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, KeyValue, Money, ProgressBar, StatCard, Textarea, cn } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { phaseStatusLabels, phaseStatusTone } from '@/lib/labels'
import { newKey, usePhases, type ProjectDetail } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { invalidateFinance } from '../receipts/ReceiptForm'

export function OverviewTab({ p, onReceipt }: { p: ProjectDetail; onReceipt: () => void }) {
  const { hasRole } = useAuth()
  const finance = hasRole('admin', 'accountant')
  const phases = usePhases(p.id)
  const items = useQuery({
    queryKey: ['project_items', p.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_items').select('*').eq('project_id', p.id).order('order_index')
      if (error) throw error
      return data
    },
  })
  const staffing = useQuery({
    queryKey: ['project_item_staffing', p.id],
    queryFn: async () => {
      const ids = (items.data ?? []).map((i) => i.id)
      if (!ids.length) return []
      const { data, error } = await supabase.from('project_item_staffing').select('*').in('project_item_id', ids).gt('missing_count', 0)
      if (error) throw error
      return data
    },
    enabled: Boolean(items.data),
  })
  const [moving, setMoving] = useState(false)

  const f = p.fin
  const c = p.costs
  const contracting = p.project_type === 'contracting'
  const remaining = Number(f?.client_remaining ?? 0)
  const itemsTotal = Number(f?.items_total ?? 0)
  const progress = itemsTotal > 0 ? (Number(f?.earned_value ?? 0) / itemsTotal) * 100 : 0
  const understaffedItems = new Set((staffing.data ?? []).map((s) => s.project_item_id)).size

  return (
    <div className="space-y-5">
      {finance && f && (
        // القيمة والمحصّل والمتبقي في رأس مساحة العمل؛ هنا مصدر القيمة والتكلفة والربح
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
          {contracting ? (
            <StatCard icon={Scale} label="مصدر قيمة المشروع" value={<Money value={f.client_obligation} />} hint={Number(f.contracts_total) > 0 ? 'من العقود المعتمدة' : 'من مجموع بنود المقاولات'} />
          ) : (
            <StatCard icon={Scale} label="إجمالي استحقاق الزبون" value={<Money value={f.client_obligation} />} hint={`التكلفة + نسبة ${p.finishing_percentage ?? 0}%`} />
          )}
          <StatCard icon={Banknote} label="التكلفة المباشرة" value={<Money value={f.direct_cost} />} tone="blue" hint="مواد وخدمات وعمالة ومصروفات" />
          {contracting ? (
            <StatCard icon={TrendingUp} label="الربح حتى تاريخه" value={<Money value={f.gross_profit_to_date} />} hint="المكتسب حسب الإنجاز − التكلفة" tone="sand" />
          ) : (
            <StatCard icon={PiggyBank} label="أتعاب الشركة" value={<Money value={f.company_fee} />} hint={`التكلفة المباشرة ${formatMoney(f.direct_cost)}`} tone="sand" />
          )}
        </div>
      )}

      {finance && remaining < 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sand-300 bg-sand-50 p-4 text-sm dark:border-sand-700 dark:bg-sand-700/15">
          <CircleDollarSign className="size-5 text-sand-600" />
          <div className="flex-1">
            <div className="font-semibold text-sand-700 dark:text-sand-200">الزبون دفع أكثر من التزامه على هذا المشروع</div>
            <div className="text-sand-700/80 dark:text-sand-200/80">
              الزيادة <Money value={-remaining} className="font-semibold" /> تبقى على المشروع حتى تنقلها صراحة إلى الرصيد الدائن للزبون.
            </div>
          </div>
          <Button variant="secondary" onClick={() => setMoving(true)}>
            نقل الزيادة إلى رصيد الزبون
          </Button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {finance && c && (
          <Card>
            <CardHeader title="التكاليف المباشرة" icon={Coins} description="كل تكلفة تُحسب مرة واحدة من مصدرها" />
            {[
              ['المواد', c.materials],
              ['خدمات الموردين', c.services],
              ['مرتجعات (تُطرح)', -Number(c.returns ?? 0)],
              ['أجور الفنيين (من الإنجاز)', c.labor],
              ['مصروفات المشروع', c.expenses],
            ].map(([label, v]) => (
              <div key={label as string} className="py-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <Money value={v as number} />
                </div>
                <ProgressBar value={Math.abs(Number(v))} max={Math.max(1, Number(c.direct_cost))} tone="sand" className="mt-1" />
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold">
              <span>إجمالي التكلفة المباشرة</span>
              <Money value={c.direct_cost} />
            </div>
          </Card>
        )}

        {contracting && (
          <Card>
            <CardHeader
              title="بنود المقاولات"
              icon={Package}
              action={
                <Link to={`/projects/${p.id}/items`}>
                  <Button variant="ghost" size="sm">
                    عرض البنود <ArrowLeft className="size-3.5" />
                  </Button>
                </Link>
              }
            />
            {!items.data?.length ? (
              <EmptyState icon={Package} title="لم تُدرج بنود مقاولات بعد" action={<Link to={`/projects/${p.id}/items`}><Button variant="soft">إضافة بنود المقاولات</Button></Link>} />
            ) : (
              <>
                <KeyValue label="عدد البنود">
                  <span className="num">{items.data.length}</span>
                </KeyValue>
                <KeyValue label="إجمالي تسعير البنود">
                  <Money value={itemsTotal} />
                </KeyValue>
                <KeyValue label="القيمة المكتسبة حسب الإنجاز">
                  <Money value={f?.earned_value} />
                </KeyValue>
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>متوسط الإنجاز المالي</span>
                    <span className="num">{progress.toFixed(1)}%</span>
                  </div>
                  <ProgressBar value={progress} tone="green" />
                </div>
              </>
            )}
          </Card>
        )}

        <Card>
          <CardHeader
            title="المراحل التنفيذية"
            icon={Layers}
            action={
              <Link to={`/projects/${p.id}/phases`}>
                <Button variant="ghost" size="sm">
                  إدارة المراحل <ArrowLeft className="size-3.5" />
                </Button>
              </Link>
            }
          />
          {!phases.data?.length ? (
            <EmptyState icon={Layers} title="لا توجد مراحل مسجلة بعد" action={<Link to={`/projects/${p.id}/phases`}><Button variant="soft">إضافة أول مرحلة</Button></Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {phases.data.map((ph) => (
                <li key={ph.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num w-14 text-xs text-muted">{ph.reference_number}</span>
                  <span className="flex-1 font-medium">{ph.name}</span>
                  <span className="num hidden text-xs text-muted sm:inline">{formatDate(ph.start_date)}</span>
                  <Badge tone={phaseStatusTone[ph.status]}>{phaseStatusLabels[ph.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="تنبيهات المتابعة والتحصيل" icon={AlertTriangle} />
          <ul className="space-y-2 text-sm">
            {finance && remaining > 0 && (
              <Alert tone="red" text={<>متبقٍ على الزبون <Money value={remaining} className="font-semibold" /></>} action={<Button size="sm" variant="soft" onClick={onReceipt}>تسجيل إيصال قبض</Button>} />
            )}
            {understaffedItems > 0 && (
              <Alert
                tone="amber"
                text={<>{understaffedItems} بند مقاولات بحاجة لاستكمال تعيين الفنيين المطلوبين</>}
                action={
                  <Link to={`/projects/${p.id}/items`}>
                    <Button size="sm" variant="soft">
                      <Wrench className="size-3.5" />
                      تعيين الفنيين
                    </Button>
                  </Link>
                }
              />
            )}
            {p.budget && finance && f && p.budget_type === 'estimated' && Number(f.direct_cost) > Number(p.budget) && (
              <Alert tone="red" text={<>التكلفة المباشرة تجاوزت الميزانية التقديرية <Money value={p.budget} /></>} />
            )}
            {!(finance && remaining > 0) && understaffedItems === 0 && <li className="rounded-lg bg-accent-soft px-3 py-2.5 text-brand-700 dark:text-brand-200">لا توجد مطالبات أو تنبيهات معلقة على هذا المشروع.</li>}
          </ul>
        </Card>
      </div>

      {moving && <MoveOverpayment projectId={p.id} max={-remaining} onClose={() => setMoving(false)} />}
    </div>
  )
}

function Alert({ tone, text, action }: { tone: 'red' | 'amber'; text: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className={cn('flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5', tone === 'red' ? 'bg-red-50 dark:bg-red-950/40' : 'bg-amber-50 dark:bg-amber-950/40')}>
      <span className="flex-1">{text}</span>
      {action}
    </li>
  )
}

function MoveOverpayment({ projectId, max, onClose }: { projectId: string; max: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState(String(max))
  const [notes, setNotes] = useState('')
  const [key] = useState(newKey)
  const amt = Number(amount)
  const invalid = !amount || Number.isNaN(amt) || amt <= 0 || amt > max
  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('move_project_overpayment_to_credit', { p_key: key, p_project_id: projectId, p_amount: amt, p_notes: (notes.trim() || null) as string })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('نُقلت الزيادة إلى الرصيد الدائن للزبون')
      invalidateFinance(qc)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal
      title="نقل الزيادة إلى رصيد الزبون"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={move.isPending} disabled={invalid} onClick={() => move.mutate()}>
            نقل المبلغ
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">يصبح المبلغ رصيداً دائناً للزبون يمكن تطبيقه على مشروع آخر من صفحة الزبون. لا تتحرك أي خزينة.</p>
        <Field label="المبلغ (د.ل)" required error={invalid && amount ? `بين 0 و ${formatMoney(max)}` : null} hint={`الحد الأعلى ${formatMoney(max)}`}>
          <Input type="number" dir="ltr" step="0.001" min={0} max={max} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
