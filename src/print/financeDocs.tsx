import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatMoney } from '@/lib/format'
import { paymentMethodLabels, rateUnitLabels } from '@/lib/labels'
import { AmountBox, InfoGrid, PrintDocument, PrintSection, PrintTable, Signatures } from './PrintDocument'
import type { Company, PrintSettings } from './printSettings'

export type Loaded = { title: string; number?: string; render: (company: Company, s: PrintSettings) => ReactNode }
export type Loader = (id: string, params: URLSearchParams) => Promise<Loaded>

const ref = (id: string) => id.slice(0, 8).toUpperCase()
const srcLabels: Record<string, string> = {
  opening_balance: 'رصيد افتتاحي',
  client_receipt: 'قبض من زبون',
  supplier_payment: 'دفعة لمورد',
  technician_payment: 'دفعة لفني',
  technician_deposit: 'مبلغ من فني',
  expense: 'مصروف',
  transfer: 'تحويل',
  custody_issue: 'صرف عهدة',
  custody_return: 'إرجاع عهدة',
}

type Cancel = { status: string; reversal_reason: string | null; reversed_at: string | null }
const cancelled = (r: Cancel) => (r.status === 'reversed' ? { reason: r.reversal_reason, at: formatDate(r.reversed_at) } : null)

// سند مالي بنمط النظام السابق: إطار، الطرف، «وذلك عن»، المبلغ وكتابته، توقيعان
function voucher(o: {
  title: string
  id: string
  date: string
  partyLabel: string
  party: ReactNode
  about: ReactNode
  info: { label: string; value: ReactNode; wide?: boolean }[]
  amount: number
  amountLabel?: string
  cancel: Cancel
  signs: [string, string]
  partyName?: string
}): Loaded {
  const number = ref(o.id)
  return {
    title: o.title,
    number,
    render: (company, s) => (
      <PrintDocument company={company} settings={s} title={o.title} number={number} date={formatDate(o.date)} compact cancelled={cancelled(o.cancel)}>
        <InfoGrid items={[{ label: o.partyLabel, value: o.party, wide: true }, { label: 'وذلك عن', value: o.about, wide: true }, ...o.info]} />
        <AmountBox amount={o.amount} label={o.amountLabel ?? 'المبلغ'} cancelled={o.cancel.status === 'reversed'} />
        <Signatures items={[{ label: o.signs[0], name: o.partyName }, { label: o.signs[1], name: company.signee_name ?? undefined, note: company.signee_title ?? undefined }]} />
      </PrintDocument>
    ),
  }
}

// قد تعيد maybeSingle قيمة فارغة؛ الاستخدام بعدها دائماً بـ ?.
async function one<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p
  if (error) throw error
  return data as NonNullable<T>
}

