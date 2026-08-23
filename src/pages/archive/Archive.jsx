import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RotateCcw, Info, UploadCloud, X, FileText, Search, BarChart3,
  CheckCircle2, AlertTriangle, Eye, Archive as ArchiveIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useDebounce } from '../../hooks/useDebounce'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { listActiveServices } from '../../services/serviceService'
import {
  checkReference, listArchived, addArchivedDocument, uploadScan, scanUrl,
  archiveSummary, archivedYears,
} from '../../services/archiveService'
import { friendlyError } from '../../utils/errors'
import { formatDate, formatDateTime, formatFileSize } from '../../utils/format'
import { qk, LONG_CACHE } from '../../lib/queryClient'
import { ARCHIVE_DOCUMENT_TYPES, ARCHIVE_STATUSES, MAX_UPLOAD_BYTES, ALLOWED_DOCUMENT_TYPES } from '../../constants'

const ARCHIVE_STATUS_LABELS = Object.fromEntries(ARCHIVE_STATUSES.map((s) => [s.value, s.label]))

const TABS = ['Add Previous Document', 'All Archived Documents', 'Archive Reports']

const EMPTY = {
  reference_no: '',
  client_name: '',
  client_phone: '',
  document_type: '',
  service_name: '',
  document_date: '',
  ministry_reg_no: '',
  status: 'completed',
  amount: '',
  notes: '',
}

/**
 * Documents the office notarised on paper before this system existed.
 *
 * The reference is TYPED, never generated: these documents already carry the
 * number written on the paper, and drawing from the live counter here would
 * hand a new client a number that is already spoken for.
 */
