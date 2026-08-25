import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RotateCcw, UploadCloud, X, FileText, BarChart3, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Eye, Map as MapIcon, Layers, LogOut,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useDebounce } from '../../hooks/useDebounce'
import { useAuth } from '../../contexts/AuthContext'
import {
  checkSabarlogNo, checkLot,
  listSabarlogs, addSabarlog, updateSabarlog,
  listDhabarKaDil, addDhabarKaDil, updateDhabarKaDil,
  listLaBixiyay, addLaBixiyay, updateLaBixiyay,
  deleteSabarlogRecord, uploadScan, scanUrl,
  sabarlogSummary,
} from '../../services/sabarlogService'
import { friendlyError } from '../../utils/errors'
import { formatDate, formatFileSize } from '../../utils/format'
import { MAX_UPLOAD_BYTES, ALLOWED_DOCUMENT_TYPES } from '../../constants'

const TABS = [
  { key: 'register', label: 'Diiwaan geli Sabarlog', en: 'Register Sabarlog' },
  { key: 'previous', label: 'Sabarlog Hore', en: 'Previous Sabarlog' },
  { key: 'dhabar', label: 'Dhabar-ka-dil', en: 'Dhabar-ka-dil' },
  { key: 'labixiyay', label: 'La-bixiyay', en: 'La-bixiyay' },
  { key: 'reports', label: 'Warbixin', en: 'Reports' },
]

const EMPTY_DEED = {
  sabarlog_no: '', company_owner: '', lot_no: '',
  total_size: '', registered_date: '', registered_by_name: '',
}
const EMPTY_DHABAR = { lot_no: '', owner_wakiil: '', notary_ref: '', land_size: '', entry_date: '' }
const EMPTY_LABIX = { lot_no: '', taken_by: '', land_size: '', taken_date: '' }

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Sabarlog — land deeds.
 *
 * A deed covers one lot and is subdivided and sold to many buyers; each sale
 * is endorsed on the back (dhabar-ka-dil). The paper itself is signed out of
 * the archive from time to time (la-bixiyay). Both of those attach to a deed
 * by lot number, so the lot box checks itself as it is typed and refuses a
 * lot that has no deed — the office's own rule.
 */
