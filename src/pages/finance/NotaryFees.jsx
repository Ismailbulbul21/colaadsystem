import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BadgeDollarSign, ArrowLeft, Info } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/table/DataTable'
import Modal from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Field'
import { useTableState } from '../../hooks/useTableState'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { listTypes, listMethods } from '../../services/financeLedgerService'
import { listAwaitingPayment, recordNotaryPayment } from '../../services/notaryFeeService'
import { friendlyError } from '../../utils/errors'
import { formatDate } from '../../utils/format'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Finalised documents whose fees the office has not yet collected.
 *
 * Only the fees are money the office earns. The transaction amount is shown
 * greyed beside them for context — it passes between the two parties and
 * never enters the ledger.
 */
export default function NotaryFees() {
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const table = useTableState({ defaultSort: { key: 'finalized_at', dir: 'desc' } })
  const [collecting, setCollecting] = useState(null)

  const list = useQuery({
    queryKey: ['notary-awaiting', table.page, table.pageSize],
    queryFn: () => listAwaitingPayment({ range: table.range }),
    keepPreviousData: true,
  })

  const columns = useMemo(() => [
    { key: 'reference_no', header: 'Reference', className: 'tabular font-medium text-navy-700' },
    { key: 'customer_name', header: 'Customer', render: (r) => r.customer_name || '—' },
    { key: 'service_name', header: 'Service', render: (r) => r.service_name || '—' },
    { key: 'document_date', header: 'Date', render: (r) => formatDate(r.document_date) },
    {
      key: 'transaction_amount', header: 'Transaction', align: 'right',
      render: (r) => (
        <span className="tabular text-ink-400" title="Passes between the parties — not office income">
          {money(r.transaction_amount)}
        </span>
      ),
    },
    {
      key: 'office_fees', header: 'Office Fees', align: 'right',
      render: (r) => (
        <span className="tabular font-semibold text-emerald-700">{money(r.office_fees)}</span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <Button size="sm" icon={BadgeDollarSign} onClick={() => setCollecting(r)}>
          Collect Fees
        </Button>
      ),
    },
  ], [money])

  return (
    <>
      <PageHeader
        title="Notary Fees Due"
        description="Finalised documents whose fees have not been collected yet."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Notary Fees' }]}
        actions={<Link to="/finance"><Button variant="secondary" icon={ArrowLeft}>Back</Button></Link>}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-navy-200 bg-navy-50/60 p-4 text-sm text-navy-900 dark:border-navy-900/40 dark:bg-navy-950/20 dark:text-navy-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Only the <strong>Office Fees</strong> column becomes income. The Transaction
          column is the money the buyer pays the seller — the office never receives
          it, so it never enters the ledger.
        </span>
      </div>

      <DataTable
        columns={columns} rows={list.data?.rows ?? []} total={list.data?.total ?? 0}
        loading={list.isLoading} error={list.error} onRetry={list.refetch}
        page={table.page} pageSize={table.pageSize}
        onPageChange={table.setPage} onPageSizeChange={table.setPageSize}
        emptyTitle="Nothing waiting"
        emptyDescription="Fees appear here as soon as an officer finalises a document."
        exportFileName="notary-fees-due" enablePrint
      />

      <CollectDialog
        service={collecting}
        onClose={() => setCollecting(null)}
        onDone={() => {
          setCollecting(null)
          queryClient.invalidateQueries({ queryKey: ['notary-awaiting'] })
          queryClient.invalidateQueries({ queryKey: ['finance-txns'] })
          queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
        }}
      />
    </>
  )
}

function CollectDialog({ service, onClose, onDone }) {
  const { money } = useOfficeSettings()
  const [methodId, setMethodId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [paidDate, setPaidDate] = useState(today())

  const methods = useQuery({
    queryKey: ['finance-methods'], queryFn: listMethods, enabled: !!service,
  })
  const types = useQuery({
    queryKey: ['finance-types', 'income'], queryFn: () => listTypes('income'), enabled: !!service,
  })

  const collect = useMutation({
    mutationFn: () => recordNotaryPayment({
      serviceId: service.id, methodId, typeId, paidDate,
    }),
    onSuccess: (d) => { toast.success(`Collected ${money(d.fees)} for ${d.reference_no}`); onDone() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!service) return null

  return (
    <Modal open onClose={onClose} title={`Collect fees — ${service.reference_no}`}>
      <div className="space-y-3">
        <div className="rounded-lg border border-surface-border bg-surface-sunken p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Office fees to collect</span>
            <span className="tabular font-semibold text-emerald-700">
              {money(service.office_fees)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-400">
            <span>Transaction between the parties</span>
            <span className="tabular">{money(service.transaction_amount)}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-400">
            Only the fees are recorded as income.
          </p>
        </div>

        {(service.fee_lines ?? []).length > 0 && (
          <table className="w-full text-xs">
            <tbody>
              {service.fee_lines.map((l) => (
                <tr key={l.rule_id} className="border-b border-surface-border">
                  <td className="py-1 text-ink-600">{l.category}</td>
                  <td className="py-1 text-right tabular">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={BadgeDollarSign} variant="success" loading={collect.isPending}
                disabled={!methodId || !typeId} onClick={() => collect.mutate()}>
          Record {money(service.office_fees)}
        </Button>
      </div>
    </Modal>
  )
}
