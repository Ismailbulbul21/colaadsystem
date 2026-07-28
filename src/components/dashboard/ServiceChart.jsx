import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'

import { fetchServiceBreakdown } from '../../services/statsService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { ChartSkeleton } from '../feedback/Skeleton'
import { EmptyState } from '../feedback/States'

const COLORS = ['#0F2C59', '#1E3A8A', '#2A4A8F', '#3B60AC', '#5F84C6', '#95B0DC', '#C3D3EC', '#E2EAF6']

export default function ServiceChart({ days = 30 }) {
  const { money } = useOfficeSettings()
  const { data, isLoading } = useQuery({
    queryKey: ['chart', 'service-breakdown', days],
    queryFn: () => fetchServiceBreakdown(days),
    staleTime: 60_000,
  })

  if (isLoading) return <ChartSkeleton />
  if (!data?.length) {
    return (
      <EmptyState
        title="No revenue yet"
        description="Service revenue will appear here once Finance records the first payment."
      />
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700">Revenue by Service</h3>
      <p className="mb-4 text-xs text-slate-400">Last {days} days</p>

      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [money(value), 'Revenue']}
            cursor={{ fill: '#F1F5FB' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
