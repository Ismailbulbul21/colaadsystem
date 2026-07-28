import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'

import { supabase } from '../../lib/supabaseClient'
import { StatusBadge } from '../ui/Badge'
import { TableSkeleton } from '../feedback/Skeleton'
import { EmptyState, ErrorState } from '../feedback/States'
import { formatRelative } from '../../utils/format'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'

/**
 * Small read-only list used on dashboards. Deliberately capped at 8 rows —
 * dashboards must never become a second, slower version of the full table.
 */
export default function RecentClientsTable({ title = 'Recent clients', filter, viewAllTo, limit = 8 }) {
  const navigate = useNavigate()
  const { money } = useOfficeSettings()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recent-clients', title, limit],
    queryFn: async () => {
      let q = supabase
        .from('clients')
        .select('id, registration_no, full_name, phone, service_name_snapshot, final_price, status, registered_at')
        .is('deleted_at', null)
        .order('registered_at', { ascending: false })
        .limit(limit)
      if (filter) q = filter(q)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 20_000,
  })

  if (isError) return <ErrorState error={error} onRetry={refetch} />
  if (isLoading) return <TableSkeleton rows={5} cols={5} />

  if (!data.length) {
    return (
      <EmptyState
        icon={Users}
        title="No clients yet"
        description="Registered clients will appear here as soon as the first one is saved."
      />
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-medium text-navy-700 hover:underline">
            View all
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 text-left font-semibold">Client</th>
              <th className="px-5 py-2.5 text-left font-semibold">Service</th>
              <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-5 py-2.5 text-left font-semibold">Status</th>
              <th className="px-5 py-2.5 text-left font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {data.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className="cursor-pointer transition-colors hover:bg-navy-50/40"
              >
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{c.full_name}</p>
                  <p className="text-xs text-slate-400 tabular">{c.registration_no}</p>
                </td>
                <td className="px-5 py-3 text-slate-600">{c.service_name_snapshot}</td>
                <td className="px-5 py-3 text-right font-medium tabular text-slate-800">
                  {money(c.final_price)}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {formatRelative(c.registered_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
