import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RotateCcw, UploadCloud, X, FileText, BarChart3, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Eye, Map as MapIcon, Layers, LogOut, Grid3x3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Input, Select } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useDebounce } from '../../hooks/useDebounce'
import { useAuth } from '../../contexts/AuthContext'
import {
  checkSabarlogNo, previewLotRange,
  listSabarlogs, addSabarlog, updateSabarlog, listLots, lotsOfSabarlog,
  listDhabarKaDil, addDhabarKaDil, updateDhabarKaDil,
  listLaBixiyay, addLaBixiyay, updateLaBixiyay,
  deleteSabarlogRecord, uploadScan, scanUrl, sabarlogSummary,
} from '../../services/sabarlogService'
import { friendlyError } from '../../utils/errors'
import { formatDate, formatFileSize } from '../../utils/format'
import { MAX_UPLOAD_BYTES, ALLOWED_DOCUMENT_TYPES } from '../../constants'

const TABS = [
  { key: 'register', label: 'Diiwaan geli Sabarlog' },
  { key: 'previous', label: 'Sabarlog Hore' },
  { key: 'dhabar', label: 'Dhabar-ka-dil' },
  { key: 'labixiyay', label: 'La-bixiyay' },
  { key: 'reports', label: 'Warbixin' },
]

const EMPTY_DEED = {
  sabarlog_no: '', company_owner: '',
  lot_structure: 'single', lot_from: '', lot_to: '',
  total_size: '', registered_date: '', registered_by_name: '',
}
const EMPTY_DHABAR = { lot_id: '', owner_wakiil: '', notary_ref: '', land_size: '', entry_date: '' }
const EMPTY_LABIX = { lot_id: '', taken_by: '', land_size: '', taken_date: '' }

const today = () => new Date().toISOString().slice(0, 10)

const rangeLabel = (r) =>
  r.lot_structure === 'range' && r.lot_to !== r.lot_from
    ? `${r.lot_from} – ${r.lot_to}`
    : r.lot_from

/**
 * Sabarlog — land deeds.
 *
 * A sabarlog is a BLOCK covering a range of lot numbers, and the system
 * creates one child lot per number. A buyer takes one lot of their own, so
 * the lot is chosen from a list rather than typed — which is also what makes
 * "one buyer per lot" possible to show before the clerk commits to it.
 */
export default function Sabarlog() {
  const [tab, setTab] = useState('register')
  const { role, profile } = useAuth()
  const isAdmin = role === 'admin'
  const queryClient = useQueryClient()

  const refreshAll = () => {
    for (const k of ['sabarlogs', 'sabarlog-lots', 'dhabar', 'labixiyay', 'sabarlog-summary']) {
      queryClient.invalidateQueries({ queryKey: [k] })
    }
  }

  // Deleting is Admin-only and reaches three tables, so one dialog serves all.
  const [pendingDelete, setPendingDelete] = useState(null)
  const del = useMutation({
    mutationFn: ({ kind, id }) => deleteSabarlogRecord(kind, id),
    onSuccess: () => { toast.success('Waa la tirtiray'); setPendingDelete(null); refreshAll() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  return (
    <>
      <PageHeader
        title="Sabarlog"
        description="Diiwaanka sabarlogyada dhulka, dhabar-ka-dilka iyo warqadaha la bixiyay."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Sabarlog' }]}
      />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-surface-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              'relative whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors',
              tab === t.key ? 'text-navy-700' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-navy-600" />
            )}
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <DeedTab isPrevious={false} isAdmin={isAdmin} profile={profile}
                 onChanged={refreshAll} onDelete={setPendingDelete} />
      )}
      {tab === 'previous' && (
        <DeedTab isPrevious isAdmin={isAdmin} profile={profile}
                 onChanged={refreshAll} onDelete={setPendingDelete} />
      )}
      {tab === 'dhabar' && (
        <DhabarTab isAdmin={isAdmin} onChanged={refreshAll} onDelete={setPendingDelete} />
      )}
      {tab === 'labixiyay' && (
        <LaBixiyayTab isAdmin={isAdmin} onChanged={refreshAll} onDelete={setPendingDelete} />
      )}
      {tab === 'reports' && <ReportsTab />}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Tirtir diiwaankan?"
        message={
          pendingDelete
            ? `${pendingDelete.label} — diiwaanku wuu qarsoomayaa, laakiin lama tirtirayo gebi ahaanba.`
            : ''
        }
        confirmLabel="Haa, tirtir"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </>
  )
}

