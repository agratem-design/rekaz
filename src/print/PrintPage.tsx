import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { Button, ErrorState, Spinner } from '@/components/ui'
import { errorMessage, supabase } from '@/lib/supabase'
import { formatDate, formatMoney } from '@/lib/format'
import { contractStatusLabels, paymentMethodLabels } from '@/lib/labels'
import { AmountBox, InfoGrid, PrintDocument, PrintSection, PrintTable, Signatures } from './PrintDocument'
import { ensurePrintFont, resolvePrintSettings, type Company } from './printSettings'

// صفحة طباعة مستقلة (بلا شريط جانبي): /print/:kind/:id  — ?auto=1 يفتح نافذة الطباعة مباشرة
export default function PrintPage() {
  const { kind = '', id = '' } = useParams()
  const [params] = useSearchParams()
  const company = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').single()
      if (error) throw error
      return data
    },
  })
  const doc = useQuery({ queryKey: ['print', kind, id], queryFn: () => loaders[kind]?.(id) ?? Promise.reject(new Error('نوع مستند غير معروف')) })
  const settings = resolvePrintSettings(company.data)

  useEffect(() => ensurePrintFont(settings.print_font_family), [settings.print_font_family])
  useEffect(() => {
    if (doc.data) document.title = `${doc.data.title} ${doc.data.number ?? ''}`.trim()
  }, [doc.data])
  const ready = Boolean(doc.data && company.data)
  useEffect(() => {
    if (ready && params.get('auto') === '1') {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [ready, params])

  return (
    <div className="min-h-dvh bg-stone-200/70 pb-10 dark:bg-stone-900">
      <div className="no-print sticky top-0 z-10 mb-6 flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 shadow-sm">
        <span className="flex-1 truncate text-sm font-medium">{doc.data?.title ?? 'طباعة'}</span>
        <Button onClick={() => window.print()} disabled={!ready}>
          <Printer className="size-4" />
          طباعة
        </Button>
        <Button variant="secondary" onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
          <X className="size-4" />
          إغلاق
        </Button>
      </div>
      {doc.isLoading || company.isLoading ? (
        <Spinner />
      ) : doc.error || company.error ? (
        <div className="mx-auto max-w-lg">
          <ErrorState message={errorMessage(doc.error ?? company.error)} />
        </div>
      ) : (
        doc.data && doc.data.render(company.data!, settings)
      )}
    </div>
  )
}

type Loaded = { title: string; number?: string; render: (company: Company, s: ReturnType<typeof resolvePrintSettings>) => React.ReactNode }

const loaders: Record<string, (id: string) => Promise<Loaded>> = {
  // ───────────── سند قبض من زبون ─────────────
  async receipt(id) {
    const { data: r, error } = await supabase
      .from('client_receipts')
      .select('*, clients(name, phone), projects(name), treasuries(name)')
      .eq('id', id)
      .single()
    if (error) throw error
    const number = String(r.receipt_no)
    return {
      title: 'سند قبض',
      number,
      render: (company, s) => (
        <PrintDocument
          company={company}
          settings={s}
          title="سند قبض"
          number={number}
          date={formatDate(r.receipt_date)}
          compact
          cancelled={r.status === 'reversed' ? { reason: r.reversal_reason, at: formatDate(r.reversed_at) } : null}
        >
          <InfoGrid
            items={[
              { label: 'استلمنا من', value: r.clients?.name, wide: true },
              { label: 'وذلك عن', value: r.projects ? `دفعة على مشروع «${r.projects.name}»` : 'دفعة مقدمة على حساب الزبون (رصيد دائن)', wide: true },
              { label: 'طريقة الدفع', value: paymentMethodLabels[r.method] },
              { label: 'المرجع', value: r.reference },
              { label: 'أودع في', value: r.treasuries?.name },
              { label: 'هاتف الزبون', value: r.clients?.phone ? <span className="num">{r.clients.phone}</span> : null },
              ...(r.notes ? [{ label: 'ملاحظات', value: r.notes, wide: true }] : []),
            ]}
          />
          <AmountBox amount={Number(r.amount)} label="المبلغ المستلم" cancelled={r.status === 'reversed'} />
          <Signatures
            items={[
              { label: 'المستلم (أمين الصندوق)', name: company.signee_name ?? undefined, note: company.signee_title ?? undefined },
              { label: 'الدافع', name: r.clients?.name },
            ]}
          />
        </PrintDocument>
      ),
    }
  },

  // ───────────── العقد ─────────────
  async contract(id) {
    const [c, items, clauses] = await Promise.all([
      supabase.from('contracts').select('*, clients(name, phone, address, city), projects(name, location), project_phases(name, reference_number)').eq('id', id).single(),
      supabase.from('contract_items').select('*').eq('contract_id', id).order('order_index'),
      supabase.from('contract_clauses').select('*').eq('contract_id', id).order('order_index'),
    ])
    if (c.error) throw c.error
    if (items.error) throw items.error
    if (clauses.error) throw clauses.error
    const k = c.data
    const itemsTotal = items.data.reduce((a, i) => a + Number(i.total_price), 0)
    const amount = Number(k.amount) || itemsTotal
    return {
      title: 'عقد',
      number: k.contract_number ?? undefined,
      render: (company, s) => (
        <PrintDocument
          company={company}
          settings={s}
          title={s.contract_title_text}
          number={k.contract_number ?? '—'}
          date={formatDate(k.start_date ?? k.created_at)}
          subtitle={k.status !== 'active' ? `الحالة: ${contractStatusLabels[k.status]}` : undefined}
          cancelled={k.status === 'cancelled' ? {} : null}
        >
          <h2 style={{ textAlign: 'center', fontSize: '15pt', fontWeight: 700, margin: '0 0 2mm' }}>{k.title}</h2>
          <InfoGrid
            items={[
              { label: 'الطرف الأول', value: company.company_name },
              { label: 'الطرف الثاني', value: k.clients?.name },
              { label: 'المشروع', value: k.projects?.name },
              { label: 'الموقع', value: k.projects?.location },
              ...(k.project_phases ? [{ label: 'المرحلة', value: `${k.project_phases.name} (${k.project_phases.reference_number ?? ''})` }] : []),
              { label: 'مدة التنفيذ', value: k.start_date ? `من ${formatDate(k.start_date)}${k.end_date ? ` إلى ${formatDate(k.end_date)}` : ''}` : null },
              { label: 'شروط الدفع', value: k.payment_terms, wide: true },
            ]}
          />
          {k.description && (
            <PrintSection title="التمهيد">
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{k.description}</p>
            </PrintSection>
          )}
          {clauses.data.length > 0 && (
            <PrintSection title="الشروط والأحكام">
              {clauses.data.map((cl, i) => (
                <div key={cl.id} className="pd-clause">
                  <span className="pd-clause-no num">{i + 1}</span>
                  <div>
                    <strong>{cl.title}</strong>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{cl.content}</div>
                  </div>
                </div>
              ))}
            </PrintSection>
          )}
          {items.data.length > 0 && (
            <PrintSection title="جدول الكميات والأسعار">
              <PrintTable
                columns={[
                  { label: 'م', width: '8mm', align: 'center', render: (_r, i) => <span className="num">{i + 1}</span> },
                  { label: 'البند', render: (r) => r.name },
                  { label: 'الكمية', align: 'center', width: '22mm', render: (r) => <span className="num">{formatMoney(r.quantity)}</span> },
                  { label: 'سعر الوحدة', align: 'end', width: '28mm', render: (r) => <span className="num">{formatMoney(r.unit_price)}</span> },
                  { label: 'الإجمالي', align: 'end', width: '30mm', render: (r) => <span className="num">{formatMoney(r.total_price)}</span> },
                ]}
                rows={items.data}
                totals={[{ label: 'إجمالي البنود', value: formatMoney(itemsTotal) }]}
              />
            </PrintSection>
          )}
          <AmountBox amount={amount} label="قيمة العقد" />
          {k.notes && (
            <PrintSection title="ملاحظات">
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{k.notes}</p>
            </PrintSection>
          )}
          <Signatures
            items={[
              { label: 'الطرف الأول (الشركة)', name: company.company_name, note: company.signee_name ? `عنها: ${company.signee_name}${company.signee_title ? ` (${company.signee_title})` : ''}` : undefined },
              { label: 'الطرف الثاني (الزبون)', name: k.clients?.name },
            ]}
          />
        </PrintDocument>
      ),
    }
  },
}
