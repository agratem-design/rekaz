import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Inbox, Loader2, Search, type LucideIcon } from 'lucide-react'
import { formatMoney } from '@/lib/format'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// ───────────── الأزرار ─────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400 dark:text-brand-950',
    secondary: 'border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-2',
    ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
    soft: 'bg-accent-soft text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  }[variant]
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', icon: 'size-9 px-0' }[size]
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
        styles,
        sizes,
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

// ───────────── الحقول ─────────────
const inputBase =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-red-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn(inputBase, className)} {...rest} />
))

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'h-auto min-h-20 py-2', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'pl-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function SearchInput({ value, onChange, placeholder = 'بحث…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-9" aria-label={placeholder} />
    </div>
  )
}

export function Field({
  label,
  required,
  children,
  hint,
  error,
  group,
  className,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
  error?: string | null
  group?: boolean // مجموعة عناصر (مثل مربعات اختيار) لا تُلف بـ label
  className?: string
}) {
  const Wrapper = group ? 'div' : 'label'
  return (
    <Wrapper className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error ? <span className="block text-xs text-red-600">{error}</span> : hint && <span className="block text-xs text-muted">{hint}</span>}
    </Wrapper>
  )
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-brand-600" />
      {label}
    </label>
  )
}

// ───────────── الحاويات ─────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-card', className)}>{children}</div>
}

export function CardHeader({ title, description, action, icon: Icon }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-brand-600 dark:text-brand-300" />}
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export type Crumb = { label: string; to?: string }

export function PageHeader({ title, description, actions, crumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="مسار الصفحة" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.to ? (
                <Link to={c.to} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              {i < crumbs.length - 1 && <ChevronLeft className="size-3 text-faint" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="border-b border-line pb-1.5 text-xs font-semibold tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  )
}

// ───────────── عناصر العرض ─────────────
export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'brand' | 'sand'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-900/50 dark:text-brand-200 dark:ring-brand-800',
  sand: 'bg-sand-50 text-sand-700 ring-sand-200 dark:bg-sand-700/20 dark:text-sand-200 dark:ring-sand-700/40',
}

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', toneClasses[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const avatarTones = ['bg-brand-100 text-brand-800', 'bg-sand-100 text-sand-700', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800']

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((p) => p !== 'ال')
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).replace(/^ا(?=ل)/, '') || '؟'
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const s = { sm: 'size-7 text-[11px]', md: 'size-8 text-xs', lg: 'size-11 text-sm' }[size]
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', avatarTones[h % avatarTones.length], s)}>
      {initials(name)}
    </span>
  )
}

export function Money({ value, className, currency = true, signed }: { value: number | null | undefined; className?: string; currency?: boolean; signed?: boolean }) {
  const n = Number(value ?? 0)
  return (
    <span className={cn('num whitespace-nowrap', n < 0 && 'text-red-600 dark:text-red-400', className)}>
      {signed && n > 0 ? '+' : ''}
      {formatMoney(n)}
      {currency && <span className="ms-1 text-[0.75em] font-normal text-faint">د.ل</span>}
    </span>
  )
}

export function ProgressBar({ value, max = 100, tone = 'brand', className, label }: { value: number; max?: number; tone?: 'brand' | 'sand' | 'red' | 'green'; className?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const color = { brand: 'bg-brand-500', sand: 'bg-sand-400', red: 'bg-red-500', green: 'bg-emerald-500' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-stone-200/70 dark:bg-stone-800', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width]', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  tone = 'brand',
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  to?: string
  tone?: 'brand' | 'sand' | 'red' | 'blue'
}) {
  const bar = { brand: 'bg-brand-500', sand: 'bg-sand-400', red: 'bg-red-500', blue: 'bg-sky-500' }[tone]
  const chip = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/60 dark:text-brand-200',
    sand: 'bg-sand-50 text-sand-600 dark:bg-sand-700/25 dark:text-sand-200',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
    blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300',
  }[tone]
  const body = (
    <div className={cn('relative h-full overflow-hidden rounded-xl border border-line bg-surface p-3 shadow-card transition sm:p-4', to && 'hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700')}>
      <span className={cn('absolute inset-y-0 right-0 w-1', bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-muted">{label}</div>
          <div className="font-display mt-1.5 truncate text-lg leading-none font-semibold sm:text-2xl">{value}</div>
          {hint && <div className="mt-2 hidden text-xs text-muted sm:block">{hint}</div>}
        </div>
        <span className={cn('hidden rounded-lg p-2 sm:block', chip)}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  )
}

export function Spinner({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-stone-200/70 dark:bg-stone-800', className)} />
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-40' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-32" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }: { icon?: LucideIcon; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 rounded-2xl bg-surface-2 p-3 text-faint ring-1 ring-line">
        <Icon className="size-6" />
      </span>
      {title && <div className="font-medium">{title}</div>}
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}

// شرائح الفلترة
export function FilterChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
            value === o.value ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-brand-950' : 'border-line-strong bg-surface text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="num opacity-75">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

// تبويبات بروابط
export function Tabs({ items, active, onChange }: { items: { key: string; label: string; icon?: LucideIcon; muted?: boolean }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto border-b border-line" role="tablist">
      <div className="flex min-w-max gap-1 px-1">
        {items.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition',
              active === t.key ? 'text-brand-700 dark:text-brand-200' : t.muted ? 'text-faint hover:text-muted' : 'text-muted hover:text-ink',
            )}
          >
            {t.icon && <t.icon className="size-4" />}
            {t.label}
            {active === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-300" />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="text-muted">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  )
}
