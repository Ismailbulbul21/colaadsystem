import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReceiptText, Printer } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/table/DataTable'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import ReceiptModal from '../../components/print/ReceiptModal'
import { supabase } from '../../lib/supabaseClient'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { formatDateTime, dayRangeToTimestamps } from '../../utils/format'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../constants'

export default function Receipts() {
  const { money } = useOfficeSettings()
  const table = useTableState({ defaultSort: { key: 'issued_at', dir: 'desc' } })
  const [preview, setPreview] = useState(null)
  const f = table.filters

  const query = useQuery({
    queryKey: ['receipts', f, table.page, table.pageSize, table.sort],
    queryFn: async () => {
      let q = supabase.from('receipts').select('*', { count: 'exact' })

      if (f.q) q = q.or(`receipt_no.ilike.%${f.q}%,client_name.ilike.%${f.q}%,registration_no.ilike.%${f.q}%`)
      if (f.method) q = q.eq('payment_method', f.method)

      if (f.range === 'today') {
        const t = new Date(); t.setHours(0, 0, 0, 0)
        q = q.gte('issued_at', t.toISOString())
      } else {
        const { start, end } = dayRangeToTimestamps(f.from, f.to)
        if (start) q = q.gte('issued_at', start)
        if (end) q = q.lt('issued_at', end)
      }

      q = q.order(table.sort.key, { ascending: table.sort.dir === 'asc' }).range(table.range.from, table.range.to)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
    keepPreviousData: true,
  })

  const columns = [
    { key: 'receipt_no', header: 'Receipt No', sortable: true, className: 'tabular font-medium' },
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
    { key: 'amount_paid', header: 'Paid', align: 'right', sortable: true, render: (r) => money(r.amount_paid), exportValue: (r) => r.amount_paid },
    { key: 'payment_method', header: 'Method', render: (r) => PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method },
    { key: 'issued_at', header: 'Date', sortable: true, render: (r) => formatDateTime(r.issued_at) },
    { key: 'print_count', header: 'Prints', align: 'center', className: 'tabular' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button size="sm" variant="ghost" icon={Printer} onClick={() => setPreview(r)}>
          View / Print
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Every receipt is permanent. Reprinting always produces the original values, even if prices changed since."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts' }]}
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" placeholder="Receipt no, client, registration no" defaultValue={f.q ?? ''} onChange={(e) => table.setFilter('q', e.target.value)} />
          <Select label="Payment method" placeholder="All methods" value={f.method ?? ''} onChange={(e) => table.setFilter('method', e.target.value)} options={PAYMENT_METHODS} />
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
        emptyIcon={ReceiptText}
        emptyTitle="No receipts yet"
        emptyDescription="Receipts are created automatically when Finance records a payment."
        exportFileName="receipts"
      />

      <ReceiptModal receipt={preview} onClose={() => setPreview(null)} />
    </>
  )
}
