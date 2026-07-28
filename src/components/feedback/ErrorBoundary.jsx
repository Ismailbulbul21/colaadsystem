import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Without this, any render error anywhere unmounts the whole tree and the
 * employee sees a blank page with no idea what happened.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Colaad] Render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted p-6">
        <div className="w-full max-w-lg rounded-xl border border-surface-border bg-white p-8 shadow-card">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            The page could not be displayed. Nothing was saved or lost.
          </p>

          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-red-700">
            {this.state.error?.message || String(this.state.error)}
          </pre>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800"
            >
              <RefreshCw className="h-4 w-4" /> Reload
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-10 items-center rounded-lg border border-surface-border px-4 text-sm font-medium text-slate-700 hover:bg-surface-muted"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
