import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Download } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/table/DataTable'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { supabase, signedDocumentUrl } from '../../lib/supabaseClient'
import { useTableState } from '../../hooks/useTableState'
import { formatDateTime, formatFileSize, dayRangeToTimestamps } from '../../utils/format'
import { friendlyError } from '../../utils/errors'

export default function DocumentCenter() {
  const navigate = useNavigate()
  const table = useTableState({ defaultSort: { key: 'uploaded_at', dir: 'desc' } })
  const f = table.filters

  const query = useQuery({
    queryKey: ['documents', f, table.page, table.pageSize, table.sort],
    queryFn: async () => {
      let q = supabase
        .from('uploaded_documents')
        .select(
          'id, title, file_name, file_path, file_size, mime_type, version, is_current, status, print_count, uploaded_at, client_id, clients(full_name, registration_no, service_name_snapshot)',
          { count: 'exact' },
        )
        .is('deleted_at', null)

      if (f.q) q = q.or(`title.ilike.%${f.q}%,file_name.ilike.%${f.q}%`)
      const { start, end } = dayRangeToTimestamps(f.from, f.to)
      if (start) q = q.gte('uploaded_at', start)
      if (end) q = q.lt('uploaded_at', end)

      q = q.order(table.sort.key, { ascending: table.sort.dir === 'asc' }).range(table.range.from, table.range.to)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
    keepPreviousData: true,
  })

  const download = async (doc) => {
    try {
      const url = await signedDocumentUrl(doc.file_path, 120)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Document',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.title}</p>
          <p className="text-xs text-slate-400">{d.file_name}</p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (d) => (
        <div>
          <p className="text-slate-700">{d.clients?.full_name}</p>
          <p className="text-xs text-slate-400 tabular">{d.clients?.registration_no}</p>
        </div>
      ),
      exportValue: (d) => d.clients?.full_name,
    },
    { key: 'service', header: 'Service', render: (d) => d.clients?.service_name_snapshot ?? '—' },
    {
      key: 'version',
      header: 'Version',
      align: 'center',
      render: (d) =>
        d.is_current ? <Badge tone="emerald">v{d.version} current</Badge> : <Badge tone="slate">v{d.version}</Badge>,
    },
    { key: 'file_size', header: 'Size', align: 'right', render: (d) => formatFileSize(d.file_size) },
    { key: 'print_count', header: 'Prints', align: 'center', className: 'tabular' },
    { key: 'uploaded_at', header: 'Uploaded', sortable: true, render: (d) => formatDateTime(d.uploaded_at) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <Button size="sm" variant="ghost" icon={Download} onClick={() => download(d)}>
          Download
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Document Center"
        description="Every uploaded document, with its version history and print count."
        breadcrumbs={[{ label: 'Nootaayo', to: '/alt' }, { label: 'Document Center' }]}
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Search" placeholder="Document title or file name" defaultValue={f.q ?? ''} onChange={(e) => table.setFilter('q', e.target.value)} />
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
        onRowClick={(d) => navigate(`/clients/${d.client_id}`)}
        emptyIcon={FolderOpen}
        emptyTitle="No documents uploaded yet"
        emptyDescription="Documents appear here once Nootaayo uploads a finished file."
        exportFileName="documents"
      />
    </>
  )
}
