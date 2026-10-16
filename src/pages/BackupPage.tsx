import { useState } from 'react'
import { DatabaseBackup, FileJson, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, ProgressBar, PageHeader } from '@/components/ui'
import { tableLabels } from './AuditPage'
import { errorMessage, supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'

// نسخ احتياطي للقراءة فقط: تصدير كل بيانات العمل التي يراها المدير إلى ملف مؤرخ.
// لا يوجد استرجاع يكتب في القاعدة من هنا.
const TABLES = [
  'company_settings', 'profiles', 'user_roles',
  'clients', 'suppliers', 'technician_types', 'technicians', 'engineers', 'employees',
  'treasuries', 'treasury_entries',
  'projects', 'project_phases', 'measurement_units', 'catalog_items', 'catalog_item_requirements', 'project_items', 'project_item_requirements', 'project_item_assignments',
  'contracts', 'contract_items', 'clause_templates', 'contract_clauses',
  'client_receipts', 'client_credit_entries', 'purchases', 'supplier_payments', 'supplier_payment_allocations',
  'technician_work', 'technician_payments', 'technician_receipts', 'custodies', 'custody_returns', 'expense_categories', 'expenses', 'transfers',
  'audit_log',
] as const

type Dump = Record<string, Record<string, unknown>[]>

async function fetchAll(table: string) {
  const rows: Record<string, unknown>[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from(table as any) as any).select('*').range(from, from + page - 1)
    if (error) throw new Error(`${tableLabels[table] ?? table}: ${errorMessage(error)}`)
    rows.push(...(data as Record<string, unknown>[]))
    if ((data as unknown[]).length < page) break
  }
  return rows
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const esc = (v: unknown) =>
  String(v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// ملف Excel (SpreadsheetML) بورقة لكل جدول — يُفتح مباشرة في Excel
function toExcel(dump: Dump) {
  const sheets = Object.entries(dump)
    .map(([table, rows]) => {
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
      const name = (tableLabels[table] ?? table).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
      const cell = (v: unknown) => (typeof v === 'number' ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`)
      return `<Worksheet ss:Name="${esc(name)}" ss:RightToLeft="1"><Table><Row>${cols.map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>${rows
        .map((r) => `<Row>${cols.map((c) => cell(r[c])).join('')}</Row>`)
        .join('')}</Table></Worksheet>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>${sheets}</Workbook>`
}

export function BackupPage() {
  const [busy, setBusy] = useState<'json' | 'excel' | null>(null)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<{ table: string; count: number }[] | null>(null)

  const run = async (kind: 'json' | 'excel') => {
    setBusy(kind)
    setProgress(0)
    setSummary(null)
    try {
      const dump: Dump = {}
      for (const [i, t] of TABLES.entries()) {
        dump[t] = await fetchAll(t)
        setProgress(((i + 1) / TABLES.length) * 100)
      }
      const stamp = `${todayISO()}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`
      if (kind === 'json') download(`rikaz-backup-${stamp}.json`, JSON.stringify({ app: 'ركاز v2', exported_at: new Date().toISOString(), tables: dump }, null, 2), 'application/json')
      else download(`rikaz-backup-${stamp}.xls`, toExcel(dump), 'application/vnd.ms-excel')
      setSummary(TABLES.map((t) => ({ table: t, count: dump[t].length })))
      toast.success('تم تصدير النسخة الاحتياطية')
    } catch (e) {
      toast.error(`تعذّر التصدير: ${errorMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="النسخ الاحتياطي" description="تصدير كل بيانات العمل إلى ملف مؤرخ على جهازك" />
      <Card className="space-y-4">
        <CardHeader title="تصدير نسخة احتياطية" icon={DatabaseBackup} description={`${TABLES.length} جدولاً: الأطراف، المشاريع، البنود، العقود، كل الحركات المالية، الإعدادات وسجل العمليات`} />
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === 'json'} disabled={busy !== null} onClick={() => run('json')}>
            <FileJson className="size-4" />
            تصدير JSON (نسخة كاملة)
          </Button>
          <Button variant="secondary" loading={busy === 'excel'} disabled={busy !== null} onClick={() => run('excel')}>
            <FileSpreadsheet className="size-4" />
            تصدير Excel (ورقة لكل جدول)
          </Button>
        </div>
        {busy && <ProgressBar value={progress} label="تقدم التصدير" />}
        <div className="flex gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
          <ShieldCheck className="size-4 shrink-0 text-olive-600" />
          التصدير للقراءة فقط ولا يغيّر أي بيانات. الاسترجاع إلى قاعدة البيانات لا يتم من هنا، بل بإجراء منفصل يشرف عليه المسؤول التقني.
        </div>
      </Card>
      {summary && (
        <Card className="mt-4 p-0">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">محتوى النسخة</div>
          <ul className="grid gap-x-6 px-4 py-2 text-sm sm:grid-cols-2">
            {summary.map((s) => (
              <li key={s.table} className="flex justify-between border-b border-line py-1.5 last:border-0">
                <span className="text-muted">{tableLabels[s.table] ?? s.table}</span>
                <span className="num font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