export default function Sabarlog() {
  const [tab, setTab] = useState('register')
  const { role, profile } = useAuth()
  const isAdmin = role === 'admin'
  const queryClient = useQueryClient()

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sabarlogs'] })
    queryClient.invalidateQueries({ queryKey: ['dhabar'] })
    queryClient.invalidateQueries({ queryKey: ['labixiyay'] })
    queryClient.invalidateQueries({ queryKey: ['sabarlog-summary'] })
    queryClient.invalidateQueries({ queryKey: ['sabarlog-years'] })
  }

  // Deleting is Admin-only and reaches three different tables, so one dialog
  // serves all of them rather than three near-identical copies.
  const [pendingDelete, setPendingDelete] = useState(null)
  const del = useMutation({
    mutationFn: ({ kind, id }) => deleteSabarlogRecord(kind, id),
    onSuccess: () => {
      toast.success('Waa la tirtiray')
      setPendingDelete(null)
      refreshAll()
    },
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
            ? `${pendingDelete.label} — diiwaanku wuu qarsoomayaa, lakiin lama tirtirayo gebi ahaanba. Waxaa arki kara Maamulaha oo keliya.`
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

/**
 * One place that answers "is there a deed for this lot?".
 *
 * Both the green/red message and the Save button need the answer, so it is
 * resolved once here. Keeping the debounced value in the query key AND in the
 * fetch matters: keying on the debounced text while fetching the live text
 * would look up whatever had been typed by the time the timer fired.
 */
function useLotCheck(lotNo, enabled = true) {
  const debounced = useDebounce(lotNo, 450)
  const query = useQuery({
    queryKey: ['sabarlog-lot', debounced],
    queryFn: () => checkLot(debounced),
    enabled: enabled && debounced.trim().length > 0,
  })
  return { ...query, debounced }
}

function LotBox({ value, onChange, error, hint, check }) {
  const { debounced } = check
  const state = check.data?.state

  return (
    <div>
      <Input
        label="Lot Number"
        required
        value={value}
        onChange={onChange}
        error={error}
        placeholder="2666 K"
        hint={hint}
      />
      {debounced.trim().length > 0 && !check.isFetching && (
        <>
          {state === 'found' && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {check.data.company_owner} — {check.data.total_size || 'cabbir lama qorin'}
                <span className="text-emerald-600/70"> ({check.data.sabarlog_no})</span>
              </span>
            </p>
          )}
          {state === 'missing' && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Sabarlog lotkan ma laha. Marka hore diiwaan geli sabarlogga.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Shared row actions. Edit is open to the officer; delete is Admin-only. */
function rowActions({ isAdmin, onEdit, onDelete, row, label }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(row)}>
        Beddel
      </Button>
      {isAdmin && (
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          className="text-red-600 hover:bg-red-50"
          onClick={() => onDelete({ kind: label.kind, id: row.id, label: label.text(row) })}
        >
          Tirtir
        </Button>
      )}
    </div>
  )
}

function ScanPicker({ file, setFile }) {
  const pick = (chosen) => {
    if (!chosen) return
    if (!ALLOWED_DOCUMENT_TYPES[chosen.type]) {
      toast.error('PDF ama Word oo keliya.')
      return
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`Faylku waa ${formatFileSize(chosen.size)}. Xadku waa 10 MB.`)
      return
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
        <button
          type="button"
          onClick={() => setFile(null)}
          className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Ka saar faylka"
        >
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
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </label>
  )
}

/* ================================================================= deeds */

function DeedTab({ isPrevious, isAdmin, profile, onChanged, onDelete }) {
  const [form, setForm] = useState(EMPTY_DEED)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

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

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const reset = () => {
    setForm(EMPTY_DEED); setEditing(null); setErrors({}); setFile(null)
  }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      sabarlog_no: row.sabarlog_no,
      company_owner: row.company_owner,
      lot_no: row.lot_no,
      total_size: row.total_size ?? '',
      registered_date: row.registered_date,
      registered_by_name: row.registered_by_name ?? '',
    })
    setErrors({}); setFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const next = {}
    if (!form.sabarlog_no.trim()) next.sabarlog_no = 'Geli lambarka sabarlogga.'
    else if (noState === 'duplicate') next.sabarlog_no = 'Lambarkan horay ayaa loo diiwaan geliyay.'
    if (!form.company_owner.trim()) next.company_owner = 'Geli shirkadda ama milkiilaha.'
    if (!form.lot_no.trim()) next.lot_no = 'Geli lambarka lot-ka.'
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
          // The typing matters more than the attachment — save the record and
          // say the scan failed rather than losing a filled-in form.
          toast.error(`Diiwaanku wuu kaydsanayaa, laakiin faylku ma soo gelin: ${friendlyError(e)}`)
          scan = {}
        } finally {
          setUploading(false)
        }
      }
      return addSabarlog({ ...form, ...scan, is_previous: isPrevious })
    },
    onSuccess: (d) => {
      toast.success(editing ? 'Waa la beddelay' : `Waa la kaydiyay — ${d.sabarlog_no}`)
      reset()
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
    { key: 'lot_no', header: 'Lot No.', className: 'tabular' },
    { key: 'total_size', header: 'Cabirka', render: (r) => r.total_size || '—' },
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
        label: { kind: 'sabarlog', text: (x) => `Sabarlog ${x.sabarlog_no}` },
      }),
    },
  ], [isAdmin])

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
                label="Sabarlog No."
                required
                value={form.sabarlog_no}
                onChange={set('sabarlog_no')}
                error={errors.sabarlog_no}
                disabled={!!editing}
                placeholder="R-010090126"
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
            <Input label="Lot No." required value={form.lot_no} onChange={set('lot_no')}
                   error={errors.lot_no} placeholder="2666 K" />
            <Input label="Cabirka guud" value={form.total_size} onChange={set('total_size')}
                   placeholder="7.50 X 20 M" hint="Ikhtiyaari" />
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
                    disabled={noState === 'duplicate'}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input
            label="Raadi"
            placeholder="Lot, sabarlog no, shirkad…"
            defaultValue={f.q ?? ''}
            onChange={(e) => table.setFilter('q', e.target.value)}
          />
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

  const lotCheck = useLotCheck(form.lot_no, !editing)

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }
  const reset = () => { setForm(EMPTY_DHABAR); setEditing(null); setErrors({}) }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      lot_no: row.lot_no,
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
    if (!form.lot_no.trim()) next.lot_no = 'Geli lambarka lot-ka.'
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
        label: { kind: 'dhabar_ka_dil', text: (x) => `${x.owner_wakiil} (lot ${x.lot_no})` },
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
            Diiwaan geli cidda qaybta ka iibsatay sabarlogga.
          </p>

          <div className="space-y-4">
            {editing ? (
              <Input label="Lot Number" value={form.lot_no} disabled
                     hint="Lot-ka lama beddeli karo." />
            ) : (
              <LotBox
                value={form.lot_no}
                onChange={set('lot_no')}
                error={errors.lot_no}
                hint="Sabarlogga waa inuu horay u jiraa."
                check={lotCheck}
              />
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
            <Button type="submit" icon={Save} className="flex-1" loading={save.isPending}
                    disabled={!editing && lotCheck.data?.state === 'missing'}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input
            label="Raadi"
            placeholder="Lot, magac, reff number…"
            defaultValue={f.q ?? ''}
            onChange={(e) => table.setFilter('q', e.target.value)}
          />
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
          emptyDescription="Dhabar-ka-dilka wuxuu halkan ka muuqan doonaa."
          exportFileName="dhabar-ka-dil"
          enablePrint
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

  const lotCheck = useLotCheck(form.lot_no, !editing)

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }
  const reset = () => { setForm(EMPTY_LABIX); setEditing(null); setErrors({}) }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      lot_no: row.lot_no,
      taken_by: row.taken_by,
      land_size: row.land_size ?? '',
      taken_date: row.taken_date,
    })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const next = {}
    if (!form.lot_no.trim()) next.lot_no = 'Geli lambarka lot-ka.'
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
        label: { kind: 'la_bixiyay', text: (x) => `${x.taken_by} (lot ${x.lot_no})` },
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
              <Input label="Lot Number" value={form.lot_no} disabled
                     hint="Lot-ka lama beddeli karo." />
            ) : (
              <LotBox
                value={form.lot_no}
                onChange={set('lot_no')}
                error={errors.lot_no}
                hint="Sabarlogga waa inuu horay u jiraa."
                check={lotCheck}
              />
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
            <Button type="submit" icon={Save} className="flex-1" loading={save.isPending}
                    disabled={!editing && lotCheck.data?.state === 'missing'}>
              {editing ? 'Kaydi beddelka' : 'Kaydi'}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-2">
        <div className="mb-4 card p-4">
          <Input
            label="Raadi"
            placeholder="Lot ama magac…"
            defaultValue={f.q ?? ''}
            onChange={(e) => table.setFilter('q', e.target.value)}
          />
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
          emptyDescription="Warqadaha la bixiyay waxay halkan ka muuqan doonaan."
          exportFileName="sabarlog-la-bixiyay"
          enablePrint
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
    ['Dhabar-ka-dil', s?.totalSales ?? 0, 'Qaybaha la iibiyay'],
    ['La-bixiyay', s?.totalTaken ?? 0, 'Warqadaha la qaaday'],
    ['Sabarlog hore', s?.previous ?? 0, 'Kuwii hore ee la geliyay'],
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-5 lg:grid-cols-3">
        {[
          ['Sanad ahaan', s?.byYear],
          ['Shirkad ahaan', s?.byCompany],
          ['Lot-yada ugu badan qaybsanaanta', s?.byLot],
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
