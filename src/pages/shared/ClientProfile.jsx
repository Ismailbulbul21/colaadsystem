import { useState, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgePercent, Upload, CheckCircle2, Wallet, Printer, Download, FileText, Clock, UserRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Each section card gets its own accent so the two parties are told apart at
// a glance, as in the office's design.
const SECTION_TONES = [
  { text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500' },
  { text: 'text-green-700 dark:text-green-300', border: 'border-green-600' },
  { text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500' },
  { text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500' },
]
const SectionIcon = UserRound

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import { Input, Textarea, Select, ReadOnlyMoney } from '../../components/ui/Field'
import { FormSkeleton } from '../../components/feedback/Skeleton'
import { ErrorState, EmptyState } from '../../components/feedback/States'
import ReceiptModal from '../../components/print/ReceiptModal'
import { supabase, signedDocumentUrl } from '../../lib/supabaseClient'
import { getClient, getClientDetails, getClientTimeline, requestDiscount } from '../../services/clientService'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { friendlyError } from '../../utils/errors'
import { formatDateTime, formatFileSize } from '../../utils/format'
import {
  PAYMENT_METHODS, DISCOUNT_REASONS, MAX_UPLOAD_BYTES, ALLOWED_DOCUMENT_TYPES,
  ID_TYPE_LABELS,
} from '../../constants'

const TABS = ['Overview', 'Documents', 'Payments', 'Timeline']

export default function ClientProfile() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const { money, currency } = useOfficeSettings()

  const [tab, setTab] = useState('Overview')
  const [modal, setModal] = useState(null) // 'discount' | 'payment' | 'complete'
  const [reason, setReason] = useState('')
  const [payment, setPayment] = useState({ amount: '', method: 'cash', ref: '', notes: '' })
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef(null)

  const client = useQuery({ queryKey: ['client', id], queryFn: () => getClient(id) })
  const details = useQuery({ queryKey: ['client-details', id], queryFn: () => getClientDetails(id) })

  /**
   * Group the answers by the section they were captured under, keeping the
   * order they were defined in. Party 1, Party 2 and the property details then
   * each get their own card instead of one long interleaved list.
   */
  const detailSections = useMemo(() => {
    const groups = new Map()
    for (const d of details.data ?? []) {
      const key = d.section || 'Service Information'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(d)
    }
    return [...groups.entries()].map(([section, rows]) => ({ section, rows }))
  }, [details.data])
  const timeline = useQuery({ queryKey: ['client-timeline', id], queryFn: () => getClientTimeline(id), enabled: tab === 'Timeline' })

  const documents = useQuery({
    queryKey: ['client-documents', id],
    enabled: hasRole('admin', 'alt', 'finance'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*').eq('client_id', id).is('deleted_at', null).order('version', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const receipts = useQuery({
    queryKey: ['client-receipts', id],
    enabled: hasRole('admin', 'finance'),
    queryFn: async () => {
      const { data, error } = await supabase.from('receipts').select('*').eq('client_id', id).order('issued_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const refreshAll = () => {
    for (const key of ['client', 'client-documents', 'client-receipts', 'client-timeline', 'clients', 'stats', 'sidebar-badges']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const askDiscount = useMutation({
    mutationFn: () => requestDiscount(id, reason),
    onSuccess: () => { toast.success('Sent to the Administrator for approval'); setModal(null); setReason(''); refreshAll() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const markComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_document_complete', { p_client_id: id })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Sent to Finance for payment'); setModal(null); refreshAll() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const takePayment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('receive_payment', {
        p_client_id: id,
        p_amount: Number(payment.amount),
        p_method: payment.method,
        p_transaction_ref: payment.ref || null,
        p_notes: payment.notes || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: async (res) => {
      toast.success(`Payment saved — receipt ${res.receipt_no}`)
      setModal(null)
      setPayment({ amount: '', method: 'cash', ref: '', notes: '' })
      refreshAll()
      const { data } = await supabase.from('receipts').select('*').eq('id', res.receipt_id).single()
      if (data) setReceiptPreview(data)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const handleUpload = async (file) => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) return toast.error('That file is larger than 10 MB.')
    if (!ALLOWED_DOCUMENT_TYPES[file.type]) return toast.error('Only Word (.doc, .docx) and PDF files are allowed.')

    setUploading(true)
    try {
      const path = `clients/${id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('client-documents').upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const { error } = await supabase.from('uploaded_documents').insert({
        client_id: id,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      if (error) throw error

      toast.success('Document uploaded')
      refreshAll()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const openDocument = async (doc, isPrint) => {
    try {
      const url = await signedDocumentUrl(doc.file_path, 120)
      window.open(url, '_blank', 'noopener')
      if (isPrint) supabase.rpc('log_document_print', { p_document_id: doc.id, p_is_reprint: doc.print_count > 0 }).catch(() => {})
      refreshAll()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  if (client.isLoading) return <FormSkeleton fields={8} />
  if (client.isError) return <ErrorState error={client.error} onRetry={client.refetch} />

  // A successful query can still come back empty — the client was removed, or
  // this role is not allowed to see it. Without this the page read straight
  // into undefined and crashed with "cannot read final_price".
  if (!client.data) {
    return (
      <EmptyState
        icon={FileText}
        title="This client could not be opened"
        description="It may have been removed, or your role may not have access to it."
      />
    )
  }

  const c = client.data
  const paidSoFar = (receipts.data ?? []).reduce((a, r) => a + Number(r.amount_paid ?? 0), 0)
  const due = Number(c.final_price) - paidSoFar

  return (
    <>
      <PageHeader
        title={c.full_name}
        description={`${c.registration_no} · ${c.service_name_snapshot}`}
        breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: c.registration_no }]}
        actions={
          <>
            {/* A discount can be asked for any time before money changes hands. */}
            {hasRole('admin', 'registration') &&
              !c.price_locked &&
              ['registered', 'waiting_alt', 'document_uploaded', 'waiting_payment'].includes(c.status) && (
              <Button variant="secondary" icon={BadgePercent} onClick={() => setModal('discount')}>
                Request Discount
              </Button>
            )}
            {hasRole('admin', 'alt') && ['waiting_alt', 'document_uploaded'].includes(c.status) && (
              <>
                <Button variant="secondary" icon={Upload} loading={uploading} onClick={() => fileInput.current?.click()}>
                  Upload Document
                </Button>
                {documents.data?.length > 0 && (
                  <Button icon={CheckCircle2} onClick={() => setModal('complete')}>Mark Complete</Button>
                )}
              </>
            )}
            {hasRole('admin', 'finance') && c.status === 'waiting_payment' && (
              <Button icon={Wallet} onClick={() => { setPayment((p) => ({ ...p, amount: String(due) })); setModal('payment') }}>
                Receive Payment
              </Button>
            )}
          </>
        }
      />

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept=".doc,.docx,.pdf"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusBadge status={c.status} />
        {c.price_locked && <Badge tone="navy">Final amount locked</Badge>}
        <span className="text-sm text-slate-500">
          {Number(c.discount_amount) > 0 ? (
            <>
              {money(c.original_price)}
              <span className="text-emerald-600"> − {money(c.discount_amount)}</span>
              {' = '}
              <strong className="text-slate-900">{money(c.final_price)}</strong>
            </>
          ) : (
            <strong className="text-slate-900">{money(c.final_price)}</strong>
          )}
        </span>
      </div>

      <div className="mb-5 flex gap-1 border-b border-surface-border no-print">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-navy-700 text-navy-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">General Information</h3>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Registration No', c.registration_no],
                ['Reference', c.reference_no],
                ['Document Type', c.document_type],
                ['Priority', c.priority === 'urgent' ? 'Urgent' : 'Normal'],
                ['Phone', c.phone],
                // Show which document the number belongs to, not just a number
                [
                  c.id_type ? `${ID_TYPE_LABELS[c.id_type] ?? 'Document'} Number` : 'Document Number',
                  c.national_id,
                ],
                ['District', c.address],
                ['Service', c.service_name_snapshot],
                ['Registered', formatDateTime(c.registered_at)],
                ...(c.notes ? [['Notes', c.notes]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* One card per section. Rendering every answer in a single list
              put both parties in one column with every label repeated —
              "Magaca oo saddexan" twice, "Telefoonka" twice — which is
              unreadable on a two-party deed. */}
          {detailSections.map(({ section, rows }, i) => (
            <div key={section} className="card p-6">
              <h3
                className={clsx(
                  'mb-4 flex items-center gap-2 border-b pb-2.5 text-sm font-semibold uppercase tracking-wide',
                  SECTION_TONES[i % SECTION_TONES.length].text,
                  SECTION_TONES[i % SECTION_TONES.length].border,
                )}
              >
                <SectionIcon className="h-4 w-4" />
                {section}
              </h3>
              <dl className="space-y-2.5 text-sm">
                {rows.map((d) => (
                  <div key={d.id} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{d.label}</dt>
                    <dd className="text-right font-medium text-slate-800">{d.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          {details.data && details.data.length === 0 && (
            <div className="card p-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Service Information</h3>
              <p className="text-sm text-slate-500">
                No extra information was recorded for this service.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {!documents.data?.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            documents.data.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <FileText className="h-5 w-5 shrink-0 text-navy-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{d.title}</p>
                  <p className="text-xs text-slate-400">
                    v{d.version} · {formatFileSize(d.file_size)} · {d.print_count} print
                    {d.print_count === 1 ? '' : 's'} · {formatDateTime(d.uploaded_at)}
                  </p>
                </div>
                {d.is_current && <Badge tone="emerald">Current</Badge>}
                <Button size="sm" variant="ghost" icon={Download} onClick={() => openDocument(d, false)}>Download</Button>
                {hasRole('admin', 'alt') && (
                  <Button size="sm" variant="ghost" icon={Printer} onClick={() => openDocument(d, true)}>Print</Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Payments' && (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {!receipts.data?.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            receipts.data.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 tabular">{r.receipt_no}</p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(r.issued_at)} · {r.cashier_name}
                  </p>
                </div>
                <span className="font-semibold tabular text-emerald-700">{money(r.amount_paid)}</span>
                <Button size="sm" variant="ghost" icon={Printer} onClick={() => setReceiptPreview(r)}>Receipt</Button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Timeline' && (
        <div className="card p-6">
          {!timeline.data?.length ? (
            <p className="py-8 text-center text-sm text-slate-500">No history recorded yet.</p>
          ) : (
            <ol className="relative space-y-6 border-l border-surface-border pl-6">
              {timeline.data.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[29px] top-1 grid h-5 w-5 place-items-center rounded-full bg-navy-50 ring-4 ring-white">
                    <Clock className="h-3 w-3 text-navy-600" />
                  </span>
                  <p className="text-sm text-slate-800">
                    {t.description || t.action.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {t.user_name_snapshot} ({t.user_role_snapshot}) · {formatDateTime(t.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* ---------- request discount: reason only ---------- */}
      <Modal
        open={modal === 'discount'}
        onClose={() => setModal(null)}
        title="Request a discount"
        description="You give the reason. The Administrator decides the amount."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={askDiscount.isPending} disabled={!reason.trim()} onClick={() => askDiscount.mutate()}>
              Send for approval
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ReadOnlyMoney label="Service price" value={c.original_price} symbol={currency} tone="locked" />
          <Select
            label="Common reasons"
            placeholder="Choose one, or write your own below"
            onChange={(e) => setReason(e.target.value)}
            options={DISCOUNT_REASONS.map((r) => ({ value: r, label: r }))}
          />
          <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <p className="rounded-lg bg-navy-50 px-3 py-2.5 text-xs text-navy-800">
            You cannot enter a discount amount. Only the Administrator can.
          </p>
        </div>
      </Modal>

      {/* ---------- receive payment ---------- */}
      <Modal
        open={modal === 'payment'}
        onClose={() => setModal(null)}
        title="Receive payment"
        description={`${c.full_name} — ${c.service_name_snapshot}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant="success"
              loading={takePayment.isPending}
              disabled={!(Number(payment.amount) > 0) || Number(payment.amount) > due}
              onClick={() => takePayment.mutate()}
            >
              Save payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyMoney label="Final amount" value={c.final_price} symbol={currency} tone="locked" />
            <ReadOnlyMoney label="Outstanding" value={due} symbol={currency} tone="success" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Payment method" required value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} options={PAYMENT_METHODS} />
            <Input
              label="Amount paid" required type="number" step="0.01" min="0.01" max={due}
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              error={Number(payment.amount) > due ? `Cannot exceed ${money(due)}` : undefined}
            />
          </div>
          <Input label="Transaction reference" value={payment.ref} onChange={(e) => setPayment({ ...payment, ref: e.target.value })} hint="Optional — EVC / ZAAD / bank reference" />
          <Textarea label="Notes" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} rows={2} />
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Once saved this payment cannot be edited by anyone. A mistake requires
            an Administrator-approved correction record.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={modal === 'complete'}
        onClose={() => setModal(null)}
        onConfirm={() => markComplete.mutate()}
        loading={markComplete.isPending}
        tone="security"
        title="Mark document complete?"
        message="Confirm the client has signed the printed document. This sends them to Finance for payment."
        confirmLabel="Yes, send to Finance"
      />

      <ReceiptModal receipt={receiptPreview} onClose={() => setReceiptPreview(null)} />
    </>
  )
}
