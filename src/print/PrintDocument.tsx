import type { CSSProperties, ReactNode } from 'react'
import { NumberWithUnit } from '@/components/ui'
import { amountInWords } from './amountInWords'
import type { Company, PrintSettings } from './printSettings'

// مستند طباعة موحد A4 من اليمين لليسار. الترويسة من إعدادات الشركة فقط.
export function PrintDocument({
  company,
  settings,
  title,
  number,
  date,
  subtitle,
  cancelled,
  children,
  compact,
  dense,
}: {
  company: Company | null | undefined
  settings: PrintSettings
  title: string
  number?: ReactNode
  date?: string
  subtitle?: ReactNode
  cancelled?: { reason?: string | null; at?: string | null } | null
  children: ReactNode
  compact?: boolean // سند قصير: نصف صفحة تقريباً
  dense?: boolean
}) {
  const vars = {
    '--p-title': settings.print_section_title_color,
    '--p-th-bg': settings.print_table_header_color,
    '--p-th-fg': settings.print_header_text_color,
    '--p-border': settings.print_table_border_color,
    '--p-tot-bg': settings.print_totals_bg_color,
    '--p-tot-fg': settings.print_totals_text_color,
    '--p-font': `"${settings.print_font_family}", "IBM Plex Sans Arabic", sans-serif`,
    '--p-size': `${settings.print_table_font_size}pt`,
  } as CSSProperties

  return (
    <article dir="rtl" className={`print-root pd relative mx-auto bg-white text-[#1b1f1d] shadow-pop${compact ? ' pd-voucher' : ''}${dense ? ' pd-dense' : ''}`} style={vars}>
      <style>{printCss}</style>
      {cancelled && (
        <>
          <div className="pd-watermark" aria-hidden>
            ملغى
          </div>
          <div className="pd-cancelled">
            هذا المستند ملغى ولا يُعتد به
            {cancelled.reason && <div className="pd-small">سبب الإلغاء: {cancelled.reason}</div>}
            {cancelled.at && <div className="pd-small">تاريخ الإلغاء: {cancelled.at}</div>}
          </div>
        </>
      )}
      <header className="pd-header">
        <div className="pd-brand">
          {settings.header_show_logo && company?.logo_path ? (
            <img src={company.logo_path} alt="" className="pd-logo" />
          ) : (
            <div className="pd-logo pd-logo-fallback">{(company?.company_name ?? 'ر').replace(/^شركة\s+/, '').charAt(0)}</div>
          )}
          <div>
            <div className="pd-company">{company?.company_name}</div>
            {settings.header_show_tagline && company?.tagline && <div className="pd-tagline">{company.tagline}</div>}
            {settings.header_show_contact && (company?.phone || company?.address) && (
              <div className="pd-contact">
                {company?.phone && <span className="num">{company.phone}</span>}
                {company?.phone && company?.address && ' · '}
                {company?.address}
              </div>
            )}
          </div>
        </div>
        <div className="pd-doc">
          <div className="pd-title">{title}</div>
          {number !== undefined && (
            <div className="pd-meta">
              الرقم: <strong className="num">{number}</strong>
            </div>
          )}
          {date && (
            <div className="pd-meta">
              التاريخ: <strong className="num">{date}</strong>
            </div>
          )}
          {subtitle && <div className="pd-meta">{subtitle}</div>}
        </div>
      </header>
      {settings.accountant_position === 'header' && <Accountant settings={settings} />}
      <div className={compact ? 'pd-body pd-compact' : 'pd-body'}>{children}</div>
      {settings.accountant_position === 'footer' && <Accountant settings={settings} />}
      {settings.footer_note && <footer className="pd-footer">{settings.footer_note}</footer>}
    </article>
  )
}

function Accountant({ settings }: { settings: PrintSettings }) {
  if (!settings.accountant_name.trim()) return null
  return <div className={`pd-accountant pd-accountant-${settings.accountant_position}`} style={{ textAlign: settings.accountant_align }} data-accountant-position={settings.accountant_position}>
    <div className="pd-accountant-content"><div className="pd-sign-label">المحاسب</div><div className="pd-sign-name">{settings.accountant_name}</div>
      {settings.accountant_position === 'footer' && <><div className="pd-accountant-line" /><div className="pd-small">التوقيع</div></>}
    </div>
  </div>
}