export const financeLoaders: Record<string, Loader> = {
  // ───────────── فاتورة مشتريات / مرتجع ─────────────
  async purchase(id) {
    const p = await one(supabase.from('purchases').select('*, suppliers(name, phone), projects(name, clients(name)), project_phases(name, reference_number), project_items(name)').eq('id', id).single())
    const bal = await one(supabase.from('purchase_balances').select('paid, remaining').eq('purchase_id', id).maybeSingle())
    const original = p.returns_purchase_id ? await one(supabase.from('purchases').select('invoice_no, invoice_date').eq('id', p.returns_purchase_id).single()) : null
    const lines = (Array.isArray(p.lines) ? p.lines : []) as { name: string; quantity: number; unit: string; unit_price: number; total: number }[]
    const isReturn = p.kind === 'return'
    const title = isReturn ? 'إشعار مرتجع مشتريات' : 'فاتورة شراء'
    const number = p.invoice_no ?? ref(p.id)
    return {
      title,
      number,
      render: (company, s) => (
        <PrintDocument company={company} settings={s} title={title} number={number} date={formatDate(p.invoice_date)} subtitle={p.description ?? undefined} cancelled={cancelled(p)}>
          <InfoGrid
            items={[
              { label: 'المورد', value: p.suppliers?.name },
              { label: 'هاتف المورد', value: p.suppliers?.phone ? <span className="num">{p.suppliers.phone}</span> : null },
              { label: 'المشروع', value: p.projects?.name ?? 'مشتريات عامة للشركة' },
              { label: 'الزبون', value: p.projects?.clients?.name },
              ...(p.project_phases ? [{ label: 'المرحلة', value: `${p.project_phases.name} (${p.project_phases.reference_number ?? ''})` }] : []),
              ...(p.project_items ? [{ label: 'بند المقايسة', value: p.project_items.name }] : []),
              ...(isReturn && original ? [{ label: 'مرتجع من فاتورة', value: `${original.invoice_no ?? ''} بتاريخ ${formatDate(original.invoice_date)}`, wide: true }] : []),
            ]}
          />
          <PrintSection title="بنود الفاتورة">
            <PrintTable
              columns={[
                { label: 'م', width: '9mm', align: 'center', render: (_l, i) => <span className="num">{i + 1}</span> },
                { label: 'البند', render: (l) => l.name },
                { label: 'الوحدة', width: '22mm', align: 'center', render: (l) => l.unit },
                { label: 'الكمية', width: '20mm', align: 'center', render: (l) => <span className="num">{formatMoney(l.quantity)}</span> },
                { label: 'السعر', width: '26mm', align: 'end', render: (l) => <span className="num">{formatMoney(l.unit_price)}</span> },
                { label: 'الإجمالي', width: '30mm', align: 'end', render: (l) => <span className="num">{formatMoney(l.total)}</span> },
              ]}
              rows={lines.length ? lines : [{ name: p.description ?? 'قيمة الفاتورة', unit: '—', quantity: 1, unit_price: Number(p.total_amount), total: Number(p.total_amount) }]}
              totals={[
                { label: 'الإجمالي الكلي', value: formatMoney(p.total_amount) },
                ...(!isReturn ? [{ label: 'المبلغ المسدد', value: formatMoney(bal?.paid) }, { label: 'المبلغ المتبقي', value: formatMoney(bal?.remaining) }] : []),
              ]}
            />
          </PrintSection>
          <AmountBox amount={Number(p.total_amount)} label={isReturn ? 'قيمة المرتجع' : 'إجمالي الفاتورة'} cancelled={p.status === 'reversed'} />
          {p.notes && (
            <PrintSection title="ملاحظات">
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.notes}</p>
            </PrintSection>
          )}
          <Signatures items={[{ label: 'المورد', name: p.suppliers?.name }, { label: 'المستلم / المحاسب', name: company.signee_name ?? undefined }]} />
        </PrintDocument>
      ),
    }
  },

  // ───────────── سند صرف دفعة مورد ─────────────
  async 'supplier-payment'(id) {
    const p = await one(supabase.from('supplier_payments').select('*, suppliers(name), treasuries(name), supplier_payment_allocations(amount, status, purchases(invoice_no, description))').eq('id', id).single())
    const allocs = p.supplier_payment_allocations.filter((a) => a.status === 'posted' || p.status === 'reversed')
    const allocated = allocs.reduce((a, x) => a + Number(x.amount), 0)
    const about = allocs.length
      ? `سداد ${allocs.map((a) => (a.purchases?.invoice_no ? `فاتورة #${a.purchases.invoice_no}` : (a.purchases?.description ?? 'فاتورة'))).join('، ')}${Number(p.amount) - allocated > 0 ? ` ومقدم ${formatMoney(Number(p.amount) - allocated)} د.ل` : ''}`
      : 'دفعة مقدمة على حساب المورد'
    return voucher({
      title: 'سند صرف دفعة مورد',
      id: p.id,
      date: p.payment_date,
      partyLabel: 'صرفنا إلى السيد/ة',
      party: p.suppliers?.name,
      partyName: p.suppliers?.name,
      about,
      info: [
        { label: 'طريقة الدفع', value: paymentMethodLabels[p.method] },
        { label: 'من خزينة', value: p.treasuries?.name },
        ...(p.reference ? [{ label: 'المرجع', value: p.reference }] : []),
        ...(p.notes ? [{ label: 'ملاحظات', value: p.notes, wide: true }] : []),
      ],
      amount: Number(p.amount),
      cancel: p,
      signs: ['توقيع المستلم', 'توقيع الدافع / أمين الصندوق'],
    })
  },

  // ───────────── سند صرف مستحقات فني ─────────────
  async 'technician-payment'(id) {
    const p = await one(supabase.from('technician_payments').select('*, technicians(name), treasuries(name), projects(name)').eq('id', id).single())
    return voucher({
      title: 'سند صرف مستحقات فني',
      id: p.id,
      date: p.payment_date,
      partyLabel: 'صرفنا إلى السيد/ة',
      party: p.technicians?.name,
      partyName: p.technicians?.name,
      about: p.projects?.name ? `دفعة عن أعمال مشروع «${p.projects.name}»` : 'دفعة على حساب الفني',
      info: [
        { label: 'طريقة الدفع', value: paymentMethodLabels[p.method] },
        { label: 'من خزينة', value: p.treasuries?.name },
        ...(p.notes ? [{ label: 'ملاحظات', value: p.notes, wide: true }] : []),
      ],
      amount: Number(p.amount),
      cancel: p,
      signs: ['توقيع المستلم', 'توقيع الدافع / أمين الصندوق'],
    })
  },

  // ───────────── إيصال استلام من فني ─────────────
  async 'technician-receipt'(id) {
    const r = await one(supabase.from('technician_receipts').select('*, technicians(name), treasuries(name)').eq('id', id).single())
    return voucher({
      title: 'إيصال استلام من فني',
      id: r.id,
      date: r.receipt_date,
      partyLabel: 'استلمنا من السيد/ة',
      party: r.technicians?.name,
      partyName: r.technicians?.name,
      about: r.notes ?? 'إرجاع زائد أو وديعة',
      info: [
        { label: 'طريقة الدفع', value: paymentMethodLabels[r.method] },
        { label: 'أودع في', value: r.treasuries?.name },
      ],
      amount: Number(r.amount),
      cancel: r,
      signs: ['توقيع الدافع', 'توقيع المستلم / أمين الصندوق'],
    })
  },

  // ───────────── سند صرف مصروف ─────────────
  async expense(id) {
    const e = await one(
      supabase
        .from('expenses')
        .select('*, expense_categories(name), projects(name), project_phases(name), treasuries(name), custodies(employees(name), engineers(name))')
        .eq('id', id)
        .single(),
    )
    const holder = e.custodies?.employees?.name ?? e.custodies?.engineers?.name
    return voucher({
      title: 'سند صرف مصروف',
      id: e.id,
      date: e.expense_date,
      partyLabel: 'البيان',
      party: e.description,
      about: e.projects?.name ? `مصروف مباشر لمشروع «${e.projects.name}»${e.project_phases ? ` — ${e.project_phases.name}` : ''}` : 'مصروف عام للشركة',
      info: [
        { label: 'الفئة', value: e.expense_categories?.name },
        { label: 'من', value: e.custody_id ? `عهدة ${holder ?? ''}` : e.treasuries?.name },
        ...(e.invoice_no ? [{ label: 'رقم الفاتورة', value: e.invoice_no }] : []),
        ...(e.notes ? [{ label: 'ملاحظات', value: e.notes, wide: true }] : []),
      ],
      amount: Number(e.amount),
      cancel: e,
      signs: ['توقيع المستلم', 'توقيع أمين الصندوق'],
    })
  },

  // ───────────── إشعار تحويل مالي ─────────────
  async transfer(id) {
    const t = await one(supabase.from('transfers').select('*, from:treasuries!transfers_from_treasury_id_fkey(name), to:treasuries!transfers_to_treasury_id_fkey(name)').eq('id', id).single())
    return voucher({
      title: 'إشعار تحويل مالي',
      id: t.id,
      date: t.transfer_date,
      partyLabel: 'من خزينة',
      party: t.from?.name,
      about: `تحويل إلى «${t.to?.name}»`,
      info: t.notes ? [{ label: 'ملاحظات', value: t.notes, wide: true }] : [],
      amount: Number(t.amount),
      cancel: t,
      signs: ['أمين الخزينة المحوِّلة', 'أمين الخزينة المستلمة'],
    })
  },

  // ───────────── سند صرف عهدة / إرجاع ─────────────
  async custody(id) {
    const c = await one(supabase.from('custodies').select('*, employees(name), engineers(name), projects(name), treasuries(name)').eq('id', id).single())
    const holder = c.employees?.name ?? c.engineers?.name
    return voucher({
      title: 'سند صرف عهدة مالية',
      id: c.id,
      date: c.issue_date,
      partyLabel: 'صرفنا إلى السيد/ة',
      party: holder,
      partyName: holder ?? undefined,
      about: c.purpose ?? (c.projects?.name ? `عهدة لمشروع «${c.projects.name}»` : 'عهدة عامة'),
      info: [
        { label: 'المشروع', value: c.projects?.name ?? 'عامة' },
        { label: 'من خزينة', value: c.treasuries?.name },
      ],
      amount: Number(c.amount),
      cancel: c,
      signs: ['توقيع المستلم (صاحب العهدة)', 'توقيع أمين الصندوق'],
    })
  },
  async 'custody-return'(id) {
    const r = await one(supabase.from('custody_returns').select('*, treasuries(name), custodies(employees(name), engineers(name), projects(name))').eq('id', id).single())
    const holder = r.custodies?.employees?.name ?? r.custodies?.engineers?.name
    return voucher({
      title: 'سند تسوية عهدة مالية',
      id: r.id,
      date: r.return_date,
      partyLabel: 'استلمنا من السيد/ة',
      party: holder,
      partyName: holder ?? undefined,
      about: 'إرجاع نقدي من العهدة',
      info: [
        { label: 'أودع في', value: r.treasuries?.name },
        ...(r.notes ? [{ label: 'ملاحظات', value: r.notes, wide: true }] : []),
      ],
      amount: Number(r.amount),
      cancel: r,
      signs: ['توقيع الدافع (صاحب العهدة)', 'توقيع المستلم / أمين الصندوق'],
    })
  },

  // ───────────── كشوف الحساب ─────────────
  async 'supplier-statement'(id) {
    const [s, b, p, pay] = await Promise.all([
      one(supabase.from('suppliers').select('*').eq('id', id).single()),
      one(supabase.from('supplier_balances').select('*').eq('supplier_id', id).maybeSingle()),
      one(supabase.from('purchases').select('*, projects(name)').eq('supplier_id', id).eq('status', 'posted').order('invoice_date')),
      one(supabase.from('supplier_payments').select('*').eq('supplier_id', id).eq('status', 'posted').order('payment_date')),
    ])
    type L = { date: string; label: string; debit: number; credit: number }
    const lines: L[] = [
      ...p.map((x) => ({ date: x.invoice_date, label: `${x.kind === 'return' ? 'مرتجع' : 'فاتورة'} ${x.invoice_no ?? ''} ${x.description ?? ''}${x.projects?.name ? ` (${x.projects.name})` : ''}`, debit: x.kind === 'return' ? 0 : Number(x.total_amount), credit: x.kind === 'return' ? Number(x.total_amount) : 0 })),
      ...pay.map((x) => ({ date: x.payment_date, label: `سند صرف ${x.reference ?? ''}`, debit: 0, credit: Number(x.amount) })),
    ].sort((a, c) => a.date.localeCompare(c.date))
    return statement('كشف حساب مورد', s.name, lines, [
      { label: 'إجمالي الفواتير', value: formatMoney(Number(b?.invoiced ?? 0) - Number(b?.returned ?? 0)) },
      { label: 'المدفوع', value: formatMoney(b?.paid) },
      { label: 'منه مقدم غير موزع', value: formatMoney(b?.unallocated_advance) },
      { label: 'المستحق للمورد', value: formatMoney(b?.balance_due) },
    ], ['له', 'منه'])
  },

  async 'technician-statement'(id) {
    const [t, b, w, pay, rec] = await Promise.all([
      one(supabase.from('technicians').select('*').eq('id', id).single()),
      one(supabase.from('technician_balances').select('*').eq('technician_id', id).maybeSingle()),
      one(supabase.from('technician_work').select('*, projects(name)').eq('technician_id', id).eq('status', 'posted').order('work_date')),
      one(supabase.from('technician_payments').select('*, projects(name)').eq('technician_id', id).eq('status', 'posted').order('payment_date')),
      one(supabase.from('technician_receipts').select('*').eq('technician_id', id).eq('status', 'posted').order('receipt_date')),
    ])
    type L = { date: string; label: string; debit: number; credit: number }
    const lines: L[] = [
      ...w.map((x) => ({ date: x.work_date, label: `إنجاز ${formatMoney(x.quantity)} ${rateUnitLabels[x.rate_unit]} × ${formatMoney(x.rate)} — ${x.description ?? ''} (${x.projects?.name})`, debit: Number(x.amount), credit: 0 })),
      ...pay.map((x) => ({ date: x.payment_date, label: `دفعة${x.projects?.name ? ` — ${x.projects.name}` : ' على الحساب'}`, debit: 0, credit: Number(x.amount) })),
      ...rec.map((x) => ({ date: x.receipt_date, label: 'مبلغ مستلم من الفني', debit: Number(x.amount), credit: 0 })),
    ].sort((a, c) => a.date.localeCompare(c.date))
    const due = Number(b?.balance_due ?? 0)
    return statement('كشف حساب فني', t.name, lines, [
      { label: 'المستحق من الإنجاز', value: formatMoney(b?.earned) },
      { label: 'المدفوع', value: formatMoney(b?.paid) },
      { label: 'المستلم من الفني', value: formatMoney(b?.received_back) },
      { label: due >= 0 ? 'المتبقي للفني' : 'مقدم عند الفني', value: formatMoney(Math.abs(due)) },
    ], ['له', 'منه'])
  },

  async 'custody-statement'(id) {
    const [c, b, e, r] = await Promise.all([
      one(supabase.from('custodies').select('*, employees(name), engineers(name), projects(name)').eq('id', id).single()),
      one(supabase.from('custody_balances').select('*').eq('custody_id', id).maybeSingle()),
      one(supabase.from('expenses').select('*').eq('custody_id', id).eq('status', 'posted').order('expense_date')),
      one(supabase.from('custody_returns').select('*').eq('custody_id', id).eq('status', 'posted').order('return_date')),
    ])
    const holder = c.employees?.name ?? c.engineers?.name ?? ''
    type L = { date: string; label: string; debit: number; credit: number }
    const lines: L[] = [
      { date: c.issue_date, label: `صرف العهدة${c.purpose ? ` — ${c.purpose}` : ''}`, debit: Number(c.amount), credit: 0 },
      ...e.map((x) => ({ date: x.expense_date, label: `مصروف: ${x.description}`, debit: 0, credit: Number(x.amount) })),
      ...r.map((x) => ({ date: x.return_date, label: 'إرجاع نقدي للخزينة', debit: 0, credit: Number(x.amount) })),
    ].sort((a, x) => a.date.localeCompare(x.date))
    return statement('كشف عهدة', `${holder}${c.projects?.name ? ` — ${c.projects.name}` : ''}`, lines, [
      { label: 'قيمة العهدة', value: formatMoney(b?.issued ?? c.amount) },
      { label: 'المصروف منها', value: formatMoney(b?.spent) },
      { label: 'المُرجع نقداً', value: formatMoney(b?.returned) },
      { label: 'المتبقي', value: formatMoney(b?.remaining) },
    ], ['وارد', 'صادر'])
  },

  async 'treasury-statement'(id, params) {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    const source = params.get('source') ?? ''
    const [t, rows] = await Promise.all([
      one(supabase.from('treasuries').select('*').eq('id', id).single()),
      one(supabase.from('treasury_entries').select('*').eq('treasury_id', id).order('entry_date').order('created_at')),
    ])
    let running = 0
    const all = rows.map((e) => {
      const signed = e.direction === 'in' ? Number(e.amount) : -Number(e.amount)
      running += signed
      return { ...e, signed, running }
    })
    const opening = from ? all.filter((l) => l.entry_date < from).reduce((a, l) => a + l.signed, 0) : 0
    const shown = all.filter((l) => (!from || l.entry_date >= from) && (!to || l.entry_date <= to) && (!source || l.source_type === source))
    const period = from || to ? `الفترة ${from ? `من ${formatDate(from)} ` : ''}${to ? `إلى ${formatDate(to)}` : ''}` : 'كل الحركات'
    return {
      title: 'كشف حركات خزينة',
      render: (company, s) => (
        <PrintDocument company={company} settings={s} title="كشف حركات خزينة" date={formatDate(new Date().toISOString())} subtitle={`${t.name} · ${period}${source ? ` · ${srcLabels[source] ?? source}` : ''}`}>
          <PrintTable
            columns={[
              { label: 'التاريخ', width: '24mm', render: (l) => <span className="num">{formatDate(l.entry_date)}</span> },
              { label: 'البيان', render: (l) => `${srcLabels[l.source_type] ?? l.source_type}${l.memo && l.memo !== srcLabels[l.source_type] ? ` — ${l.memo}` : ''}` },
              { label: 'وارد', width: '26mm', align: 'end', render: (l) => (l.signed > 0 ? <span className="num">{formatMoney(l.signed)}</span> : '') },
              { label: 'صادر', width: '26mm', align: 'end', render: (l) => (l.signed < 0 ? <span className="num">{formatMoney(-l.signed)}</span> : '') },
              { label: 'الرصيد', width: '28mm', align: 'end', render: (l) => <span className="num">{formatMoney(l.running)}</span> },
            ]}
            rows={shown}
            totals={[
              ...(from ? [{ label: 'رصيد أول المدة', value: formatMoney(opening) }] : []),
              { label: 'إجمالي الوارد', value: formatMoney(shown.filter((l) => l.signed > 0).reduce((a, l) => a + l.signed, 0)) },
              { label: 'إجمالي الصادر', value: formatMoney(shown.filter((l) => l.signed < 0).reduce((a, l) => a - l.signed, 0)) },
              { label: 'الرصيد الحالي', value: formatMoney(running) },
            ]}
          />
          <Signatures items={[{ label: 'أمين الخزينة' }, { label: 'المدير', name: company.signee_name ?? undefined }]} />
        </PrintDocument>
      ),
    }
  },
}

