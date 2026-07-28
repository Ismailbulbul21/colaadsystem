import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function PageHeader({ title, description, breadcrumbs = [], actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-ink-400 no-print">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {b.to ? (
                  <Link to={b.to} className="hover:text-navy-700 hover:underline">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-ink-900 lg:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}
