import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Save, RotateCcw, Plus, Minus, Search, Pencil, Trash2, Eye, FileText,
  Wallet, Landmark, Smartphone, TrendingUp, TrendingDown, X, UploadCloud,
  Settings2, FileBarChart, ReceiptText, FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import {
  financeSummary, listTransactions, addTransaction, updateTransaction,
  deleteTransaction, listTypes, listMethods, uploadAttachment, attachmentUrl,
} from '../../services/financeLedgerService'
import { issueReceipt } from '../../services/billingService'
import { friendlyError } from '../../utils/errors'
import { formatDate, formatFileSize } from '../../utils/format'
import { MAX_UPLOAD_BYTES } from '../../constants'

const today = () => new Date().toISOString().slice(0, 10)

const blank = () => ({
  txn_date: today(), type_id: '', amount: '', method_id: '',
  counterparty: '', notary_ref: '', description: '', handled_by: '',
})

// Written out in full because Tailwind scans source text: a class built as
// `bg-${tone}-50` is never emitted and the card renders with no colour.
const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30',
  red:     'bg-red-50 text-red-600 dark:bg-red-950/30',
  blue:    'bg-blue-50 text-blue-600 dark:bg-blue-950/30',
  orange:  'bg-orange-50 text-orange-600 dark:bg-orange-950/30',
  violet:  'bg-violet-50 text-violet-600 dark:bg-violet-950/30',
  teal:    'bg-teal-50 text-teal-600 dark:bg-teal-950/30',
  indigo:  'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30',
}

const RECEIPT_TYPES = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'application/pdf': '.pdf',
}

/**
 * The office's daily cash book.
 *
 * Every entry is typed by hand — the office chose that over drawing payments
 * across from the client workflow — and can be corrected afterwards, which is
 * safe only because each edit writes its old values into the append-only
 * activity log.
 */
