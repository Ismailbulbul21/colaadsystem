import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Upload, Printer, RotateCcw, Inbox } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/dashboard/StatCard'
import Button from '../../components/ui/Button'
import { CardsSkeleton, TableSkeleton } from '../../components/feedback/Skeleton'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { fetchAltStats } from '../../services/statsService'
import { supabase } from '../../lib/supabaseClient'
import { useWorkflowRealtime } from '../../hooks/useRealtime'
import { formatRelative, formatFileSize } from '../../utils/format'
import { DASHBOARD_CACHE } from '../../lib/queryClient'

export default function AltDashboard() {
  const stats = useQuery({
    queryKey: ['stats', 'alt'],
    queryFn: fetchAltStats,
    ...DASHBOARD_CACHE,
  })

  const uploads = useQuery({
    queryKey: ['recent-uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('id, title, file_name, file_size, version, print_count, uploaded_at, client_id, clients(full_name, registration_no, service_name_snapshot)')
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data ?? []
    },
    staleTime: 20_000,
  })

  useWorkflowRealtime([['stats', 'alt'], ['recent-uploads']])

  if (stats.isError) return <ErrorState error={stats.error} onRetry={stats.refetch} />
  const s = stats.data ?? {}

  return (
    <>
      <PageHeader
        title="ALT Department"
        description="Prepare each document in Microsoft Word, then upload the finished file here."
        actions={
          <Link to="/alt/queue">
            <Button icon={Inbox} size="lg">
              Open Work Queue
            </Button>
          </Link>
        }
      />

      {stats.isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting Documents"
            value={s.waitingDocuments}
            icon={FileText}
            tone="amber"
            to="/alt/queue"
            hint="Clients ready for you"
            emphasis={s.waitingDocuments > 0}
          />
          <StatCard
            label="Uploaded Today"
            value={s.uploadedToday}
            icon={Upload}
            tone="blue"
            to="/alt/documents?range=today"
          />
          <StatCard
            label="Printed Today"
            value={s.printedToday}
            icon={Printer}
            tone="indigo"
            to="/alt/documents"
          />
          <StatCard
            label="Reprinted Today"
            value={s.reprintedToday}
            icon={RotateCcw}
            tone="slate"
            to="/alt/documents"
          />
        </div>
      )}

      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-700">Recent uploads</h3>
          <Link to="/alt/documents" className="text-xs font-medium text-navy-700 hover:underline">
            Document Center
          </Link>
        </div>

        {uploads.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : uploads.data?.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="No documents uploaded yet"
            description="Once you upload a finished Word or PDF file it will appear here with its version history."
          />
        ) : (
          <div className="divide-y divide-surface-border">
            {uploads.data.map((d) => (
              <Link
                key={d.id}
                to={`/clients/${d.client_id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy-50/40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{d.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {d.clients?.full_name} · {d.clients?.registration_no} ·{' '}
                    {d.clients?.service_name_snapshot}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs text-slate-500">
                    v{d.version} · {formatFileSize(d.file_size)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {d.print_count} print{d.print_count === 1 ? '' : 's'} ·{' '}
                    {formatRelative(d.uploaded_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
