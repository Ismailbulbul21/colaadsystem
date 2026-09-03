import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Ban, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Input, Select } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { listServices, cancelService } from '../../services/notaryServiceService'
import { friendlyError } from '../../utils/errors'
import { formatDate } from '../../utils/format'

const STATUS_TONE = { draft: 'amber', final: 'emerald', cancelled: 'slate' }

/** Everything the office has recorded — drafts still open, and finished deeds. */
export default function NotaryServices() {
  const { money } = useOfficeSettings()
  const { role } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const table = useTableState({ defaultSort: { key: 'updated_at', dir: 'desc' } })
  const f = table.filters
  const [cancelling, setCancelling] = useState(null)

  const list = useQuery({
    queryKey: ['notary-services', f, table.page, table.pageSize, table.sort],
    queryFn: () => listServices({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const cancel = useMutation({
    mutationFn: ({ id, reason }) => cancelService(id, reason),
    onSuccess: () => {
      toast.success('Cancelled')
      setCancelling(null)
      queryClient.invalidateQueries({ queryKey: ['notary-services'] })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const columns = useMemo(() => [
    {
      key: 'reference_no', header: 'Reference', sortable: true,
      className: 'tabular font-medium text-navy-700',
      render: (r) => r.reference_no ?? <span className="text-ink-400">draft</span>,
    },
    { key: 'customer_name', header: 'Customer', render: (r) => r.customer_name || '—' },
    { key: 'service_name', header: 'Service', render: (r) => r.service_name || '—' },
    { key: 'document_date', header: 'Date', sortable: true, render: (r) => formatDate(r.document_date) },
    {
      key: 'amount', header: 'Amount', align: 'right',
      render: (r) => <span className="tabular">{money(r.amount)}</span>,
    },
    {
      key: 'total_fees', header: 'Fees', align: 'right',
      render: (r) => r.status === 'final'
        ? <span className="tabular text-emerald-700">{money(r.total_fees)}</span>
        : <span className="text-ink-300">—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status]} dot>
          {r.status === 'final' ? 'Finalised' : r.status === 'draft' ? 'Draft' : 'Cancelled'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === 'final' ? (
            <Button size="sm" variant="ghost" icon={Eye}
                    onClick={() => navigate(`/notary/${r.id}`)}>View</Button>
          ) : (
            <Button size="sm" variant="ghost" icon={Pencil}
                    onClick={() => navigate(`/notary/${r.id}`)}>Continue</Button>
          )}
          {r.status !== 'cancelled'
            && (r.status === 'draft' || role === 'admin') && (
            <Button size="sm" variant="ghost" icon={Ban}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setCancelling(r)}>Cancel</Button>
          )}
        </div>
      ),
    },
  ], [money, role, navigate])

  return (
    <>
      <PageHeader
        title="Notary Services"
        description="Every service the office has recorded — drafts still open, and finalised documents."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Notary Services' }]}
        actions={
          <Link to="/notary/new">
            <Button icon={Plus}>New Notary Service</Button>
          </Link>
        }
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" placeholder="Reference, customer, service…"
                 defaultValue={f.q ?? ''}
                 onChange={(e) => table.setFilter('q', e.target.value)} />
          <Select label="Status" placeholder="All" value={f.status ?? ''}
                  onChange={(e) => table.setFilter('status', e.target.value)}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'final', label: 'Finalised' },
                  ]} />
          <Input label="From" type="date" value={f.from ?? ''}
                 onChange={(e) => table.setFilter('from', e.target.value)} />
          <Input label="To" type="date" value={f.to ?? ''}
                 onChange={(e) => table.setFilter('to', e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
        loading={list.isLoading} error={list.error} onRetry={list.refetch}
        page={table.page} pageSize={table.pageSize}
        onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
        sort={table.sort} onSortChange={table.setSort}
        emptyTitle="Nothing recorded yet"
        emptyDescription="Press New Notary Service to take the first customer."
        exportFileName="notary-services" enablePrint
      />

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this service?"
        message={cancelling
          ? cancelling.status === 'final'
            ? `${cancelling.reference_no} is a finalised document. Cancelling hides it but the reference is never reused.`
            : 'This draft will be removed. Nothing has been issued for it.'
          : ''}
        confirmLabel="Yes, cancel"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate({ id: cancelling.id, reason: 'Cancelled by staff' })}
        onClose={() => setCancelling(null)}
      />
    </>
  )
}
