import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Printer, Pencil, Trash2, ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import DataTable from '../../components/table/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import {
  listReceipts, getReceipt, updateReceipt, voidDocument,
} from '../../services/billingService'
import { ReceiptDoc } from '../../components/finance/PrintableDocs'
import { friendlyError } from '../../utils/errors'
import { formatDate } from '../../utils/format'

/** Proof of money received. Issued from a paid invoice or a ledger income line. */
export default function Receipts() {
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const table = useTableState({ defaultSort: { key: 'receipt_date', dir: 'desc' } })
  const f = table.filters

  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(null)
  const [voiding, setVoiding] = useState(null)

  const list = useQuery({
    queryKey: ['receipts', f, table.page, table.pageSize, table.sort],
    queryFn: () => listReceipts({ filters: f, range: table.range, sort: table.sort }),
    keepPreviousData: true,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['receipts'] })

  const open = async (row, mode) => {
    try {
      const full = await getReceipt(row.id)
      if (mode === 'print') setPreview(full)
      else setEditing({
        ...full,
        payment_for: full.payment_for ?? '',
        reference: full.reference ?? '',
        notes: full.notes ?? '',
      })
    } catch (e) { toast.error(friendlyError(e)) }
  }

  const voidIt = useMutation({
    mutationFn: (id) => voidDocument('receipt', id),
    onSuccess: () => { toast.success('Receipt cancelled'); setVoiding(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const columns = useMemo(() => [
    { key: 'receipt_no', header: 'Receipt No.', sortable: true, className: 'tabular font-medium text-navy-700' },
    { key: 'receipt_date', header: 'Date', sortable: true, render: (r) => formatDate(r.receipt_date) },
    { key: 'received_from', header: 'Received From' },
    { key: 'payment_for', header: 'Payment For', render: (r) => r.payment_for || '—' },
    { key: 'method_name', header: 'Method', render: (r) => r.method_name || '—' },
    { key: 'reference', header: 'Reference', className: 'tabular', render: (r) => r.reference || 'N/A' },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="tabular font-medium">{money(r.total)}</span> },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" icon={Printer} onClick={() => open(r, 'print')}>Print</Button>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open(r, 'edit')}>Edit</Button>
          <Button size="sm" variant="ghost" icon={Trash2}
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setVoiding(r)}>Cancel</Button>
        </div>
      ),
    },
  ], [money])

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Proof of money received. Issued when an invoice is paid, or from any income line in the ledger."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts' }]}
        actions={<Link to="/finance"><Button variant="secondary" icon={ArrowLeft}>Back</Button></Link>}
      />

      <div className="mb-4 card p-4">
        <Input label="Search" placeholder="Receipt number, name or reference…"
               defaultValue={f.q ?? ''}
               onChange={(e) => table.setFilter('q', e.target.value)} />
      </div>

      <DataTable
        columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
        loading={list.isLoading} error={list.error} onRetry={list.refetch}
        page={table.page} pageSize={table.pageSize}
        onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
        sort={table.sort} onSortChange={table.setSort}
        emptyTitle="No receipts yet"
        emptyDescription="A receipt appears when an invoice is paid, or when you press Receipt on an income line."
        exportFileName="receipts" enablePrint
      />

      {preview && (
        <Modal open onClose={() => setPreview(null)} title="Receipt" size="lg">
          <div className="no-print mb-3 flex justify-end">
            <Button icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-surface-border print:max-h-none print:overflow-visible print:border-0">
            <ReceiptDoc receipt={preview} />
          </div>
        </Modal>
      )}

      <EditReceipt receipt={editing} onClose={() => setEditing(null)}
                   onSaved={() => { setEditing(null); refresh() }} />

      <ConfirmDialog
        open={!!voiding}
        title="Cancel this receipt?"
        message={voiding
          ? `${voiding.receipt_no} will be hidden. The money stays in the ledger — remove that separately if it was never received.`
          : ''}
        confirmLabel="Yes, cancel it"
        tone="danger"
        loading={voidIt.isPending}
        onConfirm={() => voidIt.mutate(voiding.id)}
        onClose={() => setVoiding(null)}
      />
    </>
  )
}

/**
 * Only the wording is editable. The amount belongs to the ledger entry, so a
 * receipt can never end up claiming a different sum from the money recorded.
 */
function EditReceipt({ receipt, onClose, onSaved }) {
  const { money } = useOfficeSettings()
  const [form, setForm] = useState(null)
  const [loadedId, setLoadedId] = useState(null)

  if (receipt && receipt.id !== loadedId) {
    setLoadedId(receipt.id)
    setForm({
      received_from: receipt.received_from,
      payment_for: receipt.payment_for ?? '',
      reference: receipt.reference ?? '',
      notes: receipt.notes ?? '',
    })
  }
  if (!receipt && loadedId) { setLoadedId(null); setForm(null) }

  const save = useMutation({
    mutationFn: () => updateReceipt(receipt.id, form),
    onSuccess: () => { toast.success('Receipt updated'); onSaved() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!receipt || !form) return null
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  return (
    <Modal open onClose={onClose} title={`Edit ${receipt.receipt_no}`}>
      <div className="space-y-3">
        <div className="rounded-lg bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-ink-500">Amount</span>{' '}
          <strong className="tabular">{money(receipt.total)}</strong>
          <p className="mt-0.5 text-xs text-ink-400">
            The amount comes from the ledger entry and cannot be changed here.
          </p>
        </div>
        <Input label="Received From" required value={form.received_from}
               onChange={set('received_from')} />
        <Input label="Payment For" value={form.payment_for} onChange={set('payment_for')} />
        <Input label="Reference" value={form.reference} onChange={set('reference')}
               placeholder="NR132/4131/2026" />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Save} loading={save.isPending}
                disabled={!form.received_from.trim()}
                onClick={() => save.mutate()}>
          Save changes
        </Button>
      </div>
    </Modal>
  )
}
