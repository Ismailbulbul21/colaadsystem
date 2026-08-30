import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Plus, Save, RotateCcw, Trash2, Printer, Pencil, BadgeDollarSign, X, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import {
  listInvoices, getInvoice, saveInvoice, payInvoice, voidDocument,
} from '../../services/billingService'
import { listTypes, listMethods } from '../../services/financeLedgerService'
import { InvoiceDoc } from '../../components/finance/PrintableDocs'
import { friendlyError } from '../../utils/errors'
import { formatDate } from '../../utils/format'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, unit_price: '' })
const blank = () => ({
  invoice_date: today(), due_date: '', bill_to_name: '', bill_to_address: '',
  bill_to_phone: '', discount: 0, tax_percent: 0, notes: '',
  items: [blankItem()],
})

const STATUS_TONE = { unpaid: 'amber', paid: 'emerald', cancelled: 'slate' }

/** Bills the office issues. Marking one paid records the money and the receipt. */
export default function Invoices() {
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const table = useTableState({ defaultSort: { key: 'invoice_date', dir: 'desc' } })
  const f = table.filters

  const [form, setForm] = useState(null)     // null = list view
  const [preview, setPreview] = useState(null)
  const [paying, setPaying] = useState(null)
  const [voiding, setVoiding] = useState(null)

  const list = useQuery({
    queryKey: ['invoices', f, table.page, table.pageSize, table.sort],
    queryFn: () => listInvoices({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    queryClient.invalidateQueries({ queryKey: ['receipts'] })
    queryClient.invalidateQueries({ queryKey: ['finance-txns'] })
    queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
  }

  const openEdit = async (row) => {
    try {
      const full = await getInvoice(row.id)
      setForm({
        ...full,
        due_date: full.due_date ?? '',
        bill_to_address: full.bill_to_address ?? '',
        bill_to_phone: full.bill_to_phone ?? '',
        notes: full.notes ?? '',
        items: full.items.length ? full.items : [blankItem()],
      })
    } catch (e) { toast.error(friendlyError(e)) }
  }

  const openPreview = async (row) => {
    try { setPreview(await getInvoice(row.id)) }
    catch (e) { toast.error(friendlyError(e)) }
  }

  const voidIt = useMutation({
    mutationFn: (id) => voidDocument('invoice', id),
    onSuccess: () => { toast.success('Invoice cancelled'); setVoiding(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const columns = useMemo(() => [
    { key: 'invoice_no', header: 'Invoice No.', sortable: true, className: 'tabular font-medium text-navy-700' },
    { key: 'invoice_date', header: 'Date', sortable: true, render: (r) => formatDate(r.invoice_date) },
    { key: 'bill_to_name', header: 'Bill To' },
    { key: 'due_date', header: 'Due', render: (r) => (r.due_date ? formatDate(r.due_date) : '—') },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="tabular font-medium">{money(r.total)}</span> },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" icon={Printer} onClick={() => openPreview(r)}>Print</Button>
          {r.status === 'unpaid' && (
            <>
              <Button size="sm" variant="ghost" icon={BadgeDollarSign}
                      className="text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setPaying(r)}>
                Mark Paid
              </Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(r)}>Edit</Button>
              <Button size="sm" variant="ghost" icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setVoiding(r)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      ),
    },
  ], [money])

  if (form) {
    return <InvoiceForm form={form} setForm={setForm}
                        onDone={() => { setForm(null); refresh() }} />
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Bills the office issues. Marking one paid records the money in the ledger and issues the receipt."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/finance"><Button variant="secondary" icon={ArrowLeft}>Back</Button></Link>
            <Button icon={Plus} onClick={() => setForm(blank())}>New Invoice</Button>
          </div>
        }
      />

      <div className="mb-4 card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Search" placeholder="Invoice number or name…"
                 defaultValue={f.q ?? ''}
                 onChange={(e) => table.setFilter('q', e.target.value)} />
          <Select label="Status" placeholder="All" value={f.status ?? ''}
                  onChange={(e) => table.setFilter('status', e.target.value)}
                  options={[
                    { value: 'unpaid', label: 'Unpaid' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]} />
        </div>
      </div>

      <DataTable
        columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
        loading={list.isLoading} error={list.error} onRetry={list.refetch}
        page={table.page} pageSize={table.pageSize}
        onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
        sort={table.sort} onSortChange={table.setSort}
        emptyTitle="No invoices yet"
        emptyDescription="Press New Invoice to make the first one."
        exportFileName="invoices" enablePrint
      />

      <PayDialog invoice={paying} onClose={() => setPaying(null)}
                 onPaid={() => { setPaying(null); refresh() }} />

      <PrintModal doc={preview} onClose={() => setPreview(null)} kind="invoice" />

      <ConfirmDialog
        open={!!voiding}
        title="Cancel this invoice?"
        message={voiding ? `${voiding.invoice_no} will be marked cancelled and hidden from the list.` : ''}
        confirmLabel="Yes, cancel it"
        tone="danger"
        loading={voidIt.isPending}
        onConfirm={() => voidIt.mutate(voiding.id)}
        onClose={() => setVoiding(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ form */

function InvoiceForm({ form, setForm, onDone }) {
  const { money } = useOfficeSettings()
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: undefined }))
  }

  const setItem = (i, k) => (e) => {
    setForm((p) => {
      const items = [...p.items]
      items[i] = { ...items[i], [k]: e.target.value }
      return { ...p, items }
    })
  }

  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, blankItem()] }))
  const dropLine = (i) => setForm((p) => ({
    ...p,
    items: p.items.length > 1 ? p.items.filter((_, n) => n !== i) : p.items,
  }))

  // Shown live so the clerk sees the bill add up; the database recalculates
  // the same figures on save and its answer is the one that is stored.
  const subtotal = form.items.reduce(
    (n, i) => n + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0)
  const discount = Number(form.discount) || 0
  const taxAmount = Math.max(0, (subtotal - discount)) * (Number(form.tax_percent) || 0) / 100
  const total = subtotal - discount + taxAmount

  const save = useMutation({
    mutationFn: () => saveInvoice(form),
    onSuccess: (d) => { toast.success(`Saved — ${d.invoice_no}`); onDone() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.bill_to_name.trim()) next.bill_to_name = 'Enter who the invoice is for.'
    if (!form.invoice_date) next.invoice_date = 'Enter the invoice date.'
    if (!form.items.some((i) => i.description.trim())) next.items = 'Add at least one line.'
    if (discount > subtotal) next.discount = 'The discount cannot be more than the subtotal.'
    setErrors(next)
    if (Object.keys(next).length) { toast.error('Please fix the highlighted fields.'); return }
    save.mutate()
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={form.id ? `Edit ${form.invoice_no}` : 'New Invoice'}
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" icon={RotateCcw} onClick={onDone}>Cancel</Button>
            <Button type="submit" icon={Save} loading={save.isPending}>Save Invoice</Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-ink-800">Bill To</h3>
          <div className="space-y-3">
            <Input label="Name" required value={form.bill_to_name}
                   onChange={set('bill_to_name')} error={errors.bill_to_name} />
            <Textarea label="Address" rows={2} value={form.bill_to_address}
                      onChange={set('bill_to_address')} />
            <Input label="Telephone" value={form.bill_to_phone} onChange={set('bill_to_phone')} />
            <Input label="Invoice Date" required type="date" value={form.invoice_date}
                   onChange={set('invoice_date')} error={errors.invoice_date} />
            <Input label="Due Date" type="date" value={form.due_date}
                   onChange={set('due_date')} hint="Optional" />
            <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-800">Items</h3>
              <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addLine}>
                Add line
              </Button>
            </div>
            {errors.items && <p className="mb-2 text-xs text-red-600">{errors.items}</p>}

            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <Input label={i === 0 ? 'Description' : undefined} value={it.description}
                         onChange={setItem(i, 'description')}
                         wrapperClassName="col-span-6 mb-0" />
                  <Input label={i === 0 ? 'Qty' : undefined} type="number" step="0.01" min="0"
                         value={it.qty} onChange={setItem(i, 'qty')}
                         wrapperClassName="col-span-2 mb-0" />
                  <Input label={i === 0 ? 'Unit Price' : undefined} type="number" step="0.01" min="0"
                         value={it.unit_price} onChange={setItem(i, 'unit_price')}
                         wrapperClassName="col-span-3 mb-0" />
                  <div className="col-span-1 pb-1">
                    <Button type="button" size="sm" variant="ghost" icon={X}
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => dropLine(i)}>
                      <span className="sr-only">Remove line</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mt-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Discount (USD)" type="number" step="0.01" min="0"
                     value={form.discount} onChange={set('discount')} error={errors.discount} />
              <Input label="Tax (%)" type="number" step="0.01" min="0" max="100"
                     value={form.tax_percent} onChange={set('tax_percent')}
                     hint="Leave at 0 if you do not charge tax" />
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-surface-border pt-4 text-sm">
              {[
                ['Subtotal', subtotal],
                ['Discount', -discount],
                [`Tax (${Number(form.tax_percent) || 0}%)`, taxAmount],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="tabular">{money(value)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-surface-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular text-navy-800">{money(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- pay dialog */

function PayDialog({ invoice, onClose, onPaid }) {
  const { money } = useOfficeSettings()
  const [methodId, setMethodId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [paidDate, setPaidDate] = useState(today())

  const methods = useQuery({ queryKey: ['finance-methods'], queryFn: listMethods, enabled: !!invoice })
  const types = useQuery({ queryKey: ['finance-types'], queryFn: () => listTypes('income'), enabled: !!invoice })

  const pay = useMutation({
    mutationFn: () => payInvoice({
      invoiceId: invoice.id, methodId, typeId,
      paidBy: paidBy || invoice.bill_to_name, paidDate,
    }),
    onSuccess: (d) => { toast.success(`Paid — receipt ${d.receipt_no}`); onPaid() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!invoice) return null

  return (
    <Modal open onClose={onClose} title={`Mark ${invoice.invoice_no} as paid`}>
      <div className="space-y-3">
        <p className="text-sm text-ink-600">
          This records <strong>{money(invoice.total)}</strong> as income in the ledger and
          issues a receipt. Both happen together.
        </p>
        <Input label="Date received" required type="date" value={paidDate}
               onChange={(e) => setPaidDate(e.target.value)} />
        <Select label="Income Type" required placeholder="Choose…" value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                options={(types.data ?? []).filter((t) => t.is_active)
                  .map((t) => ({ value: t.id, label: t.name }))} />
        <Select label="Payment Method" required placeholder="Choose…" value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                options={(methods.data ?? []).filter((m) => m.is_active)
                  .map((m) => ({ value: m.id, label: m.name }))} />
        <Input label="Paid By" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}
               placeholder={invoice.bill_to_name} hint="Optional" />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={BadgeDollarSign} loading={pay.isPending}
                disabled={!methodId || !typeId}
                onClick={() => pay.mutate()}>
          Confirm Payment
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------ print modal */

export function PrintModal({ doc, onClose, kind }) {
  if (!doc) return null
  return (
    <Modal open onClose={onClose} title={kind === 'invoice' ? 'Invoice' : 'Receipt'} size="lg">
      <div className="no-print mb-3 flex justify-end">
        <Button icon={Printer} onClick={() => window.print()}>Print</Button>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-surface-border print:max-h-none print:overflow-visible print:border-0">
        <InvoiceDoc invoice={doc} />
      </div>
    </Modal>
  )
}
