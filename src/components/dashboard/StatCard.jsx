import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowUpRight } from 'lucide-react'
import { Skeleton } from '../feedback/Skeleton'

const TONES = {
  navy: 'bg-navy-50 text-navy-700 ring-navy-100',
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  slate: 'bg-ink-100 text-ink-600 ring-ink-200',
}

const BARS = {
  navy: 'bg-navy-600',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-ink-400',
}

/**
 * Every dashboard card is clickable and lands on the SAME list, pre-filtered.
 * "Pending Payments: 7" goes to Finance showing exactly those seven.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'navy',
  to,
  hint,
  loading = false,
  emphasis = false,
}) {
  const body = (
    <>
      {/* Colour bar reads as a category marker rather than decoration */}
      <span
        className={clsx(
          'absolute inset-x-0 top-0 h-[3px] rounded-t-xl transition-opacity duration-200',
          BARS[tone],
          emphasis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-ink-500">{label}</p>
        {Icon && (
          <span
            className={clsx(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-transform duration-200 group-hover:scale-105',
              TONES[tone],
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3.5 h-8 w-24" />
      ) : (
        <p
          className={clsx(
            'mt-2.5 font-semibold tabular tracking-tight text-ink-900',
            emphasis ? 'text-[28px] leading-none' : 'text-2xl leading-none',
          )}
        >
          {value}
        </p>
      )}

      <div className="mt-2.5 flex items-end justify-between gap-2">
        {hint ? (
          <p className="text-xs leading-snug text-ink-400">{hint}</p>
        ) : (
          <span />
        )}
        {to && (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy-600" />
        )}
      </div>
    </>
  )

  const className = clsx(
    'group relative overflow-hidden rounded-xl border border-surface-border bg-white p-5 text-left shadow-card',
    to && 'cursor-pointer transition-all duration-200 hover:-translate-y-px hover:border-navy-200 hover:shadow-card-hover',
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}
