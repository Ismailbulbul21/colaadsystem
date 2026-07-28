import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, Clock, FileText, Wallet, TrendingUp, TrendingDown, BadgePercent,
  UserCog, Briefcase, Printer, Plus, ArrowRight, Activity,
} from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/dashboard/StatCard'
import Button from '../../components/ui/Button'
import { CardsSkeleton, ChartSkeleton, Skeleton } from '../../components/feedback/Skeleton'
import { ErrorState } from '../../components/feedback/States'
import { fetchAdminStats, fetchRecentActivity } from '../../services/statsService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useWorkflowRealtime } from '../../hooks/useRealtime'
import { formatRelative } from '../../utils/format'
import { DASHBOARD_CACHE } from '../../lib/queryClient'

const IncomeChart = lazy(() => import('../../components/dashboard/IncomeChart'))
const ServiceChart = lazy(() => import('../../components/dashboard/ServiceChart'))

export default function AdminDashboard() {
  const { money } = useOfficeSettings()

  const stats = useQuery({
    queryKey: ['stats', 'admin'],
    queryFn: fetchAdminStats,
    ...DASHBOARD_CACHE,
  })

  const activity = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => fetchRecentActivity(12),
    ...DASHBOARD_CACHE,
  })

  useWorkflowRealtime([['stats', 'admin'], ['recent-activity']])

  if (stats.isError) return <ErrorState error={stats.error} onRetry={stats.refetch} />

  const s = stats.data ?? {}
  const loading = stats.isLoading

  return (
    <>
      <PageHeader
        title="Administrator Dashboard"
        description="Everything happening in the office right now."
        actions={
          <>
            <Link to="/admin/employees">
              <Button variant="secondary" icon={UserCog}>
                Employees
              </Button>
            </Link>
            <Link to="/registration/new">
              <Button icon={Plus}>New Client</Button>
            </Link>
          </>
        }
      />

      {/* ---------- today ---------- */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Today</h2>
        {loading ? (
          <CardsSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Today's Clients"
              value={s.todayClients}
              icon={Users}
              tone="navy"
              to="/clients?range=today"
              hint="Registered since midnight"
            />
            <StatCard
              label="Today's Income"
              value={money(s.todayIncome)}
              icon={TrendingUp}
              tone="emerald"
              to="/finance/reports?report=daily-income"
              hint="From completed payments"
            />
            <StatCard
              label="Today's Expenses"
              value={money(s.todayExpenses)}
              icon={TrendingDown}
              tone="red"
              to="/finance/expenses"
              hint="Recorded by Finance"
            />
            <StatCard
              label="Monthly Revenue"
              value={money(s.monthRevenue)}
              icon={Wallet}
              tone="indigo"
              to="/finance/reports?report=monthly"
              hint={`Profit ${money(s.monthProfit)}`}
            />
          </div>
        )}
      </section>

      {/* ---------- work waiting ---------- */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Work waiting</h2>
        {loading ? (
          <CardsSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pending Clients"
              value={s.pendingClients}
              icon={Clock}
              tone="amber"
              to="/clients?pending=1"
              hint="Not yet completed"
            />
            <StatCard
              label="Waiting Documents"
              value={s.waitingDocuments}
              icon={FileText}
              tone="blue"
              to="/alt/queue"
              hint="With the ALT department"
            />
            <StatCard
              label="Waiting Payments"
              value={s.waitingPayments}
              icon={Wallet}
              tone="orange"
              to="/finance/pending"
              hint="Ready for the cashier"
            />
            <StatCard
              label="Pending Discounts"
              value={s.pendingDiscounts}
              icon={BadgePercent}
              tone="red"
              to="/admin/discounts"
              hint="Needs your approval"
              emphasis={s.pendingDiscounts > 0}
            />
          </div>
        )}
      </section>

      {/* ---------- office totals ---------- */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Office</h2>
        {loading ? (
          <CardsSkeleton count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Employees" value={s.totalEmployees} icon={UserCog} tone="navy" to="/admin/employees" />
            <StatCard label="Total Services" value={s.totalServices} icon={Briefcase} tone="indigo" to="/admin/services" />
            <StatCard label="Documents Printed" value={s.documentsPrinted} icon={Printer} tone="slate" to="/alt/documents" />
          </div>
        )}
      </section>

      {/* ---------- charts + activity ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Suspense fallback={<ChartSkeleton />}>
            <IncomeChart />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <ServiceChart />
          </Suspense>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Activity className="h-4 w-4 text-slate-400" /> Recent Activity
            </h3>
            <Link to="/admin/logs" className="text-xs font-medium text-navy-700 hover:underline">
              View all
            </Link>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {activity.isLoading ? (
              <div className="space-y-4 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : (activity.data ?? []).length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No activity recorded yet.
              </p>
            ) : (
              activity.data.map((log) => (
                <div key={log.id} className="border-b border-surface-border px-5 py-3 last:border-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{log.user_name_snapshot}</span>{' '}
                    {log.description || log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {log.module} · {formatRelative(log.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------- quick actions ---------- */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/admin/employees', label: 'Add an employee', icon: UserCog },
          { to: '/admin/services', label: 'Manage services & prices', icon: Briefcase },
          { to: '/admin/discounts', label: 'Review discount requests', icon: BadgePercent },
          { to: '/admin/settings', label: 'Office settings & receipt', icon: FileText },
        ].map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card card-hover group flex items-center gap-3 px-4 py-3.5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-50 text-navy-700">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-navy-600" />
          </Link>
        ))}
      </div>
    </>
  )
}
