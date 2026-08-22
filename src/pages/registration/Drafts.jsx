import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { FileClock, Pencil, UserPlus } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import DataTable from '../../components/table/DataTable'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { listClients } from '../../services/clientService'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { formatDateTime } from '../../utils/format'

/**
 * Unfinished registrations, so a clerk interrupted halfway can always find
 * their work again instead of starting over.
 */
export default function Drafts() {
  const navigate = useNavigate()
  const { money } = useOfficeSettings()
  const table = useTableState({ defaultSort: { key: 'registered_at', dir: 'desc' } })

  const query = useQuery({
    queryKey: ['clients', 'drafts', table.page, table.pageSize, table.sort],
    queryFn: () =>
      listClients({
        range: table.range,
        sort: table.sort,
        filters: { status: 'draft' },
      }),
    keepPreviousData: true,
  })

  const columns = [
    {
      key: 'reference_no',
      header: 'Reference No.',
      sortable: true,
      render: (r) => (
        <span className="font-medium tabular text-navy-700 dark:text-navy-300">
          {r.reference_no || '—'}
        </span>
      ),
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
      render: (r) => money(r.final_price),
      exportValue: (r) => r.final_price,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'registered_at',
      header: 'Started',
      sortable: true,
      render: (r) => formatDateTime(r.registered_at),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          icon={Pencil}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/registration/draft/${r.id}`)
          }}
        >
          Continue
        </Button>
      ),
    },
  ]

  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />

  return (
    <>
      <PageHeader
        title="Drafts"
        description="Registrations that were started but not finished. Open one to carry on where you left off."
        breadcrumbs={[{ label: 'Registration', to: '/registration' }, { label: 'Drafts' }]}
        actions={
          <Link to="/registration/new">
            <Button icon={UserPlus}>New Client</Button>
          </Link>
        }
      />

      {!query.isLoading && !query.data?.rows?.length ? (
        <div className="card p-6">
          <EmptyState
            icon={FileClock}
            title="No unfinished drafts"
            description="When you save a registration as a draft it will wait for you here."
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={query.data?.rows ?? []}
          total={query.data?.total ?? 0}
          loading={query.isLoading}
          page={table.page}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          sort={table.sort}
          onSortChange={table.setSort}
          onRowClick={(r) => navigate(`/registration/draft/${r.id}`)}
          exportFileName="drafts"
        />
      )}
    </>
  )
}
