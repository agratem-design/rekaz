import { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function EntryLayout({ children, summary }: { children: ReactNode; summary: ReactNode }) {
  return <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
    <div className="min-w-0 space-y-5">{children}</div>
    <aside aria-label="ملخص الإدخال" className="rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-0">
      <h3 className="mb-4 text-sm font-semibold">مراجعة قبل الحفظ</h3>{summary}
      <p className="mt-5 border-t border-line pt-4 text-xs leading-6 text-muted">تُسجّل البيانات عند الضغط على الحفظ. يمكنك مراجعتها وتعديلها قبل ذلك.</p>
    </aside>
  </div>
}

export function EntryCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
    <div><h3 className="text-base font-semibold">{title}</h3>{description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}</div>
    {children}
  </section>
}

export function EntryDetails({ title, children }: { title: string; children: ReactNode }) {
  return <details className="group rounded-2xl border border-line bg-surface p-4 sm:p-6">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">{title}<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
    <div className="mt-5 space-y-4">{children}</div>
  </details>
}
