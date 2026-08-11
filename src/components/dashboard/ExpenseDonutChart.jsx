import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

// Distinct enough to tell apart at a glance, and readable in both themes.
const COLORS = [
  '#2F5697', '#4270B3', '#BE9036', '#6690CB',
  '#CFA84B', '#26437A', '#9AB6DF', '#815726',
  '#1B3260', '#DCC074', '#4E5C74', '#A2732B',
  '#0F2444',
]

export default function ExpenseDonutChart({ data, total, money }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => money(v)}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid rgb(var(--surface-border))',
                background: 'rgb(var(--surface))',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full min-w-0 flex-1">
        <ul className="space-y-2">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink-600">{d.name}</span>
              <span className="tabular font-medium text-ink-800">{money(d.value)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3 text-sm">
          <span className="font-semibold text-ink-700">Total</span>
          <span className="tabular font-semibold text-ink-900">{money(total)}</span>
        </div>
      </div>
    </div>
  )
}