/* ============================================================ shared bits */

function rowActions({ isAdmin, onEdit, onDelete, row, kind, label }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(row)}>Beddel</Button>
      {isAdmin && (
        <Button size="sm" variant="ghost" icon={Trash2}
                className="text-red-600 hover:bg-red-50"
                onClick={() => onDelete({ kind, id: row.id, label: label(row) })}>
          Tirtir
        </Button>
      )}
    </div>
  )
}

/**
 * The lot picker. Sold lots stay in the list, marked with the buyer's name —
 * the office wanted to see them rather than have them silently disappear.
 * `blockSold` decides whether picking one is actually refused: a sale is
 * blocked, but signing the paper out is not, since that is not a sale.
 */
function LotSelect({ value, onChange, error, blockSold, disabled, hint }) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 350)

  const lots = useQuery({
    queryKey: ['sabarlog-lots', debounced],
    queryFn: () => listLots({ search: debounced || undefined }),
    enabled: !disabled,
    keepPreviousData: true,
  })

  const chosen = (lots.data ?? []).find((l) => l.lot_id === value)

  return (
    <div className="space-y-2">
      {!disabled && (
        <Input
          label="Raadi lot"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="1207…"
          hint="Ku qor si aad u yarayso liiska"
        />
      )}
      <Select
        label="Lot Number"
        required
        placeholder={lots.isLoading ? 'Waa la soo raraya…' : 'Dooro lot…'}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
        hint={hint}
        options={(lots.data ?? []).map((l) => ({
          value: l.lot_id,
          label: `${l.lot_no} — ${l.sabarlog_no}${l.is_sold ? `  •  LA IIBIYAY (${l.buyer_name})` : ''}`,
        }))}
      />
      {chosen && (
        <p className={clsx(
          'flex items-start gap-1.5 text-xs font-medium',
          chosen.is_sold && blockSold ? 'text-red-600'
            : chosen.is_sold ? 'text-amber-700' : 'text-emerald-700',
        )}>
          {chosen.is_sold && blockSold
            ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>
            {chosen.company_owner} — {chosen.land_size || 'cabbir lama qorin'}
            {chosen.is_sold && (
              <> · <strong>{blockSold ? 'Lotkan horay ayaa loo iibiyay' : 'La iibiyay'}: {chosen.buyer_name}</strong></>
            )}
          </span>
        </p>
      )}
    </div>
  )
}

function ScanPicker({ file, setFile }) {
  const pick = (chosen) => {
    if (!chosen) return
    if (!ALLOWED_DOCUMENT_TYPES[chosen.type]) { toast.error('PDF ama Word oo keliya.'); return }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`Faylku waa ${formatFileSize(chosen.size)}. Xadku waa 10 MB.`); return
    }
    setFile(chosen)
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-sunken px-4 py-3">
        <FileText className="h-5 w-5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
          <p className="text-xs text-ink-400">{formatFileSize(file.size)}</p>
        </div>
        <button type="button" onClick={() => setFile(null)}
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Ka saar faylka">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-surface-border px-4 py-6 text-center transition-colors hover:border-navy-300 hover:bg-navy-50/40">
      <UploadCloud className="h-6 w-6 text-ink-400" />
      <span className="text-sm font-medium text-navy-700">Dooro fayl</span>
      <span className="text-xs text-ink-400">PDF ama Word, ilaa 10 MB</span>
      <input type="file" className="sr-only" accept=".pdf,.doc,.docx"
             onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  )
}

/** The lot numbers a saved deed produced. */
function LotsPanel({ sabarlogId }) {
  const lots = useQuery({
    queryKey: ['sabarlog-lots', 'of', sabarlogId],
    queryFn: () => lotsOfSabarlog(sabarlogId),
    enabled: !!sabarlogId,
  })
  if (!sabarlogId || !lots.data?.length) return null

  return (
    <div className="card mt-4 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Grid3x3 className="h-4 w-4 text-ink-400" />
        Lots-ka la sameeyay
        <Badge tone="navy">{lots.data.length}</Badge>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {lots.data.map((l) => (
          <span
            key={l.lot_id}
            title={l.is_sold ? `La iibiyay: ${l.buyer_name}` : 'Banaan'}
            className={clsx(
              'rounded-md px-2.5 py-1 text-xs font-medium tabular',
              l.is_sold
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
            )}
          >
            {l.lot_no}
          </span>
        ))}
      </div>
      <p className="mt-3 border-t border-surface-border pt-3 text-xs text-ink-400">
        <span className="mr-3">🟩 Banaan</span><span>🟧 La iibiyay</span>
      </p>
    </div>
  )
}

