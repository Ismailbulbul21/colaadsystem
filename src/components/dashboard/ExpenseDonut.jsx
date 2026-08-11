import { lazy, Suspense } from 'react'
import { ChartSkeleton } from '../feedback/Skeleton'
import { EmptyState } from '../feedback/States'
import { PieChart as PieIcon } from 'lucide-react'

// Recharts is heavy; keep it out of the main bundle.
const Chart = lazy(() => import('./ExpenseDonutChart'))

export default function ExpenseDonut({ data = [], loading, money }) {
  if (loading) return <ChartSkeleton />

  const total = data.reduce((sum, d) => sum + Number(d.value), 0)

  if (!data.length || total === 0) {
    return (
      <EmptyState
        icon={PieIcon}
        title="No expenses this month"
        description="Recorded expenses will be grouped by category here."
      />
    )
  }

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <Chart data={data} total={total} money={money} />
    </Suspense>
  )
}
