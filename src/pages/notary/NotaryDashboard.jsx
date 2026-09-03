import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Plus, FileText, Clock, CircleCheck, Calculator, CalendarDays, Eye,
  ChevronRight, FileCheck2, FilePen, Ban, Layers, Activity,
} from 'lucide-react'
import clsx from 'clsx'

import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Skeleton } from '../../components/feedback/Skeleton'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { notaryDashboard } from '../../services/notaryServiceService'
import { formatDate, formatDateTime } from '../../utils/format'

/**
 * The Nootaayo officer's dashboard.
 *
 * Everything on it comes from one database call, so the headline figures and
 * the lists beneath them are always the same reading of the same moment.
 */

// Written out rather than built from a variable: Tailwind scans source text,
// so a class assembled at runtime is never emitted and the tile renders grey.
const TILES = {
  blue:   { wrap: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40',       ring: 'ring-blue-100 dark:ring-blue-900/40' },
  amber:  { wrap: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40',    ring: 'ring-amber-100 dark:ring-amber-900/40' },
  emerald:{ wrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40', ring: 'ring-emerald-100 dark:ring-emerald-900/40' },
  violet: { wrap: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40', ring: 'ring-violet-100 dark:ring-violet-900/40' },
  teal:   { wrap: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40',       ring: 'ring-teal-100 dark:ring-teal-900/40' },
  red:    { wrap: 'bg-red-50 text-red-600 dark:bg-red-950/40',          ring: 'ring-red-100 dark:ring-red-900/40' },
}

// The four bodies always take the same colour, on the ring and in the legend,
// so the officer learns the chart once.
const BODY_COLOURS = ['#2563eb', '#059669', '#f59e0b', '#7c3aed', '#0891b2']

const STATUS_TONE = { final: 'emerald', draft: 'amber', cancelled: 'slate' }
const STATUS_LABEL = { final: 'Completed', draft: 'Draft', cancelled: 'Cancelled' }

export default function NotaryDashboard() {
  const { profile } = useAuth()
  const { money } = useOfficeSettings()

  const q = useQuery({ queryKey: ['notary-dashboard'], queryFn: () => notaryDashboard() })
  const d = q.data ?? {}
  const loading = q.isLoading

  const stats = [
    ['Today’s Documents', d.today_documents, 'View all documents', FileText, 'blue', '/notary'],
    ['Pending Documents', d.pending, 'View pending', Clock, 'amber', '/notary?status=draft'],
    ['Completed Today', d.completed_today, 'View completed', CircleCheck, 'emerald', '/notary?status=final'],
    ['Today’s Fees', money(d.today_fees ?? 0), 'Calculated automatically', Calculator, 'violet', '/finance/notary-fees'],
    ['This Month (Fees)', money(d.month_fees ?? 0), 'View full report', CalendarDays, 'teal', '/finance/notary-fees'],
  ]

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">
            Nootaayo Office Dashboard
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {formatDate(d.date ?? new Date())} · {profile?.full_name}
          </p>
        </div>
        <Link to="/notary/new">
          <Button icon={Plus} size="lg">New Notary Service</Button>
        </Link>
      </div>

      {/* ---------------- stat tiles ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map(([label, value, hint, Icon, tone, to]) => (
          <Link key={label} to={to}
                className="card group p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className={clsx('rounded-xl p-2.5 ring-4', TILES[tone].wrap, TILES[tone].ring)}>
                <Icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-ink-900">
              {loading ? <Skeleton className="h-7 w-20" /> : (value ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
          </Link>
        ))}
      </div>

      {/* ---------------- recent + fees ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-800">Recent Notary Documents</h2>
            <Link to="/notary">
              <Button size="sm" variant="secondary">View All</Button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (d.recent ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              Nothing yet. Press <strong>New Notary Service</strong> to take the first customer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="pb-2 pr-3 font-medium">Ref No.</th>
                    <th className="pb-2 pr-3 font-medium">Client</th>
                    <th className="pb-2 pr-3 font-medium">Service</th>
                    <th className="pb-2 pr-3 font-medium">Property / Lot</th>
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((r) => (
                    <tr key={r.id} className="border-b border-surface-border last:border-0">
                      <td className="py-2.5 pr-3 tabular font-medium text-navy-700">
                        {r.reference_no ?? <span className="text-ink-400">draft</span>}
                      </td>
                      <td className="py-2.5 pr-3">{r.customer_name || '—'}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{r.service_name || '—'}</td>
                      <td className="py-2.5 pr-3 tabular text-ink-600">
                        {r.lot_no ? `${r.lot_no}${r.land_size ? ` (${r.land_size})` : ''}` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-600">{formatDate(r.document_date)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link to={`/notary/${r.id}`}>
                          <Button size="sm" variant="ghost" icon={Eye}>
                            <span className="sr-only">Open</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <FeesSummary data={d} money={money} loading={loading} />
      </div>

      {/* ---------------- status / popular / activity ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <StatusBreakdown data={d} loading={loading} />
        <PopularServices data={d} loading={loading} />
        <RecentActivity data={d} loading={loading} />
      </div>

      {/* ---------------- welcome strip ---------------- */}
      <div className="card flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl bg-navy-50 p-2.5 text-navy-700 dark:bg-navy-950/40">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-800">Welcome to Nootaayo Office</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
              Record the parties, let the fees work themselves out, and the document
              writes itself.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {[
            ['Total Clients', d.total_clients],
            ['Total Services', d.total_services],
            ['Documents Issued', d.total_documents],
            ['Fees This Year', money(d.year_fees ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {label}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular text-ink-900">
                {loading ? '—' : (value ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ fee donut */

function FeesSummary({ data, money, loading }) {
  const rows = data.fees_by_body ?? []
  const total = useMemo(
    () => rows.reduce((n, r) => n + Number(r.amount), 0),
    [rows],
  )

  // Drawn as SVG arcs rather than pulled from a chart library: it has to
  // survive being printed, where a canvas often comes out blank.
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-800">Fees Summary</h2>
      <p className="mb-4 text-xs text-ink-500">This month, by who receives it.</p>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : total === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No fees collected yet this month.</p>
      ) : (
        <>
          <div className="relative mx-auto h-40 w-40">
            <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
              {rows.map((r, i) => {
                const dash = (Number(r.amount) / total) * C
                const el = (
                  <circle key={r.category} cx="50" cy="50" r={R} fill="none"
                          stroke={BODY_COLOURS[i % BODY_COLOURS.length]} strokeWidth="14"
                          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />
                )
                offset += dash
                return el
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular text-ink-900">{money(total)}</span>
              <span className="text-[11px] text-ink-400">Total</span>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-[13px]">
            {rows.map((r, i) => (
              <li key={r.category} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: BODY_COLOURS[i % BODY_COLOURS.length] }} />
                <span className="min-w-0 flex-1 truncate text-ink-600">{r.category}</span>
                <span className="tabular font-medium text-ink-800">{money(r.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link to="/finance/notary-fees"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline">
        View full fee report <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/* ------------------------------------------------------ status breakdown */

function StatusBreakdown({ data, loading }) {
  const s = data.by_status ?? {}
  const rows = [
    ['Completed Documents', s.final, CircleCheck, 'emerald', '/notary?status=final'],
    ['Draft Documents', s.draft, FilePen, 'amber', '/notary?status=draft'],
    ['Cancelled Documents', s.cancelled, Ban, 'red', '/notary'],
  ]

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink-800">Documents by Status</h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map(([label, value, Icon, tone, to]) => (
            <li key={label}>
              <Link to={to}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
                <span className={clsx('rounded-lg p-1.5', TILES[tone].wrap)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">{label}</span>
                <span className="tabular font-semibold text-ink-900">{value ?? 0}</span>
                <ChevronRight className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3 text-[13px]">
        <span className="font-medium text-ink-700">Total Documents</span>
        <span className="tabular font-semibold text-navy-800">{s.total ?? 0}</span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- popular services */

function PopularServices({ data, loading }) {
  const rows = data.popular ?? []
  const top = rows[0]?.count ?? 1

  return (
    <div className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Layers className="h-4 w-4 text-ink-400" /> Popular Services
      </h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No services recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.service_name}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink-700">{r.service_name}</span>
                <span className="tabular font-semibold text-ink-900">{r.count}</span>
              </div>
              {/* the bar makes the ranking readable at a glance */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-navy-600"
                     style={{ width: `${Math.max(6, (r.count / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* --------------------------------------------------------- recent activity */

function RecentActivity({ data, loading }) {
  const rows = data.activity ?? []
  const toneFor = (action) =>
    action?.includes('finalized') ? 'bg-emerald-500'
      : action?.includes('cancelled') ? 'bg-red-500'
      : 'bg-amber-500'

  return (
    <div className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Activity className="h-4 w-4 text-ink-400" /> Recent Activity
      </h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">Nothing has happened yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneFor(a.action))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink-700">{a.description}</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {formatDateTime(a.at)}{a.who ? ` · ${a.who}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