/* ================================================================= deeds */

function DeedTab({ isPrevious, isAdmin, profile, onChanged, onDelete }) {
  const [form, setForm] = useState(EMPTY_DEED)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  const table = useTableState({ defaultSort: { key: 'registered_date', dir: 'desc' } })
  const f = table.filters

  const list = useQuery({
    queryKey: ['sabarlogs', isPrevious, f, table.page, table.pageSize, table.sort],
    queryFn: () => listSabarlogs({ filters: f, range: table.range, sort: table.sort, isPrevious }),
    keepPreviousData: true,
  })

  const debouncedNo = useDebounce(form.sabarlog_no, 450)
  const noCheck = useQuery({
    queryKey: ['sabarlog-no', debouncedNo],
    queryFn: () => checkSabarlogNo(debouncedNo),
    enabled: !editing && debouncedNo.trim().length > 0,
  })
  const noState = editing ? null : noCheck.data?.state

  // Shows "this will create 11 lots" before anything is saved.
  const dFrom = useDebounce(form.lot_from, 450)
  const dTo = useDebounce(form.lot_to, 450)
  const preview = useQuery({
    queryKey: ['sabarlog-range', dFrom, dTo],
    queryFn: () => previewLotRange(dFrom, dTo),
    enabled: !editing && form.lot_structure === 'range'
             && dFrom.trim().length > 0 && dTo.trim().length > 0,
  })

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const reset = () => {
    setForm(EMPTY_DEED); setEditing(null); setErrors({}); setFile(null); setLastSaved(null)
  }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      sabarlog_no: row.sabarlog_no,
      company_owner: row.company_owner,
      lot_structure: row.lot_structure,
      lot_from: row.lot_from ?? '',
      lot_to: row.lot_to ?? '',
      total_size: row.total_size ?? '',
      registered_date: row.registered_date,
      registered_by_name: row.registered_by_name ?? '',
    })
    setErrors({}); setFile(null); setLastSaved(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const next = {}
    if (!editing) {
      if (!form.sabarlog_no.trim()) next.sabarlog_no = 'Geli lambarka sabarlogga.'
      else if (noState === 'duplicate') next.sabarlog_no = 'Lambarkan horay ayaa loo diiwaan geliyay.'
      if (!form.lot_from.trim()) next.lot_from = 'Geli lambarka lot-ka.'
      if (form.lot_structure === 'range') {
        if (!form.lot_to.trim()) next.lot_to = 'Geli lot-ka ugu dambeeya.'
        else if (preview.data?.state === 'error') next.lot_to = preview.data.message
        else if (preview.data?.state === 'clash') next.lot_to = 'Qaar ka mid ah lots-ka horay ayaa loo diiwaan geliyay.'
      }
    }
    if (!form.company_owner.trim()) next.company_owner = 'Geli shirkadda ama milkiilaha.'
    if (!form.registered_date) next.registered_date = 'Geli taariikhda.'
    else if (form.registered_date > today()) next.registered_date = 'Taariikhdu mustaqbalka ma noqon karto.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateSabarlog(editing.id, form)
      let scan = {}
      if (file) {
        setUploading(true)
        try {
          scan = await uploadScan(file, form.sabarlog_no)
        } catch (e) {
          // The typing matters more than the attachment.
          toast.error(`Diiwaanku wuu kaydsanayaa, laakiin faylku ma soo gelin: ${friendlyError(e)}`)
          scan = {}
        } finally { setUploading(false) }
      }
      return addSabarlog({ ...form, ...scan, is_previous: isPrevious })
    },
    onSuccess: (d) => {
      if (editing) toast.success('Waa la beddelay')
      else toast.success(`Waa la kaydiyay — ${d.sabarlog_no} (${d.total_lots} lot)`)
      const savedId = editing ? null : d.id
      reset()
      setLastSaved(savedId)
      onChanged()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (save.isPending || uploading) return
    if (!validate()) { toast.error('Fadlan sax meelaha cas.'); return }
    save.mutate()
  }

  const openScan = async (path) => {
    try { window.open(await scanUrl(path), '_blank', 'noopener') }
    catch (e) { toast.error(friendlyError(e)) }
  }

  const columns = useMemo(() => [
    { key: 'sabarlog_no', header: 'Sabarlog No.', sortable: true, className: 'tabular font-medium text-navy-700' },
    { key: 'company_owner', header: 'Shirkad / Milkiile' },
    { key: 'lot_range', header: 'Lot Range', className: 'tabular', render: rangeLabel },
    { key: 'total_lots', header: 'Total Lots', render: (r) => <Badge tone="emerald">{r.total_lots}</Badge> },
    { key: 'total_size', header: 'Cabirka (mid kasta)', render: (r) => r.total_size || '—' },
    { key: 'registered_date', header: 'Taariikh', sortable: true, render: (r) => formatDate(r.registered_date) },
    {
      key: 'scan', header: 'Scan',
      render: (r) => r.file_path
        ? <Button size="sm" variant="ghost" icon={Eye} onClick={() => openScan(r.file_path)}>Fiiri</Button>
        : <span className="text-xs text-ink-400">—</span>,
    },
    { key: 'registered_by_name', header: 'Diiwaan geliyay', render: (r) => r.registered_by_name || r.created_by_name || '—' },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => rowActions({
        isAdmin, onEdit: startEdit, onDelete, row: r,
        kind: 'sabarlog', label: (x) => `Sabarlog ${x.sabarlog_no}`,
      }),
    },
  ], [isAdmin])

  const isRange = form.lot_structure === 'range'

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form onSubmit={submit} className="lg:col-span-1">
        <div className="card p-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <MapIcon className="h-4 w-4 text-ink-400" />
            {editing ? 'Beddel Sabarlogga' : isPrevious ? 'Sabarlog Hore' : 'Diiwaan geli Sabarlog'}
          </h3>
          <p className="mb-5 text-[13px] text-ink-500">
            {isPrevious
              ? 'Sabarlogyadii hore ee jiray ka hor nidaamkan.'
              : 'Sabarlog cusub oo dhul ah.'}
          </p>

          <div className="space-y-4">
            <div>
              <Input
                label="Sabarlog No." required value={form.sabarlog_no}
                onChange={set('sabarlog_no')} error={errors.sabarlog_no}
                disabled={!!editing} placeholder="R-001/2026"
                hint={editing ? 'Lambarka lama beddeli karo.' : 'Sida ku qoran buugga.'}
              />
              {!editing && debouncedNo.trim().length > 0 && !noCheck.isFetching && (
                <>
                  {noState === 'free' && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Lambarkan waa banaan yahay.
                    </p>
                  )}
                  {noState === 'duplicate' && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Horay loo diiwaan geliyay (lot {noCheck.data.lot_no}).
                    </p>
                  )}
                </>
              )}
            </div>

            <Input label="Shirkad / Milkiile" required value={form.company_owner}
                   onChange={set('company_owner')} error={errors.company_owner} />

            {/* ---- lot structure ---- */}
            {editing ? (
              <Input label="Lots" value={rangeLabel(editing)} disabled
                     hint="Lots-ka lama beddeli karo — waxaa ku xiran iibiyayaal." />
            ) : (
              <div className="rounded-lg border border-surface-border p-4">
                <p className="label mb-2">Qaabka Lot-ka</p>
                <div className="flex gap-4">
                  {[['single', 'Hal Lot'], ['range', 'Lot Range / Block']].map(([v, lbl]) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
                      <input
                        type="radio" name="lot_structure" value={v}
                        checked={form.lot_structure === v}
                        onChange={() => setForm((p) => ({ ...p, lot_structure: v, lot_to: '' }))}
                        className="h-4 w-4 text-navy-700 focus:ring-navy-500"
                      />
                      {lbl}
                    </label>
                  ))}
                </div>

                <div className={clsx('mt-4 grid gap-3', isRange && 'sm:grid-cols-2')}>
                  <Input
                    label={isRange ? 'From Lot' : 'Lot Number'} required
                    value={form.lot_from} onChange={set('lot_from')}
                    error={errors.lot_from} placeholder="1207"
                  />
                  {isRange && (
                    <Input label="To Lot" required value={form.lot_to}
                           onChange={set('lot_to')} error={errors.lot_to} placeholder="1217" />
                  )}
                </div>

                {isRange && preview.data && !preview.isFetching && (
                  <div className={clsx(
                    'mt-3 rounded-lg border p-3 text-xs',
                    preview.data.state === 'ok'
                      ? 'border-navy-200 bg-navy-50/60 text-navy-800 dark:border-navy-900/40 dark:bg-navy-950/20 dark:text-navy-200'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
                  )}>
                    {preview.data.state === 'ok' && (
                      <>
                        Nidaamku wuxuu si toos ah u samayn doonaa dhammaan lots-ka
                        <strong> {form.lot_from}</strong> ilaa <strong>{form.lot_to}</strong>.
                        <div className="mt-1 font-semibold">Wadarta Lots: {preview.data.count}</div>
                      </>
                    )}
                    {preview.data.state === 'clash' && (
                      <>Lots-kan horay ayaa loo diiwaan geliyay: <strong>{(preview.data.taken || []).join(', ')}</strong></>
                    )}
                    {preview.data.state === 'error' && <>{preview.data.message}</>}
                  </div>
                )}
              </div>
            )}

            <Input label="Cabirka (mid kasta)" value={form.total_size} onChange={set('total_size')}
                   placeholder="7.50 X 20 M" hint="Cabirka HAL lot, ikhtiyaari" />
            <Input label="Taariikhda" required type="date" value={form.registered_date}
                   onChange={set('registered_date')} error={errors.registered_date} />
            <Input label="Diiwaan geliyay" value={form.registered_by_name}
                   onChange={set('registered_by_name')} hint="Ikhtiyaari" />

            {!editing && (
              <div>
                <p className="label mb-2">Scan <span className="font-normal text-ink-400">(ikhtiyaari)</span></p>
                <ScanPicker file={file} setFile={setFile} />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-4 text-sm">
            <span className="text-ink-500">Waxaa gelinaya</span>
            <span className="font-medium text-ink-800">{profile?.full_name}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="secondary" icon={RotateCcw} className="flex-1" onClick={reset}>
              {editing ? 'Jooji' : 'Nadiifi'}
            </Button>
            <Button type="submit" icon={Save} className="flex-1"
                    loading={save.isPending || uploading}
                    disabled={noState === 'duplicate'
                              || (!editing && isRange && preview.data?.state !== 'ok')}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>

        <LotsPanel sabarlogId={lastSaved} />
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input label="Raadi" placeholder="Sabarlog no, shirkad, lot…"
                 defaultValue={f.q ?? ''}
                 onChange={(e) => table.setFilter('q', e.target.value)} />
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
          emptyTitle="Weli waxba lama gelin"
          emptyDescription="Sabarlogyada waxay halkan ka muuqan doonaan marka la diiwaan geliyo."
          exportFileName={isPrevious ? 'sabarlog-hore' : 'sabarlog'}
          enablePrint
        />
      </div>
    </div>
  )
}

