import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { financeSummary } from '../../services/financeLedgerService'
import { formatDate } from '../../utils/format'

const today = () => new Date().toISOString().slice(0, 10)

const BUCKET_LABEL = { cash: 'Cash', bank: 'Bank', mobile: 'Mobile Money' }
const BUCKET_COLOR = { cash: '#2563eb', bank: '#059669', mobile: '#f59e0b' }

/**
 * The signed daily sheet for the boss.
 *
 * Every figure comes from finance_summary so the page and the printout can
 * never disagree; nothing is re-added in the browser.
 */
export default function DailyReport() {
  const [day, setDay] = useState(today())
  const { profile } = useAuth()
  const { settings, money } = useOfficeSettings()

  const summary = useQuery({
    queryKey: ['finance-summary', day],
    queryFn: () => financeSummary(day),
  })
  const s = summary.data ?? {}

  const byType = s.by_type ?? []
  const income = byType.filter((t) => t.kind === 'income')
  const expense = byType.filter((t) => t.kind === 'expense')
  const methods = s.by_method ?? []
  const methodTotal = methods.reduce((n, m) => n + Number(m.amount), 0)

  return (
    <>
      {/* Controls never reach the paper. */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/finance">
          <Button variant="secondary" icon={ArrowLeft}>Back</Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                 wrapperClassName="mb-0" />
          <Button icon={Printer} onClick={() => window.print()}>Print Report</Button>
          <Button
            variant="secondary"
            icon={FileDown}
            onClick={() =>
              toast('Choose "Save as PDF" in the print window that opens.', { icon: '🖨️' })
                && window.print()
            }
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="card mx-auto max-w-4xl p-8 print:border-0 print:shadow-none">
        {/* ---------------- letterhead ---------------- */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-navy-800 pb-4">
          <div className="min-w-0">
            <h1 className="text-base font-bold uppercase text-navy-900">
              {settings?.office_name ?? 'Olad Law Office'}
            </h1>
            <p className="text-xs text-ink-500">Finance Management System</p>
            {settings?.address && (
              <p className="mt-1 whitespace-pre-line text-xs text-ink-500">{settings.address}</p>
            )}
          </div>
          {settings?.logo_url && (
            <img src={settings.logo_url} alt="" className="h-16 w-16 shrink-0 object-contain" />
          )}
          <div className="shrink-0 text-right text-xs text-ink-500">
            {settings?.phone && <p>Tel: {settings.phone}</p>}
            {settings?.email && <p>Email: {settings.email}</p>}
            {settings?.website && <p>Website: {settings.website}</p>}
          </div>
        </div>

        <div className="py-5 text-center">
          <h2 className="text-xl font-bold tracking-wide text-navy-800">DAILY FINANCE REPORT</h2>
          <p className="mt-1 text-sm text-ink-500">Date: {formatDate(day)}</p>
        </div>

        {/* ---------------- summary strip ---------------- */}
        <Section title="Summary" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Total Income', money(s.today_income ?? 0), 'text-emerald-700'],
            ['Total Expense', money(s.today_expense ?? 0), 'text-red-600'],
            ['Net Income', money(s.today_net ?? 0), 'text-blue-700'],
            ['Total Transactions', s.today_transactions ?? 0, 'text-ink-900'],
            ['Cash Balance', money(s.cash_balance ?? 0), 'text-violet-700'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-surface-border p-3 text-center">
              <p className="text-[11px] text-ink-500">{label}</p>
              <p className={`mt-1 text-sm font-bold tabular ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ---------------- the two tables ---------------- */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <SummaryTable
            title="Income Summary" head="Income Type" rows={income}
            total={s.today_income ?? 0} count={s.today_income_count ?? 0}
            money={money} tone="emerald"
          />
          <SummaryTable
            title="Expense Summary" head="Expense Type" rows={expense}
            total={s.today_expense ?? 0} count={s.today_expense_count ?? 0}
            money={money} tone="red"
          />
        </div>

        {/* ---------------- method breakdown + totals ---------------- */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <Section title="Payment Method Breakdown" />
            {methods.length ? (
              <div className="flex items-center gap-5">
                <Donut methods={methods} total={methodTotal} />
                <ul className="space-y-1.5 text-xs">
                  {methods.map((m) => (
                    <li key={m.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: BUCKET_COLOR[m.bucket] }} />
                      <span className="text-ink-600">{m.name}</span>
                      <span className="tabular font-medium text-ink-800">{money(m.amount)}</span>
                      <span className="text-ink-400">
                        ({methodTotal ? ((m.amount / methodTotal) * 100).toFixed(1) : '0.0'}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-ink-400">No income recorded on this day.</p>
            )}
          </div>

          <div>
            <Section title="Transaction Summary" />
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border text-ink-500">
                  <th className="py-1.5 text-left font-medium">Type</th>
                  <th className="py-1.5 text-right font-medium">Count</th>
                  <th className="py-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-border">
                  <td className="py-1.5 text-emerald-700">Income</td>
                  <td className="py-1.5 text-right tabular">{s.today_income_count ?? 0}</td>
                  <td className="py-1.5 text-right tabular text-emerald-700">{money(s.today_income ?? 0)}</td>
                </tr>
                <tr className="border-b border-surface-border">
                  <td className="py-1.5 text-red-600">Expense</td>
                  <td className="py-1.5 text-right tabular">{s.today_expense_count ?? 0}</td>
                  <td className="py-1.5 text-right tabular text-red-600">{money(s.today_expense ?? 0)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-1.5">Net</td>
                  <td className="py-1.5 text-right tabular">{s.today_transactions ?? 0}</td>
                  <td className="py-1.5 text-right tabular">{money(s.today_net ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- signatures ---------------- */}
        <div className="mt-10 grid gap-10 border-t border-surface-border pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-500">Prepared By</p>
            <div className="mt-8 border-t border-ink-400 pt-1">
              <p className="text-sm font-medium text-ink-800">{profile?.full_name}</p>
              <p className="text-xs text-ink-500">Finance Officer</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-ink-500">Approved By</p>
            <div className="mt-8 border-t border-ink-400 pt-1">
              <p className="text-xs text-ink-500">Date: {formatDate(day)}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title }) {
  return (
    <h3 className="mb-2 mt-4 border-b border-surface-border pb-1 text-xs font-bold uppercase tracking-wide text-navy-700">
      {title}
    </h3>
  )
}

function SummaryTable({ title, head, rows, total, count, money, tone }) {
  return (
    <div>
      <Section title={title} />
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-border text-ink-500">
            <th className="py-1.5 text-left font-medium">{head}</th>
            <th className="py-1.5 text-right font-medium">Count</th>
            <th className="py-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.name} className="border-b border-surface-border">
              <td className="py-1.5 text-ink-700">{r.name}</td>
              <td className="py-1.5 text-right tabular">{r.count}</td>
              <td className="py-1.5 text-right tabular">{money(r.amount)}</td>
            </tr>
          )) : (
            <tr><td colSpan={3} className="py-3 text-center text-ink-400">Nothing recorded.</td></tr>
          )}
          <tr className={tone === 'emerald'
            ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/20'
            : 'bg-red-50 font-semibold text-red-700 dark:bg-red-950/20'}>
            <td className="py-1.5 pl-1">{title.replace(' Summary', '')} Total</td>
            <td className="py-1.5 text-right tabular">{count}</td>
            <td className="py-1.5 pr-1 text-right tabular">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Drawn as SVG arcs rather than pulled from a chart library: it has to survive
 * being printed, where a canvas often comes out blank.
 */
function Donut({ methods, total }) {
  if (!total) return null
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
      {methods.map((m) => {
        const share = Number(m.amount) / total
        const dash = share * C
        const el = (
          <circle
            key={m.name}
            cx="50" cy="50" r={R}
            fill="none"
            stroke={BUCKET_COLOR[m.bucket] ?? '#94a3b8'}
            strokeWidth="16"
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}
