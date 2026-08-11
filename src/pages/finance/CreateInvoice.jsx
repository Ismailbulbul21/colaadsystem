import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import InvoiceModal from '../../components/print/InvoiceModal'
import { supabase } from '../../lib/supabaseClient'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { friendlyError } from '../../utils/errors'
import { PAYMENT_METHODS } from '../../constants'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * The office is paid at the desk, so an invoice is never a bill sent out and
 * chased later — it is the record of a payment taken now. Saving here calls
 * receive_payment(), which writes the payment, the receipt and the invoice in
 * one transaction, exactly as taking payment from the client's profile does.
 */
export default function CreateInvoice() {
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})
  const [issued, setIssued] = useState(null)

  const { money, currency } = useOfficeSettings()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Only clients who still owe something can be invoiced.
  const clients = useQuery({
    queryKey: ['invoiceable-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, registration_no, full_name, phone, service_name_snapshot, original_price, discount_amount, final_price, status')
        .is('deleted_at', null)
        .in('status', ['registered', 'waiting_alt', 'document_uploaded', 'waiting_payment'])
        .order('registered_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return data ?? []
    },
  })

  const selected = useMemo(
    () => clients.data?.find((c) => c.id === clientId) ?? null,
    [clients.data, clientId],
  )

  // What is still owed, after anything already paid.
  const paidSoFar = useQuery({
    queryKey: ['client-paid', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('amount_paid').eq('client_id', clientId)
      if (error) throw error
      return (data ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
    },
  })

  const due = selected ? Number(selected.final_price) - Number(paidSoFar.data ?? 0) : 0

  const pickClient = (id) => {
    setClientId(id)
    setErrors({})
    const c = clients.data?.find((x) => x.id === id)
    setReference(c?.registration_no ?? '')
    setAmount(c ? String(c.final_price) : '')
  }

  const validate = () => {
    const next = {}
    if (!clientId) next.client = 'Choose a client.'
    if (!amount || Number(amount) <= 0) next.amount = 'Enter an amount above zero.'
    else if (selected && Number(amount) > due) {
      next.amount = `That is more than the ${money(due)} still owed.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('receive_payment', {
        p_client_id: clientId,
        p_amount: Number(amount),
        p_method: method,
        p_transaction_ref: reference || null,
        p_notes: notes || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: async (res) => {
      toast.success(`Invoice ${res.invoice_no} created`)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoiceable-clients'] })
      const { data } = await supabase.from('invoices').select('*').eq('id', res.invoice_id).maybeSingle()
      if (data) setIssued(data)
      else navigate('/finance/invoices')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (validate()) save.mutate()
  }

  const discount = selected ? Number(selected.discount_amount) : 0

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Create Invoice"
        description="Take the payment and issue the invoice and receipt together."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }, { label: 'Create Invoice' }]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Client"
                required
                placeholder={clients.isLoading ? 'Loading…' : 'Select client'}
                value={clientId}
                onChange={(e) => pickClient(e.target.value)}
                error={errors.client}
                options={(clients.data ?? []).map((c) => ({
                  value: c.id,
                  label: `${c.full_name} — ${c.registration_no}`,
                }))}
              />
              <Input
                label="Service"
                value={selected?.service_name_snapshot ?? ''}
                readOnly
                placeholder="Chosen with the client"
              />

              <Input
                label="Reference / Registration No."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                wrapperClassName="sm:col-span-2"
              />

              <Input
                label="Invoice Date"
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
              <Select
                label="Payment Method"
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                options={PAYMENT_METHODS}
              />

              <Input
                label="Amount"
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={errors.amount}
                hint={selected ? `${money(due)} still owed` : undefined}
              />
              <Input
                label="Discount"
                value={discount > 0 ? money(discount) : `${currency}0.00`}
                readOnly
                hint="Only an Administrator can approve a discount"
              />

              {selected && (
                <div className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 sm:col-span-2 dark:border-navy-700 dark:bg-navy-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-900 dark:text-navy-100">Total Amount</span>
                    <span className="text-xl font-semibold tabular text-navy-900 dark:text-white">
                      {money(selected.final_price)}
                    </span>
                  </div>
                </div>
              )}

              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                hint="Optional"
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </div>
        </div>

        {/* ---------- preview ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-ink-700">Invoice Preview</h3>

            <dl className="space-y-2.5 border-t border-dashed border-surface-border pt-4 text-sm">
              {[
                ['Client', selected?.full_name ?? '—'],
                ['Service', selected?.service_name_snapshot ?? '—'],
                ['Reference No.', reference || '—'],
                ['Invoice Date', invoiceDate || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right font-medium text-ink-800">{v}</dd>
                </div>
              ))}

              <div className="mt-3 border-t border-dashed border-surface-border pt-3">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Amount</dt>
                  <dd className="tabular font-medium text-ink-800">
                    {selected ? money(selected.original_price) : '—'}
                  </dd>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <dt className="text-ink-500">Discount</dt>
                  <dd className="tabular font-medium text-ink-800">{money(discount)}</dd>
                </div>
                <div className="mt-3 flex justify-between gap-3 border-t border-surface-border pt-3">
                  <dt className="font-semibold text-navy-800 dark:text-navy-200">Total Amount</dt>
                  <dd className="tabular text-lg font-semibold text-navy-800 dark:text-navy-100">
                    {amount ? money(amount) : money(0)}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/finance/invoices')}>
                Cancel
              </Button>
              <Button type="submit" icon={Save} loading={save.isPending} className="flex-1">
                Save Invoice
              </Button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              A receipt is created at the same time, because the client is paying now.
            </p>
          </div>
        </div>
      </div>

      {issued && (
        <InvoiceModal
          invoice={issued}
          onClose={() => {
            setIssued(null)
            navigate('/finance/invoices')
          }}
        />
      )}
    </form>
  )
}