/* ========================================================= dhabar-ka-dil */

function DhabarTab({ isAdmin, onChanged, onDelete }) {
  const [form, setForm] = useState(EMPTY_DHABAR)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})

  const table = useTableState({ defaultSort: { key: 'entry_date', dir: 'desc' } })
  const f = table.filters

  const list = useQuery({
    queryKey: ['dhabar', f, table.page, table.pageSize, table.sort],
    queryFn: () => listDhabarKaDil({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }
  const reset = () => { setForm(EMPTY_DHABAR); setEditing(null); setErrors({}) }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      lot_id: row.lot_id ?? '',
      owner_wakiil: row.owner_wakiil,
      notary_ref: row.notary_ref ?? '',
      land_size: row.land_size ?? '',
      entry_date: row.entry_date,
    })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const next = {}
    if (!editing && !form.lot_id) next.lot_id = 'Dooro lot.'
    if (!form.owner_wakiil.trim()) next.owner_wakiil = 'Geli milkiilaha ama wakiilka.'
    if (!form.entry_date) next.entry_date = 'Geli taariikhda.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: () => (editing ? updateDhabarKaDil(editing.id, form) : addDhabarKaDil(form)),
    onSuccess: () => {
      toast.success(editing ? 'Waa la beddelay' : 'Waa la kaydiyay')
      reset(); onChanged()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (save.isPending) return
    if (!validate()) { toast.error('Fadlan sax meelaha cas.'); return }
    save.mutate()
  }

  const columns = useMemo(() => [
    { key: 'owner_wakiil', header: 'Milkiile / Wakiil' },
    { key: 'notary_ref', header: 'Reff Number', className: 'tabular', render: (r) => r.notary_ref || '—' },
    { key: 'lot_no', header: 'Lot Number', className: 'tabular' },
    { key: 'land_size', header: 'Cabirka Dhulka', render: (r) => r.land_size || '—' },
    { key: 'entry_date', header: 'Taariikhda', sortable: true, render: (r) => formatDate(r.entry_date) },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => rowActions({
        isAdmin, onEdit: startEdit, onDelete, row: r,
        kind: 'dhabar_ka_dil', label: (x) => `${x.owner_wakiil} (lot ${x.lot_no})`,
      }),
    },
  ], [isAdmin])

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form onSubmit={submit} className="lg:col-span-1">
        <div className="card p-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <Layers className="h-4 w-4 text-ink-400" />
            {editing ? 'Beddel Dhabar-ka-dil' : 'Dhabar-ka-dil'}
          </h3>
          <p className="mb-5 text-[13px] text-ink-500">
            Diiwaan geli cidda lot-ka ka iibsatay. Hal lot = hal qof.
          </p>

          <div className="space-y-4">
            {editing ? (
              <Input label="Lot Number" value={editing.lot_no} disabled
                     hint="Lot-ka lama beddeli karo." />
            ) : (
              <LotSelect value={form.lot_id} onChange={set('lot_id')}
                         error={errors.lot_id} blockSold />
            )}
            <Input label="Milkiile / Wakiil" required value={form.owner_wakiil}
                   onChange={set('owner_wakiil')} error={errors.owner_wakiil} />
            <Input label="Reff Number (Notary)" value={form.notary_ref}
                   onChange={set('notary_ref')} placeholder="NR132/4131/2026"
                   hint="Ikhtiyaari — lama hubiyo." />
            <Input label="Cabirka Dhulka" value={form.land_size} onChange={set('land_size')}
                   placeholder="7.50 X 20 M" hint="Ikhtiyaari" />
            <Input label="Taariikhda" required type="date" value={form.entry_date}
                   onChange={set('entry_date')} error={errors.entry_date} />
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="secondary" icon={RotateCcw} className="flex-1" onClick={reset}>
              {editing ? 'Jooji' : 'Nadiifi'}
            </Button>
            <Button type="submit" icon={Save} className="flex-1" loading={save.isPending}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input label="Raadi" placeholder="Lot, magac, reff number…"
                 defaultValue={f.q ?? ''}
                 onChange={(e) => table.setFilter('q', e.target.value)} />
        </div>
        <DataTable
          columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
          loading={list.isLoading} error={list.error} onRetry={list.refetch}
          page={table.page} pageSize={table.pageSize}
          onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
          sort={table.sort} onSortChange={table.setSort}
          emptyTitle="Weli waxba lama gelin"
          emptyDescription="Dhabar-ka-dilka wuxuu halkan ka muuqan doonaa."
          exportFileName="dhabar-ka-dil" enablePrint
        />
      </div>
    </div>
  )
}

