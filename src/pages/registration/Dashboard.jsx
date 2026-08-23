import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Clock, FileText, Wallet, CheckCircle2, Plus } from 'lucide-react'

import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/dashboard/StatCard'
import Button from '../../components/ui/Button'
import { CardsSkeleton } from '../../components/feedback/Skeleton'
import { ErrorState } from '../../components/feedback/States'
import RecentClientsTable from '../../components/dashboard/RecentClientsTable'
import { fetchRegistrationStats } from '../../services/statsService'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkflowRealtime } from '../../hooks/useRealtime'
import { DASHBOARD_CACHE } from '../../lib/queryClient'

export default function RegistrationDashboard() {
  const { profile } = useAuth()

  const stats = useQuery({
    queryKey: ['stats', 'registration', profile?.id],
    queryFn: () => fetchRegistrationStats(profile.id),
    enabled: !!profile?.id,
    ...DASHBOARD_CACHE,
  })

  useWorkflowRealtime([['stats', 'registration', profile?.id], ['recent-clients']])

  if (stats.isError) return <ErrorState error={stats.error} onRetry={stats.refetch} />
  const s = stats.data ?? {}

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? ''}`}
        description="Register clients and track where each one is in the process."
        actions={
          <Link to="/registration/new">
            <Button icon={Plus} size="lg">
              New Client
            </Button>
          </Link>
        }
      />

      {stats.isLoading ? (
        <CardsSkeleton count={5} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Today's Clients"
            value={s.todayClients}
            icon={Users}
            tone="navy"
            to="/registration/clients?range=today"
            hint="Registered by you"
          />
          <StatCard
            label="Waiting Admin Approval"
            value={s.waitingApproval}
            icon={Clock}
            tone="amber"
            to="/registration/clients?status=waiting_admin_approval"
            hint="Discount pending"
          />
          <StatCard
            label="Waiting Nootaayo"
            value={s.waitingAlt}
            icon={FileText}
            tone="blue"
            to="/registration/clients?status=waiting_alt"
            hint="Document being prepared"
          />
          <StatCard
            label="Waiting Payment"
            value={s.waitingPayment}
            icon={Wallet}
            tone="orange"
            to="/registration/clients?status=waiting_payment"
            hint="With the cashier"
          />
          <StatCard
            label="Completed Today"
            value={s.completedToday}
            icon={CheckCircle2}
            tone="emerald"
            to="/registration/clients?status=completed"
            hint="Paid and finished"
          />
        </div>
      )}

      <div className="mt-6">
        <RecentClientsTable
          title="Your recent registrations"
          filter={(q) => q.eq('registered_by', profile?.id)}
          viewAllTo="/registration/clients"
        />
      </div>
    </>
  )
}
