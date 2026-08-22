import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Filter, X } from 'lucide-react'

import DataTable from '../table/DataTable'
import Button from '../ui/Button'
import { StatusBadge } from '../ui/Badge'
import { Input, Select } from '../ui/Field'
import { listClients } from '../../services/clientService'
import { listActiveServices } from '../../services/serviceService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useTableState } from '../../hooks/useTableState'
import { useWorkflowRealtime } from '../../hooks/useRealtime'
import { formatDate } from '../../utils/format'
import { STATUS_META } from '../../constants'
import { qk, LONG_CACHE } from '../../lib/queryClient'

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({
  value,
  label: m.label,
}))

/**
 * One list, reused by Client Search, My Clients, the ALT queue and the Finance
 * pending list. Each caller only supplies a baseline filter and which actions
 * belong in the row.
 */
export default function ClientListView({
  baseFilters = {},
  lockedStatus,
  rowActions,
  emptyTitle = 'No clients found',
  emptyDescription = 'Try changing the filters, or register a new client.',
  exportName = 'clients',
  extraColumns = [],
}) {
  const navigate = useNavigate()
  const { money } = useOfficeSettings()
  const table = useTableState({ defaultSort: { key: 'registered_at', dir: 'desc' } })

  const filters = { ...baseFilters, ...table.filters }
  if (lockedStatus) filters.status = lockedStatus

  const services = useQuery({
    queryKey: qk.services('active'),
    queryFn: listActiveServices,
    ...LONG_CACHE,
  })

  const query = useQuery({
    queryKey: qk.clients({ ...filters, page: table.page, size: table.pageSize, sort: table.sort }),
    queryFn: () => listClients({ range: table.range, sort: table.sort, filters }),
    keepPreviousData: true,
    staleTime: 15_000,
  })

  useWorkflowRealtime([['clients']])

  const columns = [
    {
      // Its own column: staff quote this number to the ministry, so it has to
      // be scannable down the page rather than tucked under the name.
      key: 'reference_no',
      header: 'Reference No.',
      sortable: true,
      render: (r) => (
        <span className="font-medium tabular text-navy-700 dark:text-navy-300">
          {r.reference_no || '—'}
        </span>
      ),
      exportValue: (r) => r.reference_no ?? '',
    },
    {
      key: 'full_name',
      header: 'Client',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.full_name}</p>
          <p className="text-xs text-slate-400 tabular">{r.registration_no}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', className: 'tabular' },
    { key: 'service_name_snapshot', header: 'Service' },
    {
      key: 'final_price',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{money(r.final_price)}</p>
          {Number(r.discount_amount) > 0 && (
            <p className="text-[11px] text-emerald-600">−{money(r.discount_amount)}</p>
          )}
        </div>
      ),
      exportValue: (r) => r.final_price,
    },
    ...(lockedStatus
      ? []
      : [{ key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]),
    {
      key: 'registered_at',
      header: 'Registered',
      sortable: true,
      render: (r) => formatDate(r.registered_at),
    },
    ...extraColumns,
    ...(rowActions
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-2">
                {rowActions(r)}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            placeholder="Name, phone, reference no…"
            defaultValue={table.filters.q ?? ''}
            onChange={(e) => table.setFilter('q', e.target.value)}
          />
          {!lockedStatus && (
            <Select
              label="Status"
              placeholder="All statuses"
              value={table.filters.status ?? ''}
              onChange={(e) => table.setFilter('status', e.target.value)}
              options={STATUS_OPTIONS}
            />
          )}
          <Select
            label="Service"
            placeholder="All services"
            value={table.filters.service ?? ''}
            onChange={(e) => table.setFilter('service', e.target.value)}
            options={(services.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="From"
              type="date"
              value={table.filters.from ?? ''}
              onChange={(e) => table.setFilter('from', e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={table.filters.to ?? ''}
              onChange={(e) => table.setFilter('to', e.target.value)}
            />
          </div>
        </div>

        {table.activeFilterCount > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-surface-border pt-3">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">
              {table.activeFilterCount} filter{table.activeFilterCount === 1 ? '' : 's'} active
            </span>
            <Button variant="ghost" size="sm" icon={X} onClick={table.clearFilters}>
              Clear
            </Button>
          </div>
        )}
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
        onRowClick={(r) => navigate(`/clients/${r.id}`)}
        emptyIcon={Users}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        exportFileName={exportName}
        enablePrint
      />
    </>
  )
}