export default function Ledger() {
  const { role, profile } = useAuth()
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const isAdmin = role === 'admin'

  const [day, setDay] = useState(today())
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const table = useTableState({ defaultSort: { key: 'txn_date', dir: 'desc' } })
  const f = table.filters

  const summary = useQuery({
    queryKey: ['finance-summary', day],
    queryFn: () => financeSummary(day),
  })

  const list = useQuery({
    queryKey: ['finance-txns', f, table.page, table.pageSize, table.sort],
    queryFn: () => listTransactions({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const types = useQuery({ queryKey: ['finance-types'], queryFn: () => listTypes() })
  const methods = useQuery({ queryKey: ['finance-methods'], queryFn: listMethods })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
    queryClient.invalidateQueries({ queryKey: ['finance-txns'] })
  }

  // A receipt can be raised from any income line that does not already have
  // one; the database refuses a second, so the client never gets two proofs
  // of the same money.
  const receipt = useMutation({
    mutationFn: (id) => issueReceipt(id),
    onSuccess: (d) => { toast.success(`Receipt ${d.receipt_no} issued`); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const del = useMutation({
    mutationFn: (id) => deleteTransaction(id),
    onSuccess: () => { toast.success('Deleted'); setPendingDelete(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const s = summary.data ?? {}
  const cards = [
    ['Total Income', s.total_income, 'All time income', TrendingUp, 'emerald'],
    ['Total Expense', s.total_expense, 'All time expense', TrendingDown, 'red'],
    ["Today's Income", s.today_income, formatDate(day), TrendingUp, 'blue'],
    ["Today's Expense", s.today_expense, formatDate(day), TrendingDown, 'orange'],
    ['Cash Balance', s.cash_balance, 'Current cash', Wallet, 'violet'],
    ['Bank Balance', s.bank_balance, 'Current bank', Landmark, 'teal'],
    ['Mobile Money', s.mobile_balance, 'Current mobile', Smartphone, 'indigo'],
  ]

  const openScan = async (path) => {
    try { window.open(await attachmentUrl(path), '_blank', 'noopener') }
    catch (e) { toast.error(friendlyError(e)) }
  }

  const columns = useMemo(() => [
    { key: 'txn_date', header: 'Date', sortable: true, render: (r) => formatDate(r.txn_date) },
    {
      key: 'kind', header: 'Type',
      render: (r) => (
        <Badge tone={r.kind === 'income' ? 'emerald' : 'red'} dot>
          {r.kind === 'income' ? 'Income' : 'Expense'}
        </Badge>
      ),
    },
    { key: 'description', header: 'Description', render: (r) => r.description || r.type_name },
    { key: 'notary_ref', header: 'Reference No.', className: 'tabular', render: (r) => r.notary_ref || '—' },
    { key: 'counterparty', header: 'Client / Payer', render: (r) => r.counterparty || '—' },
    {
      key: 'income', header: 'Income', align: 'right',
      render: (r) => r.kind === 'income'
        ? <span className="tabular font-medium text-emerald-700">{money(r.amount)}</span>
        : <span className="text-ink-300">—</span>,
    },
    {
      key: 'expense', header: 'Expense', align: 'right',
      render: (r) => r.kind === 'expense'
        ? <span className="tabular font-medium text-red-600">{money(r.amount)}</span>
        : <span className="text-ink-300">—</span>,
    },
    {
      key: 'method_name', header: 'Payment Method',
      render: (r) => (
        <Badge tone={{ cash: 'emerald', bank: 'blue', mobile: 'violet' }[r.method_bucket] ?? 'slate'}>
          {r.method_name}
        </Badge>
      ),
    },
    { key: 'handled_by', header: 'Received / Paid By', render: (r) => r.handled_by || r.created_by_name || '—' },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.file_path && (
            <Button size="sm" variant="ghost" icon={Eye} onClick={() => openScan(r.file_path)}>
              Receipt
            </Button>
          )}
          {r.kind === 'income' && (
            <Button size="sm" variant="ghost" icon={ReceiptText}
                    className="text-navy-700 hover:bg-navy-50"
                    loading={receipt.isPending && receipt.variables === r.id}
                    onClick={() => receipt.mutate(r.id)}>
              Receipt
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Pencil}
                  onClick={() => { setEditing(r); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon={Trash2}
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setPendingDelete(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ], [money, receipt])

  return (
    <>
      <PageHeader
        title="Finance"
        description="Money received and money paid out, with the running balance of cash, bank and mobile money."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Finance' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                   wrapperClassName="mb-0" />
            <Link to="/finance/invoices">
              <Button variant="secondary" icon={FileSpreadsheet}>Invoices</Button>
            </Link>
            <Link to="/finance/receipts">
              <Button variant="secondary" icon={ReceiptText}>Receipts</Button>
            </Link>
            <Link to="/finance/daily-report">
              <Button variant="secondary" icon={FileBarChart}>Daily Report</Button>
            </Link>
            {isAdmin && (
              <Link to="/finance/setup">
                <Button variant="secondary" icon={Settings2}>Setup</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* ---------------- balance cards ---------------- */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value, hint, Icon, tone]) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2">
              <span className={clsx('rounded-lg p-1.5', TONES[tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
            </div>
            <p className="mt-2 text-xl font-semibold tabular text-ink-900">
              {summary.isLoading ? '—' : money(value ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
          </div>
        ))}
      </div>

      {/* ---------------- forms ---------------- */}
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <EntryForm
          kind="income" editing={editing?.kind === 'income' ? editing : null}
          onDone={() => { setEditing(null); refresh() }}
          onCancelEdit={() => setEditing(null)}
          types={(types.data ?? []).filter((t) => t.kind === 'income' && t.is_active)}
          methods={(methods.data ?? []).filter((m) => m.is_active)}
          profile={profile}
        />
        <EntryForm
          kind="expense" editing={editing?.kind === 'expense' ? editing : null}
          onDone={() => { setEditing(null); refresh() }}
          onCancelEdit={() => setEditing(null)}
          types={(types.data ?? []).filter((t) => t.kind === 'expense' && t.is_active)}
          methods={(methods.data ?? []).filter((m) => m.is_active)}
          profile={profile}
        />
        <SearchPanel table={table} />
      </div>

      {/* ---------------- ledger ---------------- */}
      <DataTable
        columns={columns}
        rows={list.data?.rows ?? []}
        total={list.data?.total ?? 0}
        loading={list.isLoading}
        error={list.error}
        onRetry={list.refetch}
        page={table.page}
        pageSize={table.pageSize}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sort={table.sort}
        onSortChange={table.setSort}
        emptyTitle="Nothing recorded yet"
        emptyDescription="Income and expenses appear here as soon as they are saved."
        exportFileName="transactions-ledger"
        enablePrint
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `${pendingDelete.kind === 'income' ? 'Income' : 'Expense'} of ${money(pendingDelete.amount)} — ${pendingDelete.type_name}. It is hidden from the ledger but kept in the record.`
            : ''
        }
        confirmLabel="Yes, delete"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete.id)}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ form */

function EntryForm({ kind, editing, onDone, onCancelEdit, types, methods, profile }) {
  const isIncome = kind === 'income'
  const [form, setForm] = useState(blank())
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loadedId, setLoadedId] = useState(null)

  // Pull the row being edited into the form without an effect: rendering is
  // the only place that knows both the incoming row and the current draft.
  if (editing && editing.id !== loadedId) {
    setLoadedId(editing.id)
    setForm({
      txn_date: editing.txn_date,
      type_id: editing.type_id ?? '',
      amount: String(editing.amount),
      method_id: editing.method_id ?? '',
      counterparty: editing.counterparty ?? '',
      notary_ref: editing.notary_ref ?? '',
      description: editing.description ?? '',
      handled_by: editing.handled_by ?? '',
    })
    setErrors({})
    setFile(null)
  }
  if (!editing && loadedId) { setLoadedId(null); setForm(blank()); setErrors({}) }

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const reset = () => { setForm(blank()); setErrors({}); setFile(null); onCancelEdit() }

  const pick = (chosen) => {
    if (!chosen) return
    if (!RECEIPT_TYPES[chosen.type]) { toast.error('Only images or PDF can be attached.'); return }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${formatFileSize(chosen.size)}. The limit is 10 MB.`); return
    }
    setFile(chosen)
  }

  const validate = () => {
    const next = {}
    if (!form.txn_date) next.txn_date = 'Enter the date.'
    else if (form.txn_date > today()) next.txn_date = 'The date cannot be in the future.'
    if (!form.type_id) next.type_id = 'Choose a type.'
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter an amount above zero.'
    if (!form.method_id) next.method_id = 'Choose a payment method.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateTransaction(editing.id, form)
      let attach = {}
      if (file) {
        setUploading(true)
        try {
          attach = await uploadAttachment(file, kind)
        } catch (e) {
          // The entry matters more than the picture of the receipt.
          toast.error(`Saved, but the receipt did not upload: ${friendlyError(e)}`)
          attach = {}
        } finally { setUploading(false) }
      }
      return addTransaction(kind, { ...form, ...attach })
    },
    onSuccess: () => {
      toast.success(editing ? 'Entry updated' : isIncome ? 'Income saved' : 'Expense saved')
      setForm(blank()); setFile(null); setErrors({}); setLoadedId(null)
      onDone()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (save.isPending || uploading) return
    if (!validate()) { toast.error('Please fix the highlighted fields.'); return }
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <h3 className={clsx('mb-4 flex items-center gap-2 text-sm font-semibold',
        isIncome ? 'text-emerald-700' : 'text-red-600')}>
        {isIncome ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        {editing ? `Edit ${isIncome ? 'Income' : 'Expense'}` : isIncome ? 'Add Income' : 'Add Expense'}
      </h3>

      <div className="space-y-3">
        <Input label="Date" required type="date" value={form.txn_date}
               onChange={set('txn_date')} error={errors.txn_date} />
        <Select
          label={isIncome ? 'Income Type' : 'Expense Type'} required placeholder="Choose…"
          value={form.type_id} onChange={set('type_id')} error={errors.type_id}
          options={types.map((t) => ({ value: t.id, label: t.name }))}
        />
        <Input label="Amount (USD)" required type="number" step="0.01" min="0"
               value={form.amount} onChange={set('amount')} error={errors.amount} />
        <Select
          label="Payment Method" required placeholder="Choose…"
          value={form.method_id} onChange={set('method_id')} error={errors.method_id}
          options={methods.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Input label={isIncome ? 'Payer / Client' : 'Paid To'}
               value={form.counterparty} onChange={set('counterparty')} />
        {isIncome && (
          <Input label="Notary Reference No." value={form.notary_ref}
                 onChange={set('notary_ref')} placeholder="NR132/4131/2026"
                 hint="Optional — not checked" />
        )}
        <Textarea label="Description" rows={2} value={form.description}
                  onChange={set('description')} />
        <Input label={isIncome ? 'Received By' : 'Paid By'} value={form.handled_by}
               onChange={set('handled_by')} placeholder={profile?.full_name} hint="Optional" />

        {!editing && (
          <div>
            <p className="label mb-1.5">
              Attachment / Receipt <span className="font-normal text-ink-400">(optional)</span>
            </p>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-sunken px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-ink-700">{file.name}</span>
                <button type="button" onClick={() => setFile(null)}
                        className="rounded p-1 text-ink-400 hover:bg-ink-100"
                        aria-label="Remove attachment">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-border px-3 py-3 text-xs text-ink-500 hover:border-navy-300">
                <UploadCloud className="h-4 w-4" /> Choose file
                <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.webp,.pdf"
                       onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {editing && (
          <Button type="button" variant="secondary" icon={RotateCcw} className="flex-1" onClick={reset}>
            Cancel
          </Button>
        )}
        <Button type="submit" icon={Save} className="flex-1"
                variant={isIncome ? 'success' : 'danger'}
                loading={save.isPending || uploading}>
          {editing ? 'Save changes' : isIncome ? 'Save Income' : 'Save Expense'}
        </Button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- search */

function SearchPanel({ table }) {
  const [draft, setDraft] = useState({ from: '', to: '', kind: '', ref: '', who: '' })
  const set = (k) => (e) => setDraft((p) => ({ ...p, [k]: e.target.value }))

  const apply = (e) => {
    e.preventDefault()
    for (const key of ['from', 'to', 'kind', 'ref', 'who']) {
      table.setFilter(key, draft[key] || undefined)
    }
  }

  return (
    <form onSubmit={apply} className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-700">
        <Search className="h-4 w-4" /> Search Transaction
      </h3>
      <div className="space-y-3">
        <Input label="From Date" type="date" value={draft.from} onChange={set('from')} />
        <Input label="To Date" type="date" value={draft.to} onChange={set('to')} />
        <Select label="Type" placeholder="All" value={draft.kind} onChange={set('kind')}
                options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
        <Input label="Reference No." value={draft.ref} onChange={set('ref')}
               placeholder="Enter reference number" />
        <Input label="Client / Payer" value={draft.who} onChange={set('who')}
               placeholder="Enter client or payer" />
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="secondary" className="flex-1"
                onClick={() => { setDraft({ from: '', to: '', kind: '', ref: '', who: '' }); table.clearFilters?.() }}>
          Clear
        </Button>
        <Button type="submit" icon={Search} className="flex-1">Search</Button>
      </div>
    </form>
  )
}
