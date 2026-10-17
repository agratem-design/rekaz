import { supabase } from '@/lib/supabase'
import { formatDate, formatMoney } from '@/lib/format'
import { AmountBox, InfoGrid, PrintDocument, PrintSection, PrintTable, Signatures } from './PrintDocument'
import type { Loader } from './financeDocs'
import type { InvoiceLine } from '@/pages/billing/CustomerInvoices'

export const customerInvoiceLoaders: Record<string, Loader> = {
  async 'customer-invoice'(id) {
    const { data: invoice, error } = await supabase.from('customer_invoices').select('*').eq('id', id).single()
    if (error) throw error
    const [c,p] = await Promise.all([
      supabase.from('clients').select('name').eq('id', invoice.client_id).single(),
      invoice.project_id ? supabase.from('projects').select('name, description').eq('id',invoice.project_id).single() : Promise.resolve({ data: null, error: null }),
    ])
    if(c.error || p.error) throw c.error ?? p.error
    const lines = invoice.lines as unknown as InvoiceLine[]
    const measured = lines.some((l) => l.quantity !== undefined)
    const parties = lines.some((l) => l.party || l.reference)
    const sections = [...new Set(lines.map((l) => l.section || 'بنود المستند'))]
    const summary = invoice.document_type === 'summary'
    return { title: invoice.title, number: invoice.invoice_number ?? undefined, render: (company,s) => (
      <PrintDocument dense company={company} settings={s} title={invoice.title} number={invoice.invoice_number ?? undefined} date={invoice.invoice_date ? formatDate(invoice.invoice_date) : undefined} cancelled={invoice.status === 'reversed' ? { reason: invoice.reversal_reason, at: formatDate(invoice.reversed_at) } : null}>
        <InfoGrid items={[{label:'الزبون',value:c.data?.name,wide:true},{label:'المشروع',value:p.data?.name ?? 'ملخص حساب الزبون',wide:true},{label:'المصدر',value:invoice.source_filename?.replace(/^\uFFFD+/, ''),wide:true}]} />
        {sections.map((section) => <PrintSection key={section} title={section}><PrintTable<InvoiceLine>
          columns={[
            { label:'م',width:'9mm',align:'center',render:(_l,i)=><span className="num">{i+1}</span> },
            { label:'البيان',render:(l)=><><div>{l.label}</div>{l.detail && <div className="pd-small">{l.detail}</div>}</> },
            ...(parties ? [ {label:'المورد / العامل',width:'27mm',render:(l:InvoiceLine)=>l.party || '—'}, {label:'رقم الفاتورة',width:'21mm',render:(l:InvoiceLine)=><span className="num">{l.reference || '—'}</span>} ] : []),
            ...(measured ? [{label:'الوحدة',width:'15mm',render:(l:InvoiceLine)=>l.unit || '—'},{label:'الكمية',width:'18mm',align:'end' as const,render:(l:InvoiceLine)=><span className="num">{l.quantity === undefined ? '—' : formatMoney(l.quantity)}</span>},{label:'السعر',width:'19mm',align:'end' as const,render:(l:InvoiceLine)=><span className="num">{l.rate === undefined ? '—' : formatMoney(l.rate)}</span>}] : []),
            {label:'القيمة (د.ل)',width:'27mm',align:'end',render:(l)=><span className="num">{formatMoney(l.amount)}</span>},
          ]} rows={lines.filter((l)=>(l.section || 'بنود المستند')===section)}
          totals={!summary ? [{label:'مجموع القسم',value:formatMoney(lines.filter((l)=>(l.section || 'بنود المستند')===section).reduce((a,l)=>a+l.amount,0))}] : undefined}
        /></PrintSection>)}
        <div className="pd-closing">
        {!summary && invoice.fee_percentage > 0 && <PrintSection title="ملخص الفاتورة"><PrintTable columns={[{label:'البيان',render:(l:[string,number])=>l[0]},{label:'القيمة (د.ل)',align:'end',render:(l)=><span className="num">{formatMoney(l[1])}</span>}]} rows={[["الإجمالي قبل أتعاب الشركة",invoice.subtotal],[`أتعاب الشركة ${invoice.fee_percentage}%`,invoice.fee_amount]]} /></PrintSection>}
        <AmountBox amount={invoice.amount} label={summary ? 'الإجمالي كما ورد في الملخص الأصلي' : 'إجمالي المستند'} />
        {invoice.notes && <PrintSection title="ملاحظات المطابقة"><p style={{whiteSpace:'pre-wrap',lineHeight:1.8,margin:0}}>{invoice.notes}</p></PrintSection>}
        {summary && <p className="pd-small">ملخص مرجعي للمصدر، لا ينشئ مطالبة أو حركة خزينة إضافية. راجع كشف حساب الزبون للحصول على الرصيد الحالي.</p>}
        <Signatures items={[{label:'المفوض',name:company.signee_name ?? undefined}]} />
        </div>
      </PrintDocument>
    ) }
  },
}


