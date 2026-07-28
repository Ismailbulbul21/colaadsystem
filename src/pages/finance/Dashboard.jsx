import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, TrendingDown, Scale, ReceiptText, CalendarRange, Plus,
} from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/dashboard/StatCard'
import Button from '../../components/ui/Button'
import { CardsSkeleton, TableSkeleton, ChartSkeleton } from '../../components/feedback/Skeleton'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { fetchFinanceStats } from '../../services/statsService'
import { supabase } from '../../lib/supabaseClient'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useWorkflowRealtime } from '../../hooks/useRealtime'
import { formatRelative } from '../../utils/format'
import { PAYMENT_METHOD_LABELS } from '../../constants'
import { DASHBOARD_CACHE } from '../../lib/queryClient'

const IncomeChart = lazy(() => import('../../components/dashboard/IncomeChart'))

export default function FinanceDashboard() {
  const { money } = useOfficeSettings()

  const stats = useQuery({
    queryKey: ['stats', 'finance'],
    queryFn: fetchFinanceStats,
    ...DASHBOARD_CACHE,
  })

  const recent = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('id, receipt_no, client_name, service_name, amount_paid, payment_method, issued_at, client_id')
        .order('issued_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data ?? []
    },
    staleTime: 20_000,
  })

  const expenseSummary = useQuery({
    queryKey: ['expense-summary-month'],
    queryFn: async () => {
      const start = new Date()
      const from = new Date(start.getFullYear(), start.getMonth(), 1).toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('expenses')
        .select('category_name_snapshot, amount')
        .gte('expense_date', from)
        .is('deleted_at', null)
      if (error) throw error
      const map = new Map()
      for (const e of data ?? []) {
        map.set(
          e.category_name_snapshot,
          (map.get(e.category_name_snapshot) ?? 0) + Number(e.amount ?? 0),
        )
      }
      return Array.from(map, ([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
    },
    staleTime: 60_000,
  })

  useWorkflowRealtime([['stats', 'finance'], ['recent-transactions']])

  if (stats.isError) return <ErrorState error={stats.error} onRetry={stats.refetch} />
  const s = stats.data ?? {}

  return (
    <>
      <PageHeader
        title="Finance Dashboard"
        description="Receive payments, print receipts and keep the office books accurate."
        actions={
          <>
            <Link to="/finance/expenses">
              <Button variant="secondary" icon={Plus}>
                Record Expense
              </Button>
            </Link>
            <Link to="/finance/pending">
              <Button icon={Wallet} size="lg">
                Pending Payments
              </Button>
            </Link>
          </>
        }
      />

      {stats.isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pending Payments"
              value={s.pendingPayments}
              icon={Wallet}
              tone="orange"
              to="/finance/pending"
              hint="Clients ready to pay"
              emphasis={s.pendingPayments > 0}
            />
            <StatCard
              label="Today's Income"
              value={money(s.todayIncome)}
              icon={TrendingUp}
              tone="emerald"
              to="/finance/reports?report=daily-income"
            />
            <StatCard
              label="Today's Expenses"
              value={money(s.todayExpenses)}
              icon={TrendingDown}
              tone="red"
              to="/finance/expenses?range=today"
            />
            <StatCard
              label="Today's Profit"
              value={money(s.todayProfit)}
              icon={Scale}
              tone={s.todayProfit >= 0 ? 'navy' : 'red'}
              to="/finance/reports?report=profit"
              hint="Income minus expenses"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Receipts Printed Today"
              value={s.receiptsToday}
              icon={ReceiptText}
              tone="indigo"
              to="/finance/receipts?range=today"
            />
            <StatCard
              label="Monthly Revenue"
              value={money(s.monthRevenue)}
              icon={CalendarRange}
              tone="navy"
              to="/finance/reports?report=monthly"
            />
          </div>
        </>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartSkeleton />}>
            <IncomeChart />
          </Suspense>

          <div className="mt-5 card overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-700">Recent transactions</h3>
              <Link to="/finance/receipts" className="text-xs font-medium text-navy-700 hover:underline">
                All receipts
              </Link>
            </div>

            {recent.isLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : recent.data?.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No payments yet"
                description="Receipts appear here the moment the first payment is received."
              />
            ) : (
              <div className="divide-y divide-surface-border">
                {recent.data.map((r) => (
                  <Link
                    key={r.id}
                    to={`/clients/${r.client_id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{r.client_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.receipt_no} · {r.service_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular text-emerald-700">
                        {money(r.amount_paid)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method} ·{' '}
                        {formatRelative(r.issued_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-700">Expenses this month</h3>
            <Link to="/finance/expenses" className="text-xs font-medium text-navy-700 hover:underline">
              Manage
            </Link>
          </div>

          {expenseSummary.isLoading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : expenseSummary.data?.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No expenses recorded this month.
            </p>
          ) : (
            <div className="divide-y divide-surface-border">
              {expenseSummary.data.map((e) => (
                <div key={e.name} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-700">{e.name}</span>
                  <span className="text-sm font-medium tabular text-slate-900">
                    {money(e.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
