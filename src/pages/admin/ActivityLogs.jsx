import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/table/DataTable'
import Badge from '../../components/ui/Badge'
import { Input, Select } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useTableState } from '../../hooks/useTableState'
import { formatDateTime } from '../../utils/format'
import { dayRangeToTimestamps } from '../../utils/format'

const MODULES = ['auth', 'registration', 'admin', 'alt', 'finance', 'workflow'].map((m) => ({
  value: m,
  label: m.charAt(0).toUpperCase() + m.slice(1),
}))

export default function ActivityLogs() {
  const table = useTableState({ defaultSort: { key: 'created_at', dir: 'desc' } })
  const f = table.filters

  const query = useQuery({
    queryKey: ['logs', f, table.page, table.pageSize, table.sort],
    queryFn: async () => {
      let q = supabase
        .from('activity_logs')
        .select('id, user_name_snapshot, user_role_snapshot, action, module, description, created_at', { count: 'exact' })

      if (f.q) q = q.or(`user_name_snapshot.ilike.%${f.q}%,description.ilike.%${f.q}%,action.ilike.%${f.q}%`)
      if (f.module) q = q.eq('module', f.module)

      const { start, end } = dayRangeToTimestamps(f.from, f.to)
      if (start) q = q.gte('created_at', start)
      if (end) q = q.lt('created_at', end)

      q = q.order(table.sort.key, { ascending: table.sort.dir === 'asc' }).range(table.range.from, table.range.to)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
    keepPreviousData: true,
  })

  const columns = [
    { key: 'created_at', header: 'When', sortable: true, render: (r) => formatDateTime(r.created_at) },
    {
      key: 'user_name_snapshot',
      header: 'Employee',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.user_name_snapshot}</p>
          <p className="text-xs text-slate-400">{r.user_role_snapshot}</p>
        </div>
      ),
    },
    { key: 'action', header: 'Action', render: (r) => <Badge tone="navy">{r.action.replace(/_/g, ' ')}</Badge> },
    { key: 'module', header: 'Module' },
    { key: 'description', header: 'Details', render: (r) => <span className="text-slate-600">{r.description ?? '—'}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="Every action in the system, permanently recorded. These records cannot be edited or deleted by anyone."
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" placeholder="Employee, action, details…" defaultValue={f.q ?? ''} onChange={(e) => table.setFilter('q', e.target.value)} />
          <Select label="Module" placeholder="All modules" value={f.module ?? ''} onChange={(e) => table.setFilter('module', e.target.value)} options={MODULES} />
          <Input label="From" type="date" value={f.from ?? ''} onChange={(e) => table.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={f.to ?? ''} onChange={(e) => table.setFilter('to', e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        total={query.data?.total ?? 0}
        page={table.page}
        pageSize={table.pageSize}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sort={table.sort}
        onSortChange={table.setSort}
        loading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={query.refetch}
        emptyIcon={ScrollText}
        emptyTitle="No activity recorded yet"
        exportFileName="activity-logs"
        enablePrint
        dense
      />
    </>
  )
}