/* ============================================================ la-bixiyay */

function LaBixiyayTab({ isAdmin, onChanged, onDelete }) {
  const [form, setForm] = useState(EMPTY_LABIX)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})

  const table = useTableState({ defaultSort: { key: 'taken_date', dir: 'desc' } })
  const f = table.filters

  const list = useQuery({
    queryKey: ['labixiyay', f, table.page, table.pageSize, table.sort],
    queryFn: () => listLaBixiyay({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }
  const reset = () => { setForm(EMPTY_LABIX); setEditing(null); setErrors({}) }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      lot_id: row.lot_id ?? '',
      taken_by: row.taken_by,
      land_size: row.land_size ?? '',
      taken_date: row.taken_date,
    })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const next = {}
    if (!editing && !form.lot_id) next.lot_id = 'Dooro lot.'
    if (!form.taken_by.trim()) next.taken_by = 'Geli qofka qaaday.'
    if (!form.taken_date) next.taken_date = 'Geli taariikhda.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: () => (editing ? updateLaBixiyay(editing.id, form) : addLaBixiyay(form)),
    onSuccess: () => {
      toast.success(editing ? 'Waa la beddelay' : 'Waa la kaydiyay')
      reset(); onChanged()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (save.isPending) return
    if (!validate()) { toast.error('Fadlan sax meelaha cas.'); return }
    save.mutate()
  }

  const columns = useMemo(() => [
    { key: 'taken_by', header: 'Qofka Qaaday' },
    { key: 'taken_date', header: 'Taariikhda La-qaaday', sortable: true, render: (r) => formatDate(r.taken_date) },
    { key: 'land_size', header: 'Cabirka Dhulka', render: (r) => r.land_size || '—' },
    { key: 'lot_no', header: 'Lot Number', className: 'tabular' },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => rowActions({
        isAdmin, onEdit: startEdit, onDelete, row: r,
        kind: 'la_bixiyay', label: (x) => `${x.taken_by} (lot ${x.lot_no})`,
      }),
    },
  ], [isAdmin])

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form onSubmit={submit} className="lg:col-span-1">
        <div className="card p-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <LogOut className="h-4 w-4 text-ink-400" />
            {editing ? 'Beddel La-bixiyay' : 'Sabarlog La-bixiyay'}
          </h3>
          <p className="mb-5 text-[13px] text-ink-500">
            Diiwaan geli marka sabarlogga laga bixiyo kaydka.
          </p>

          <div className="space-y-4">
            {editing ? (
              <Input label="Lot Number" value={editing.lot_no} disabled
                     hint="Lot-ka lama beddeli karo." />
            ) : (
              <LotSelect value={form.lot_id} onChange={set('lot_id')} error={errors.lot_id}
                         hint="Lot la iibiyay wuu bixi karaa — waa la ogol yahay." />
            )}
            <Input label="Qofka Qaaday (Owner/Wakiil)" required value={form.taken_by}
                   onChange={set('taken_by')} error={errors.taken_by} />
            <Input label="Taariikhda La-qaaday" required type="date" value={form.taken_date}
                   onChange={set('taken_date')} error={errors.taken_date} />
            <Input label="Cabirka Dhulka" value={form.land_size} onChange={set('land_size')}
                   placeholder="7.50 X 20 M" hint="Ikhtiyaari" />
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="secondary" icon={RotateCcw} className="flex-1" onClick={reset}>
              {editing ? 'Jooji' : 'Nadiifi'}
            </Button>
            <Button type="submit" icon={Save} className="flex-1" loading={save.isPending}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input label="Raadi" placeholder="Lot ama magac…"
                 defaultValue={f.q ?? ''}
                 onChange={(e) => table.setFilter('q', e.target.value)} />
        </div>
        <DataTable
          columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
          loading={list.isLoading} error={list.error} onRetry={list.refetch}
          page={table.page} pageSize={table.pageSize}
          onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
          sort={table.sort} onSortChange={table.setSort}
          emptyTitle="Weli waxba lama gelin"
          emptyDescription="Warqadaha la bixiyay waxay halkan ka muuqan doonaan."
          exportFileName="sabarlog-la-bixiyay" enablePrint
        />
      </div>
    </div>
  )
}

