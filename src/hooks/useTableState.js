import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PAGE_SIZE } from '../constants'

/**
 * Paging, sorting and filters live in the URL so that a dashboard card can
 * link straight to a pre-filtered list ("/finance/pending?status=waiting_payment")
 * and so employees can bookmark or share a view.
 */
export function useTableState({ defaultSort, defaultFilters = {}, pageSize = PAGE_SIZE } = {}) {
  const [params, setParams] = useSearchParams()
  const [size, setSize] = useState(pageSize)

  const page = Math.max(1, Number(params.get('page') || 1))

  const sort = useMemo(() => {
    const key = params.get('sort')
    if (!key) return defaultSort ?? null
    return { key, dir: params.get('dir') === 'asc' ? 'asc' : 'desc' }
  }, [params, defaultSort])

  const filters = useMemo(() => {
    const out = { ...defaultFilters }
    for (const [k, v] of params.entries()) {
      if (['page', 'sort', 'dir'].includes(k)) continue
      out[k] = v
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const update = useCallback(
    (next, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) {
            if (v === '' || v == null) p.delete(k)
            else p.set(k, String(v))
          }
          if (resetPage && !('page' in next)) p.set('page', '1')
          return p
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setPage = useCallback((p) => update({ page: p }, { resetPage: false }), [update])
  const setSort = useCallback((s) => update({ sort: s.key, dir: s.dir }), [update])
  const setFilter = useCallback((key, value) => update({ [key]: value }), [update])

  const clearFilters = useCallback(() => {
    setParams({}, { replace: true })
  }, [setParams])

  const range = useMemo(() => {
    const from = (page - 1) * size
    return { from, to: from + size - 1 }
  }, [page, size])

  const activeFilterCount = useMemo(
    () =>
      Array.from(params.keys()).filter((k) => !['page', 'sort', 'dir'].includes(k)).length,
    [params],
  )

  return {
    page, setPage,
    pageSize: size, setPageSize: setSize,
    sort, setSort,
    filters, setFilter, setFilters: update, clearFilters, activeFilterCount,
    range,
  }
}
