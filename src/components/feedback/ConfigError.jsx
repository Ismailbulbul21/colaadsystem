import { AlertTriangle } from 'lucide-react'

/**
 * Shown when the build did not receive its Supabase settings — almost always a
 * fresh deploy where the environment variables have not been added yet.
 * Anything is better than a blank page nobody can diagnose.
 */
export default function ConfigError({ missing = [] }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted p-6">
      <div className="w-full max-w-xl rounded-xl border border-surface-border bg-white p-8 shadow-card">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-ink-900">
          The system is not configured yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          The application built successfully but was not given its database
          settings, so it cannot reach the server. No data is lost — this only
          needs the values below to be added, then a redeploy.
        </p>

        <div className="mt-5 rounded-lg border border-surface-border bg-surface-sunken p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
            Missing
          </p>
          <ul className="mt-2 space-y-1">
            {missing.map((key) => (
              <li key={key} className="font-mono text-sm text-red-700">
                {key}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 text-sm text-ink-600">
          <p className="font-medium text-ink-800">On Vercel</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
            <li>Open the project → <strong>Settings</strong> → <strong>Environment Variables</strong></li>
            <li>Add each name above with its value, for all environments</li>
            <li>
              Go to <strong>Deployments</strong>, open the newest one, and choose{' '}
              <strong>Redeploy</strong>
            </li>
          </ol>
          <p className="mt-3 text-xs text-ink-400">
            Variables are read while the site is being built, so an existing
            deployment will not pick them up until it is redeployed.
          </p>
        </div>
      </div>
    </div>
  )
}