export function InfoGrid({ items, cols = 2 }: { items: { label: string; value: ReactNode; wide?: boolean }[]; cols?: 2 | 3 }) {
  return (
    <dl className="pd-info" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={i} className="pd-info-item" style={it.wide ? { gridColumn: '1 / -1' } : undefined}>
          <dt>{it.label}</dt>
          <dd>{it.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AmountBox({ amount, label = 'المبلغ', cancelled }: { amount: number; label?: string; cancelled?: boolean }) {
  return (
    <div className="pd-amount">
      <div className="pd-amount-row">
        <span>{label}</span>
        <span className="pd-amount-value" style={cancelled ? { textDecoration: 'line-through' } : undefined}>
          <NumberWithUnit value={amount} unit="د.ل" unitClassName="text-[9pt] font-normal" />
        </span>
      </div>
      <div className="pd-words">{amountInWords(amount)}</div>
    </div>
  )
}

export type PrintColumn<T> = { label: string; width?: string; align?: 'start' | 'end' | 'center'; render: (row: T, index: number) => ReactNode }

export function PrintTable<T>({ columns, rows, totals }: { columns: PrintColumn<T>[]; rows: T[]; totals?: { label: string; value: ReactNode }[] }) {
  const align = (a?: string) => (a === 'end' ? 'left' : a === 'center' ? 'center' : 'right')
  return (
    <>
      <table className="pd-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ width: c.width, textAlign: align(c.align) }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td key={j} style={{ textAlign: align(c.align) }}>
                  {c.render(r, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totals && totals.length > 0 && (
        <div className="pd-totals">
          {totals.map((t, i) => (
            <div key={i} className="pd-total-row">
              <span>{t.label}</span>
              <span className="num">{t.value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pd-section">
      <h3 className="pd-section-title">{title}</h3>
      {children}
    </section>
  )
}

export function Signatures({ items }: { items: { label: string; name?: ReactNode; note?: ReactNode }[] }) {
  return (
    <div className="pd-signatures" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s, i) => (
        <div key={i} className="pd-sign">
          <div className="pd-sign-label">{s.label}</div>
          {s.name && <div className="pd-sign-name">{s.name}</div>}
          {s.note && <div className="pd-small">{s.note}</div>}
          <div className="pd-sign-line" />
          <div className="pd-small">التوقيع</div>
        </div>
      ))}
    </div>
  )
}

const printCss = `
.pd { width: 210mm; min-height: 148mm; padding: 14mm 14mm 12mm; font-family: var(--p-font); font-size: var(--p-size); line-height: 1.7; }
.pd h1, .pd h2, .pd h3 { font-family: inherit; }
.pd .num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
.pd-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; padding-bottom: 4mm; border-bottom: 2px solid var(--p-title); margin-bottom: 6mm; }
.pd-brand { display: flex; align-items: center; gap: 4mm; }
.pd-logo { height: 16mm; width: 16mm; object-fit: contain; }
.pd-logo-fallback { display: flex; align-items: center; justify-content: center; border-radius: 3mm; background: var(--p-title); color: #fff; font-size: 20pt; font-weight: 700; }
.pd-company { font-size: 15pt; font-weight: 700; color: var(--p-title); line-height: 1.3; }
.pd-tagline { font-size: 9.5pt; color: #5f675f; }
.pd-contact { font-size: 8.5pt; color: #7a817a; margin-top: 0.5mm; }
.pd-doc { text-align: left; }
.pd-title { font-size: 16pt; font-weight: 700; color: var(--p-title); line-height: 1.3; text-align: right; }
.pd-meta { font-size: 9pt; color: #4b524c; text-align: right; }
.pd-body { display: flex; flex-direction: column; gap: 5mm; }
.pd-section-title { font-size: 11pt; font-weight: 700; color: var(--p-title); margin: 0 0 2mm; padding-bottom: 1mm; border-bottom: 1px solid var(--p-border); }
.pd-info { display: grid; gap: 2mm 8mm; margin: 0; }
.pd-info-item { display: flex; gap: 3mm; border-bottom: 1px dashed var(--p-border); padding-bottom: 1mm; }
.pd-info-item dt { color: #6b726c; min-width: 26mm; flex-shrink: 0; }
.pd-info-item dd { margin: 0; font-weight: 600; }
.pd-voucher { outline: 2px solid var(--p-th-bg); outline-offset: -8mm; border-radius: 2mm; padding: 16mm 16mm 14mm; }
.pd-amount { border: 1.5px solid var(--p-th-bg); border-radius: 3mm; overflow: hidden; }
.pd-amount-row { display: flex; justify-content: space-between; align-items: center; padding: 3mm 5mm; background: #fdfbf7; color: var(--p-title); font-weight: 700; font-size: 12pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pd-amount-value { font-size: 17pt; color: #15803d; }
.pd-words { border-top: 1px dashed var(--p-border); }
.pd-amount-value small { font-size: 9pt; font-weight: 500; }
.pd-words { padding: 2.5mm 5mm; font-weight: 600; }
.pd-table { width: 100%; border-collapse: collapse; }
.pd-table thead { display: table-header-group; }
.pd-table th { background: var(--p-th-bg); color: var(--p-th-fg); font-weight: 600; padding: 2mm 2.5mm; border: 1px solid var(--p-th-bg); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pd-table td { padding: 1.8mm 2.5mm; border: 1px solid var(--p-border); vertical-align: top; }
.pd-table tbody tr:nth-child(even) td { background: #f8f7f3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pd-table tr { break-inside: avoid; }
.pd-totals { margin-inline-start: auto; width: 75mm; border: 1.5px solid var(--p-title); border-radius: 2mm; overflow: hidden; margin-top: 3mm; }
.pd-total-row { display: flex; justify-content: space-between; padding: 1.6mm 4mm; border-top: 1px solid var(--p-border); }
.pd-total-row:first-child { border-top: 0; }
.pd-total-row:last-child { background: var(--p-tot-bg); color: var(--p-tot-fg); font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pd-signatures { display: grid; gap: 10mm; margin-top: 8mm; break-inside: avoid; }
.pd-accountant { break-inside: avoid; margin: 4mm 0; }
.pd-accountant-content { display: inline-block; min-width: 42mm; max-width: 100%; overflow-wrap: anywhere; text-align: center; }
.pd-accountant-footer { margin-top: 6mm; }
.pd-accountant-line { border-top: 1px solid #8a8f89; margin-top: 12mm; }
.pd-sign { text-align: center; display: flex; flex-direction: column; min-height: 34mm; }
.pd-sign-label { font-weight: 700; color: var(--p-title); }
.pd-sign-name { font-weight: 600; }
.pd-sign-line { border-top: 1px solid #8a8f89; margin: auto 6mm 1mm; padding-top: 0; }
.pd-sign-name + .pd-sign-line, .pd-sign-label + .pd-sign-line { margin-top: auto; }
.pd-small { font-size: 8.5pt; color: #6b726c; }
.pd-footer { margin-top: 8mm; padding-top: 2mm; border-top: 1px solid var(--p-border); font-size: 8.5pt; color: #6b726c; text-align: center; }
.pd-watermark { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font-size: 64pt; font-weight: 800; color: rgba(220, 38, 38, 0.13); border: 5px dashed rgba(220, 38, 38, 0.2); padding: 2mm 14mm; border-radius: 6mm; pointer-events: none; }
.pd-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 2mm; padding: 2mm 4mm; margin-bottom: 4mm; text-align: center; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pd-clause { display: flex; gap: 3mm; margin-bottom: 2mm; break-inside: avoid; }
.pd-clause-no { flex-shrink: 0; width: 7mm; height: 7mm; border-radius: 50%; background: var(--p-title); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  .pd { width: auto; min-height: 0; padding: 0; }
  .pd-dense { font-size: min(var(--p-size), 9.5pt); line-height: 1.4; }
  .pd-dense .pd-table td { padding: 0.8mm 2mm; }
  .pd-body { display: block; }
  .pd-body > * + *, .pd-closing > * + * { margin-top: 3mm; }
  .pd-closing { break-inside: avoid; }
  .pd-section-title { break-after: avoid; }
  .pd-section:not(:has(tbody tr:nth-child(6))) { break-inside: avoid; }
  .pd-table th { padding: 1.5mm 2mm; }
  .pd-table td { padding: 1.2mm 2mm; }
  .pd-amount, .pd-totals { break-inside: avoid; }
  .pd-signatures { margin-top: 5mm; }
  .pd-sign { min-height: 24mm; }
  .pd-dense .pd-signatures { margin-top: 3mm; }
  .pd-dense .pd-sign { min-height: 18mm; }
  .pd-voucher { padding: 8mm; outline-offset: -2mm; }
  @page { size: A4; margin: 12mm 12mm 16mm; @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font-size: 8pt; color: #888; } }
}
`