/* =============================================================== reports */

function ReportsTab() {
  const summary = useQuery({ queryKey: ['sabarlog-summary'], queryFn: sabarlogSummary })
  const s = summary.data

  const cards = [
    ['Sabarlog guud', s?.totalDeeds ?? 0, 'Dhammaan sabarlogyada'],
    ['Lots guud', s?.totalLots ?? 0, 'Dhammaan lots-ka la sameeyay'],
    ['La iibiyay', s?.soldLots ?? 0, 'Lots leh iibsade'],
    ['Banaan', s?.freeLots ?? 0, 'Lots aan weli la iibin'],
    ['La-bixiyay', s?.totalTaken ?? 0, 'Warqadaha la qaaday'],
    ['Sabarlog hore', s?.previous ?? 0, 'Kuwii hore ee la geliyay'],
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([title, value, hint]) => (
          <div key={title} className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <BarChart3 className="h-4 w-4 text-ink-400" /> {title}
            </h3>
            <p className="mt-3 text-4xl font-semibold tabular text-ink-900">{value}</p>
            <p className="mt-1 text-xs text-ink-400">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ['Sanad ahaan (sabarlog)', s?.byYear],
          ['Shirkad ahaan (lots)', s?.byCompany],
        ].map(([title, rows]) => (
          <div key={title} className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-ink-800">{title}</h3>
            {rows?.length ? (
              <ul className="space-y-2 text-sm">
                {rows.slice(0, 12).map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-ink-600">{label}</span>
                    <Badge tone="navy">{count}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">Weli waxba ma jiraan.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
