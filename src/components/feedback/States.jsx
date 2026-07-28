import { Inbox, AlertTriangle, WifiOff, RefreshCw } from 'lucide-react'
import { friendlyError, isOffline } from '../../utils/errors'
import { useT } from '../../contexts/LanguageContext'
import Button from '../ui/Button'

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-600">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const t = useT()
  const offline = isOffline(error)
  const Icon = offline ? WifiOff : AlertTriangle

  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">
        {offline ? t('state.offline') : t('state.error')}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500">{friendlyError(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry} icon={RefreshCw}>
          {t('action.retry')}
        </Button>
      )}
    </div>
  )
}

/** Thin banner used when a background refresh fails but stale data is shown. */
export function ConnectionBanner({ onRetry }) {
  return (
    <div className="no-print flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" />
        Connection lost. You are viewing the last loaded data.
      </span>
      <button onClick={onRetry} className="font-medium underline underline-offset-2">
        Retry
      </button>
    </div>
  )
}
