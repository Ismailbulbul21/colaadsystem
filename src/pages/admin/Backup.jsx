import { useState } from 'react'
import { Download, DatabaseBackup, ShieldCheck, FileSpreadsheet, Info } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { createBackup, downloadBackup, downloadTableCsv } from '../../services/backupService'
import { friendlyError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

export default function Backup() {
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(null)
  const [last, setLast] = useState(null)

  const run = async (thenDownload = true) => {
    if (busy) return
    setBusy(true)
    try {
      const backup = await createBackup(setStep)
      setLast({ backup, at: new Date().toISOString() })
      if (thenDownload) {
        downloadBackup(backup)
        toast.success('Backup downloaded')
      }
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  const counts = last?.backup?.meta?.row_counts ?? {}
  const skipped = last?.backup?.skipped ?? {}
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <>
      <PageHeader
        title="Backup"
        description="Take a copy of every record in the office database, so nothing is lost."
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Backup' }]}
        actions={
          <Button icon={Download} size="lg" loading={busy} onClick={() => run(true)}>
            Download full backup
          </Button>
        }
      />

      {busy && step && (
        <div className="mb-5 rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-900">
          Reading <strong>{step}</strong>…
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <DatabaseBackup className="h-4 w-4 text-ink-400" /> What a backup contains
          </h3>
          <p className="text-sm leading-relaxed text-ink-500">
            One JSON file holding every row from all 20 tables — clients, payments,
            receipts, invoices, expenses, employees and the full activity log.
            Taking a backup only reads; it never changes anything.
          </p>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The uploaded Word and PDF documents are <strong>not</strong> inside this
              file — they live in Supabase Storage. Keep a copy of those separately if
              you need a complete archive.
            </span>
          </div>

          {last && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Last backup · {formatDateTime(last.at)}
                </p>
                <Badge tone="emerald">{totalRows.toLocaleString()} rows</Badge>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-surface-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-surface-border">
                    {Object.entries(counts).map(([table, n]) => (
                      <tr key={table}>
                        <td className="px-3 py-2 font-mono text-xs text-ink-700">{table}</td>
                        <td className="px-3 py-2 text-right tabular text-ink-600">{n}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            disabled={!n}
                            onClick={() =>
                              downloadTableCsv(table, last.backup.tables[table]) ||
                              toast.error('That table is empty.')
                            }
                            className="text-xs font-medium text-navy-700 hover:underline disabled:opacity-40 disabled:no-underline"
                          >
                            CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {Object.keys(skipped).length > 0 && (
                <div className="mt-3 rounded-lg bg-red-50 px-3.5 py-3 text-xs text-red-800">
                  <p className="font-semibold">Could not read:</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(skipped).map(([t, err]) => (
                      <li key={t}>
                        <span className="font-mono">{t}</span> — {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!last && !busy && (
            <Button
              variant="secondary"
              icon={FileSpreadsheet}
              className="mt-5"
              onClick={() => run(false)}
            >
              Preview what would be backed up
            </Button>
          )}
        </div>

        {/* ---------- restore ---------- */}
        <div className="card p-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <ShieldCheck className="h-4 w-4 text-ink-400" /> Restoring
          </h3>
          <p className="text-sm leading-relaxed text-ink-500">
            Restoring is deliberately not a button in this app.
          </p>

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-600">
            <p>
              Payments, receipts, invoices and the activity log are permanent by
              design — the database refuses to change or delete them. That is what
              makes the financial record trustworthy, and it also means an app
              that could overwrite them would undo the protection.
            </p>
            <p className="font-medium text-ink-800">Use Supabase instead:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open the project → <strong>Database</strong> → <strong>Backups</strong></li>
              <li>Pick the day you want and restore</li>
            </ol>
            <p className="text-xs text-ink-400">
              The JSON file here is your independent copy — useful for reading
              history, moving to a new project, or proving what the records said on
              a given date.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
