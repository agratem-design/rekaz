import type { ReactNode } from 'react'
import { Card, EmptyState, ErrorState, TableSkeleton, cn } from './ui'

export type Column<T> = {
  key: string
  label: ReactNode
  render?: (row: T) => ReactNode
  align?: 'start' | 'end' | 'center'
  className?: string
  hideBelow?: 'sm' | 'md' | 'lg' // إخفاء العمود على الشاشات الصغيرة
}

// جدول موحد: رأس ثابت عند التمرير، تمييز عند المرور، أزرار الصف تظهر عند المرور ودائماً على اللمس
export function DataTable<T>({
  rows,
  columns,
  getKey,
  onRowClick,
  rowActions,
  loading,
  error,
  onRetry,
  empty,
  toolbar,
  footer,
  rowClassName,
  maxHeight = 'max-h-[calc(100dvh-16rem)]',
}: {
  rows: T[] | undefined
  columns: Column<T>[]
  getKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: ReactNode
  toolbar?: ReactNode
  footer?: ReactNode
  rowClassName?: (row: T) => string | false | undefined
  maxHeight?: string
}) {
  const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }
  const align = (a?: Column<T>['align']) => (a === 'end' ? 'text-left' : a === 'center' ? 'text-center' : 'text-right')
  return (
    <Card className="overflow-hidden p-0">
      {toolbar && <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">{toolbar}</div>}
      {loading ? (
        <TableSkeleton cols={Math.min(columns.length, 4)} />
      ) : error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      ) : !rows?.length ? (
        empty ?? <EmptyState title="لا توجد سجلات" />
      ) : (
        <div className={cn('overflow-auto', maxHeight)}>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'sticky top-0 z-10 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-muted',
                      align(c.align),
                      c.hideBelow && hide[c.hideBelow],
                    )}
                  >
                    {c.label}
                  </th>
                ))}
                {rowActions && <th className="sticky top-0 z-10 w-px border-b border-line bg-surface-2 px-2" aria-label="إجراءات" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('group transition-colors hover:bg-surface-2', onRowClick && 'cursor-pointer', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('border-b border-line px-4 py-2.5 align-middle', align(c.align), c.hideBelow && hide[c.hideBelow], c.className)}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—') || '—'}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="border-b border-line px-2 py-1 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {footer && <tfoot className="bg-surface-2 font-semibold">{footer}</tfoot>}
          </table>
        </div>
      )}
    </Card>
  )
}

export function RecordCount({ shown, total }: { shown: number; total: number }) {
  return (
    <span className="text-xs text-muted">
      {shown === total ? (
        <>
          <span className="num font-medium text-ink">{total}</span> سجل
        </>
      ) : (
        <>
          <span className="num font-medium text-ink">{shown}</span> من <span className="num">{total}</span>
        </>
      )}
    </span>
  )
}
