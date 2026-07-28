import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

import { fetchIncomeTrend } from '../../services/statsService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { ChartSkeleton } from '../feedback/Skeleton'

export default function IncomeChart({ days = 14 }) {
  const { money } = useOfficeSettings()
  const { data, isLoading } = useQuery({
    queryKey: ['chart', 'income-trend', days],
    queryFn: () => fetchIncomeTrend(days),
    staleTime: 60_000,
  })

  if (isLoading) return <ChartSkeleton />

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700">Income vs Expenses</h3>
      <p className="mb-4 text-xs text-slate-400">Last {days} days</p>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data ?? []} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => format(parseISO(d), 'dd MMM')}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={60} />
          <Tooltip
            formatter={(value, name) => [money(value), name === 'income' ? 'Income' : 'Expenses']}
            labelFormatter={(d) => format(parseISO(d), 'EEEE, dd MMM yyyy')}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              fontSize: 12,
              boxShadow: '0 10px 40px -12px rgb(15 44 89 / 0.25)',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => (v === 'income' ? 'Income' : 'Expenses')}
          />
          <Area type="monotone" dataKey="income" stroke="#1E3A8A" strokeWidth={2} fill="url(#incomeFill)" />
          <Area type="monotone" dataKey="expenses" stroke="#DC2626" strokeWidth={2} fill="url(#expenseFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
