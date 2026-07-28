import clsx from 'clsx'

/**
 * Perceived performance matters more than raw speed on an office network.
 * Skeletons keep the layout stable so nothing jumps when data lands.
 */
export function Skeleton({ className, style }) {
  return (
    <div
      className={clsx('relative overflow-hidden rounded bg-slate-200/70', className)}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-surface-border bg-surface-muted px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={clsx('h-4 flex-1', c === 0 && 'max-w-[28%]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({ fields = 6 }) {
  return (
    <div className="card p-6 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3.5 w-28 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="card p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 w-full" style={{ height }} />
    </div>
  )
}