export default function Archive() {
  const [tab, setTab] = useState(TABS[0])
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { profile } = useAuth()
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const table = useTableState({ defaultSort: { key: 'created_at', dir: 'desc' } })
  const f = table.filters

  const services = useQuery({
    queryKey: qk.services('active'),
    queryFn: listActiveServices,
    ...LONG_CACHE,
  })

  const years = useQuery({ queryKey: ['archive-years'], queryFn: archivedYears })

  const list = useQuery({
    queryKey: ['archived', f, table.page, table.pageSize, table.sort],
    queryFn: () => listArchived({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const summary = useQuery({
    queryKey: ['archive-summary'],
    queryFn: archiveSummary,
    enabled: tab === 'Archive Reports',
  })

  // ---------- live duplicate check ----------
  const debouncedRef = useDebounce(form.reference_no, 450)
  const refCheck = useQuery({
    queryKey: ['archive-ref-check', debouncedRef],
    queryFn: () => checkReference(debouncedRef),
    enabled: debouncedRef.trim().length > 3,
  })
  const refState = refCheck.data?.state

  const set = (k) => (e) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }))
    setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const pickFile = (chosen) => {
    if (!chosen) return
    if (!ALLOWED_DOCUMENT_TYPES[chosen.type]) {
      toast.error('Only PDF and Word files can be attached.')
      return
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${formatFileSize(chosen.size)}. The limit is 10 MB.`)
      return
    }
    setFile(chosen)
  }

  const validate = () => {
    const next = {}
    if (!form.reference_no.trim()) next.reference_no = 'Enter the reference written on the document.'
    else if (refState === 'duplicate') next.reference_no = 'This reference is already in the archive.'
    if (!form.client_name.trim()) next.client_name = 'Enter the client name.'
    if (!form.document_type) next.document_type = 'Choose the document type.'
    if (!form.service_name) next.service_name = 'Choose the service.'
    if (!form.document_date) next.document_date = 'Enter the date on the document.'
    else if (form.document_date > new Date().toISOString().slice(0, 10)) {
      next.document_date = 'A previous document cannot be dated in the future.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: async () => {
      let scan = {}
      if (file) {
        setUploading(true)
        try {
          scan = await uploadScan(file, form.reference_no)
        } catch (e) {
          // The typing matters more than the attachment. Save the record and
          // say the scan failed, rather than losing ten filled-in fields.
          toast.error(`The record will be saved, but the scan did not upload: ${friendlyError(e)}`)
          scan = {}
        } finally {
          setUploading(false)
        }
      }
      return addArchivedDocument({ ...form, ...scan })
    },
    onSuccess: (data) => {
      toast.success(`Archived — ${data.reference_no}`)
      setForm(EMPTY)
      setFile(null)
      setErrors({})
      queryClient.invalidateQueries({ queryKey: ['archived'] })
      queryClient.invalidateQueries({ queryKey: ['archive-summary'] })
      queryClient.invalidateQueries({ queryKey: ['archive-years'] })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (save.isPending || uploading) return
    if (!validate()) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    save.mutate()
  }

  const openScan = async (path) => {
    try {
      window.open(await scanUrl(path), '_blank', 'noopener')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const columns = useMemo(
    () => [
      { key: 'reference_no', header: 'Olad Ref (NR)', sortable: true, className: 'tabular font-medium text-navy-700' },
      { key: 'client_name', header: 'Client' },
      { key: 'document_type', header: 'Document Type' },
      { key: 'service_name', header: 'Service' },
      { key: 'document_date', header: 'Doc Date', sortable: true, render: (r) => formatDate(r.document_date) },
      { key: 'ministry_reg_no', header: 'Ministry Reg. No.', render: (r) => r.ministry_reg_no || '—' },
      {
        key: 'status',
        header: 'Status',
        render: (r) => (
          <Badge tone={r.status === 'completed' ? 'emerald' : 'amber'} dot>
            {ARCHIVE_STATUS_LABELS[r.status] ?? r.status}
          </Badge>
        ),
      },
      { key: 'created_at', header: 'Date Added', sortable: true, render: (r) => formatDate(r.created_at) },
      { key: 'added_by_name', header: 'Added By', render: (r) => r.added_by_name || '—' },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (r) =>
          r.file_path ? (
            <Button size="sm" variant="ghost" icon={Eye} onClick={() => openScan(r.file_path)}>
              Scan
            </Button>
          ) : (
            <span className="text-xs text-ink-400">No scan</span>
          ),
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title="Archive"
        description="Add previously registered documents using the reference number already written on them."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Archive' }]}
      />

      {/* ---------- tabs ---------- */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-surface-border">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={clsx(
              'relative whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors',
              tab === name ? 'text-navy-700' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {name}
            {tab === name && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-navy-600" />
            )}
          </button>
        ))}
      </div>

      {/* ================= add ================= */}
      {tab === TABS[0] && (
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="card p-6">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
                <ArchiveIcon className="h-4 w-4 text-ink-400" /> Add Previous Document
              </h3>
              <p className="mb-5 text-[13px] text-ink-500">
                For documents registered on paper before this system. Use the existing
                reference — a new one is never created here.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Olad Reference Number (NR)"
                    required
                    value={form.reference_no}
                    onChange={set('reference_no')}
                    error={errors.reference_no}
                    placeholder="NR132/4564/ON/2026"
                    hint="Type the number written on the document. Do not create a new one."
                  />
                  {/* live feedback while typing */}
                  {debouncedRef.trim().length > 3 && !refCheck.isFetching && (
                    <>
                      {refState === 'free' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> This reference is free.
                        </p>
                      )}
                      {refState === 'duplicate' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Already archived as {refCheck.data.reference}.
                        </p>
                      )}
                      {refState === 'live' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {refCheck.data.reference} is a live registration in this system.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <Input
                  label="Client Name"
                  required
                  value={form.client_name}
                  onChange={set('client_name')}
                  error={errors.client_name}
                />
                <Input label="Client Phone" value={form.client_phone} onChange={set('client_phone')} hint="Optional" />

                <Select
                  label="Document Type"
                  required
                  placeholder="Choose…"
                  value={form.document_type}
                  onChange={set('document_type')}
                  error={errors.document_type}
                  options={ARCHIVE_DOCUMENT_TYPES}
                />
                <Input
                  label="Document Date"
                  required
                  type="date"
                  value={form.document_date}
                  onChange={set('document_date')}
                  error={errors.document_date}
                  hint="The date on the paper"
                />

                <Select
                  label="Service"
                  required
                  placeholder="Choose…"
                  value={form.service_name}
                  onChange={set('service_name')}
                  error={errors.service_name}
                >
                  {[...new Map((services.data ?? []).map((s) => [s.category, true])).keys()].map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {(services.data ?? [])
                        .filter((s) => s.category === cat)
                        .map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
                <Input label="Ministry Registration No." value={form.ministry_reg_no} onChange={set('ministry_reg_no')} hint="Optional" />

                <Select
                  label="Status"
                  required
                  value={form.status}
                  onChange={set('status')}
                  options={ARCHIVE_STATUSES}
                />
                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={set('amount')}
                  hint="Optional — what was charged at the time"
                />

                <Textarea
                  label="Description / Notes"
                  value={form.notes}
                  onChange={set('notes')}
                  rows={3}
                  hint="Optional"
                  wrapperClassName="sm:col-span-2"
                />
              </div>
            </div>

            {/* ---------- scan ---------- */}
            <div className="card p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
                <UploadCloud className="h-4 w-4 text-ink-400" /> Scanned Document
                <span className="font-normal text-ink-400">(optional)</span>
              </h3>

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-sunken px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
                    <p className="text-xs text-ink-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-surface-border px-4 py-8 text-center transition-colors hover:border-navy-300 hover:bg-navy-50/40">
                  <UploadCloud className="h-7 w-7 text-ink-400" />
                  <span className="text-sm font-medium text-navy-700">Choose a file</span>
                  <span className="text-xs text-ink-400">PDF or Word, up to 10 MB</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {/* ---------- guidance ---------- */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                <Info className="h-4 w-4" /> Important
              </h3>
              <ul className="space-y-2 text-[13px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
                {[
                  'Use the existing reference number only.',
                  'Do not create a new reference number.',
                  'If the reference already exists, the form will stop you.',
                  'Archived documents are searchable and included in reports.',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-800">Reference number</h3>
              <p className="text-center font-mono text-sm tabular text-navy-700">
                NR132<span className="text-ink-300">/</span>4564
                <span className="text-ink-300">/</span>ON<span className="text-ink-300">/</span>2026
              </p>
              <dl className="mt-3 space-y-1.5 text-xs text-ink-500">
                {[
                  ['NR132', 'Office code'],
                  ['4564', 'Sequential number'],
                  ['ON', 'Office name'],
                  ['2026', 'Year'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="font-mono text-ink-700">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-surface-border pt-3 text-xs leading-relaxed text-ink-400">
                Searching works with or without the <strong>ON</strong> part, and with
                or without leading zeros.
              </p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Adding as</span>
                <span className="font-medium text-ink-800">{profile?.full_name}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  icon={RotateCcw}
                  className="flex-1"
                  onClick={() => {
                    setForm(EMPTY)
                    setFile(null)
                    setErrors({})
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  icon={Save}
                  className="flex-1"
                  loading={save.isPending || uploading}
                  disabled={refState === 'duplicate'}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ================= list ================= */}
      {tab === TABS[1] && (
        <>
          <div className="mb-5 card p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Search"
                placeholder="Reference, client, type…"
                defaultValue={f.q ?? ''}
                onChange={(e) => table.setFilter('q', e.target.value)}
              />
              <Select
                label="Document type"
                placeholder="All types"
                value={f.type ?? ''}
                onChange={(e) => table.setFilter('type', e.target.value)}
                options={ARCHIVE_DOCUMENT_TYPES}
              />
              <Select
                label="Status"
                placeholder="All statuses"
                value={f.status ?? ''}
                onChange={(e) => table.setFilter('status', e.target.value)}
                options={ARCHIVE_STATUSES}
              />
              <Select
                label="Year"
                placeholder="All years"
                value={f.year ?? ''}
                onChange={(e) => table.setFilter('year', e.target.value)}
                options={(years.data ?? []).map((y) => ({ value: y, label: y }))}
              />
            </div>
          </div>

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
            emptyTitle="Nothing archived yet"
            emptyDescription="Previously registered documents will appear here once they are added."
            exportFileName="archived-documents"
            enablePrint
          />
        </>
      )}

      {/* ================= reports ================= */}
      {tab === TABS[2] && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card p-6">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
              <BarChart3 className="h-4 w-4 text-ink-400" /> Total archived
            </h3>
            <p className="mt-3 text-4xl font-semibold tabular text-ink-900">
              {summary.data?.total ?? 0}
            </p>
            <p className="mt-1 text-xs text-ink-400">Previously registered documents</p>
          </div>

          {[
            ['By year', summary.data?.byYear],
            ['By document type', summary.data?.byType],
            ['By service', summary.data?.byService],
          ].map(([title, rows]) => (
            <div key={title} className="card p-6">
              <h3 className="mb-4 text-sm font-semibold text-ink-800">{title}</h3>
              {rows?.length ? (
                <ul className="space-y-2 text-sm">
                  {rows.map(([label, count]) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-600">{label}</span>
                      <span className="tabular font-medium text-ink-800">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-400">Nothing yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
