import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { friendlyError } from '../../utils/errors'
import { PAYMENT_METHODS, DEPARTMENTS } from '../../constants'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  source: '',
  description: '',
  amount: '',
  payment_method: 'cash',
  income_date: today(),
  category: '',
  reference_no: '',
  department: '',
  notes: '',
}

/**
 * Money the office receives that is NOT a client paying for a service —
 * rent, a refund, a donation. Client fees go through Receive Payment so they
 * stay tied to a receipt and an invoice.
 */
export default function RecordIncome() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const { profile } = useAuth()
  const { money } = useOfficeSettings()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const next = {}
    if (!form.source.trim()) next.source = 'Say where the money came from.'
    if (!form.description.trim()) next.description = 'Describe what it is for.'
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter an amount above zero.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('record_other_income', {
        p_source: form.source.trim(),
        p_description: form.description.trim(),
        p_amount: Number(form.amount),
        p_method: form.payment_method,
        p_income_date: form.income_date,
        p_category: form.category || null,
        p_reference_no: form.reference_no || null,
        p_department: form.department || null,
        p_notes: form.notes || null,
        p_proof_url: null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Income recorded — ${data.income_no}`)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['other-income'] })
      navigate('/finance')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const submit = (e) => {
    e.preventDefault()
    if (validate()) save.mutate()
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Record Income"
        description="Money received by the office that is not a client paying for a service."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Record Income' }]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-700">
              <TrendingUp className="h-4 w-4 text-ink-400" /> Income Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Received From"
                required
                value={form.source}
                onChange={set('source')}
                error={errors.source}
                placeholder="Who paid the office"
                autoFocus
              />
              <Input label="Income Date" type="date" value={form.income_date} onChange={set('income_date')} />

              <Input
                label="Description"
                required
                value={form.description}
                onChange={set('description')}
                error={errors.description}
                placeholder="What the money is for"
                wrapperClassName="sm:col-span-2"
              />

              <Input
                label="Amount (USD)"
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={set('amount')}
                error={errors.amount}
              />
              <Select
                label="Payment Method"
                required
                value={form.payment_method}
                onChange={set('payment_method')}
                options={PAYMENT_METHODS}
              />

              <Input label="Category" value={form.category} onChange={set('category')} hint="Optional" />
              <Select
                label="Department"
                placeholder="None"
                value={form.department}
                onChange={set('department')}
                options={DEPARTMENTS}
                hint="Optional"
              />

              <Input
                label="Reference No."
                value={form.reference_no}
                onChange={set('reference_no')}
                hint="Optional"
                wrapperClassName="sm:col-span-2"
              />

              <Textarea
                label="Notes"
                value={form.notes}
                onChange={set('notes')}
                rows={3}
                hint="Optional"
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </div>
        </div>

        {/* ---------- summary ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-ink-700">Summary</h3>

            <dl className="space-y-3 text-sm">
              {[
                ['Amount', form.amount ? money(form.amount) : '—'],
                ['Method', PAYMENT_METHODS.find((m) => m.value === form.payment_method)?.label ?? '—'],
                ['Date', form.income_date || '—'],
                ['From', form.source || '—'],
                ['Recorded by', profile?.full_name ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right font-medium text-ink-800">{v}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-500">
              The reference number is created automatically when you save.
            </p>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/finance')}>
                Cancel
              </Button>
              <Button type="submit" icon={Save} loading={save.isPending} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