function statement(title: string, party: string, lines: { date: string; label: string; debit: number; credit: number }[], totals: { label: string; value: string }[], heads: [string, string]): Loaded {
  let run = 0
  const rows = lines.map((l) => ((run += l.debit - l.credit), { ...l, balance: run }))
  return {
    title,
    render: (company, s) => (
      <PrintDocument company={company} settings={s} title={title} date={formatDate(new Date().toISOString())} subtitle={party}>
        <PrintTable
          columns={[
            { label: 'التاريخ', width: '24mm', render: (l) => <span className="num">{formatDate(l.date)}</span> },
            { label: 'البيان', render: (l) => l.label },
            { label: heads[0], width: '26mm', align: 'end', render: (l) => (l.debit ? <span className="num">{formatMoney(l.debit)}</span> : '') },
            { label: heads[1], width: '26mm', align: 'end', render: (l) => (l.credit ? <span className="num">{formatMoney(l.credit)}</span> : '') },
            { label: 'الرصيد', width: '28mm', align: 'end', render: (l) => <span className="num">{formatMoney(l.balance)}</span> },
          ]}
          rows={rows}
          totals={totals}
        />
        <Signatures items={[{ label: 'المحاسب' }, { label: 'المدير', name: company.signee_name ?? undefined }]} />
      </PrintDocument>
    ),
  }
}
