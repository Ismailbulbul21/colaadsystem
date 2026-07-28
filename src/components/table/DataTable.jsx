import { memo, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown,
  Columns3, Download, Printer, Check,
} from 'lucide-react'

import Button from '../ui/Button'
import { TableSkeleton } from '../feedback/Skeleton'
import { EmptyState, ErrorState } from '../feedback/States'
import { exportToCsv } from '../../utils/export'
import { useT } from '../../contexts/LanguageContext'
import { PAGE_SIZE_OPTIONS } from '../../constants'

/**
 * One table for the whole application.
 *
 * Data is NEVER loaded in full: the caller passes the current page's rows plus
 * `total`, and paging/sorting are handed back so the query re-runs against
 * Postgres with .range(). Ten years of records stay just as fast as day one.
 */
function DataTableBase({
  columns,
  rows,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  onRowClick,
  toolbar,
  title,
  exportFileName,
  enablePrint = false,
  rowKey = (r) => r.id,
  dense = false,
}) {
  const [hidden, setHidden] = useState(() => new Set())
  const [columnMenu, setColumnMenu] = useState(false)
  const t = useT()

  const visible = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden],
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const toggleColumn = (key) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const handleSort = (col) => {
    if (!col.sortable || !onSortChange) return
    if (sort?.key === col.key) {
      onSortChange({ key: col.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      onSortChange({ key: col.key, dir: 'asc' })
    }
  }

  const handleCsv = () => {
    exportToCsv(
      rows,
      visible.filter((c) => c.key !== 'actions'),
      exportFileName || title || 'export',
    )
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  return (
    <div className="space-y-3">
      {(title || toolbar || exportFileName || enablePrint) && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {title && <h2 className="text-sm font-semibold text-slate-700">{title}</h2>}
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 tabular">
                {total.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {toolbar}

            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                icon={Columns3}
                onClick={() => setColumnMenu((v) => !v)}
              >
                {t('table.columns')}
              </Button>
              {columnMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setColumnMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-lg border border-surface-border bg-white p-1.5 shadow-panel">
                    {columns.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => toggleColumn(c.key)}
                        className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {c.header}
                        {!hidden.has(c.key) && <Check className="h-3.5 w-3.5 text-navy-600" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {exportFileName && (
              <Button variant="secondary" size="sm" icon={Download} onClick={handleCsv}>
                CSV
              </Button>
            )}
            {enablePrint && (
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
                {t('action.print')}
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={Math.min(pageSize, 8)} cols={Math.min(visible.length, 6)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-sunken/60">
                  {visible.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      style={c.width ? { width: c.width } : undefined}
                      className={clsx(
                        'px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-ink-500',
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                        c.sortable && 'cursor-pointer select-none hover:text-navy-700',
                      )}
                      onClick={() => handleSort(c)}
                    >
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1',
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {c.sortable &&
                          (sort?.key === c.key ? (
                            sort.dir === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          ))}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-border">
                {rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={clsx(
                      'transition-colors duration-100',
                      onRowClick && 'cursor-pointer hover:bg-navy-50/50',
                    )}
                  >
                    {visible.map((c) => (
                      <td
                        key={c.key}
                        className={clsx(
                          'px-4 text-[13px] text-ink-700',
                          dense ? 'py-2.5' : 'py-3.5',
                          c.align === 'right' && 'text-right tabular',
                          c.align === 'center' && 'text-center',
                          c.className,
                        )}
                      >
                        {c.render ? c.render(row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-surface-border bg-surface-sunken/40 px-4 py-3">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="tabular">
                {from.toLocaleString()}–{to.toLocaleString()} {t('table.of')}{' '}
                {total.toLocaleString()}
              </span>
              {onPageSizeChange && (
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-7 rounded border border-surface-border bg-white px-1.5 text-xs"
                  aria-label={t('table.rowsPerPage')}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} {t('table.perPage')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
              >
                {t('table.prev')}
              </Button>
              <span className="px-2 text-xs text-slate-500 tabular">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                iconRight={ChevronRight}
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
              >
                {t('table.next')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tables re-render on every keystroke in a filter box without this.
export default memo(DataTableBase)
