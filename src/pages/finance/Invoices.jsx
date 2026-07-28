import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/table/DataTable'
import Badge from '../../components/ui/Badge'
import { Input } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { formatDateTime, dayRangeToTimestamps } from '../../utils/format'
import { PAYMENT_METHOD_LABELS } from '../../constants'

export default function Invoices() {
  const { money } = useOfficeSettings()
  const table = useTableState({ defaultSort: { key: 'issued_at', dir: 'desc' } })
  const f = table.filters

  const query = useQuery({
    queryKey: ['invoices', f, table.page, table.pageSize, table.sort],
    queryFn: async () => {
      let q = supabase.from('invoices').select('*', { count: 'exact' })
      if (f.q) q = q.or(`invoice_no.ilike.%${f.q}%,client_name.ilike.%${f.q}%,registration_no.ilike.%${f.q}%`)
      const { start, end } = dayRangeToTimestamps(f.from, f.to)
      if (start) q = q.gte('issued_at', start)
      if (end) q = q.lt('issued_at', end)
      q = q.order(table.sort.key, { ascending: table.sort.dir === 'asc' }).range(table.range.from, table.range.to)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
    keepPreviousData: true,
  })

  const columns = [
    { key: 'invoice_no', header: 'Invoice No', sortable: true, className: 'tabular font-medium' },
    {
      key: 'client_name',
      header: 'Client',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.client_name}</p>
          <p className="text-xs text-slate-400 tabular">{r.registration_no}</p>
        </div>
      ),
    },
    { key: 'service_name', header: 'Service' },
    { key: 'original_price', header: 'Price', align: 'right', render: (r) => money(r.original_price), exportValue: (r) => r.original_price },
    { key: 'discount_amount', header: 'Discount', align: 'right', render: (r) => (Number(r.discount_amount) > 0 ? `− ${money(r.discount_amount)}` : '—'), exportValue: (r) => r.discount_amount },
    { key: 'amount_paid', header: 'Paid', align: 'right', sortable: true, render: (r) => money(r.amount_paid), exportValue: (r) => r.amount_paid },
    { key: 'payment_method', header: 'Method', render: (r) => PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'paid' ? 'emerald' : 'amber'} dot>{r.status}</Badge> },
    { key: 'issued_at', header: 'Issued', sortable: true, render: (r) => formatDateTime(r.issued_at) },
  ]

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Immutable once payment is complete. Historical values are preserved permanently."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]}
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Search" placeholder="Invoice no, client, registration no" defaultValue={f.q ?? ''} onChange={(e) => table.setFilter('q', e.target.value)} />
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
        emptyIcon={FileText}
        emptyTitle="No invoices yet"
        exportFileName="invoices"
        enablePrint
      />
    </>
  )
}
