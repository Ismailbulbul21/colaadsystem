import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Building2, ReceiptText, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Input, Textarea, Select, Checkbox } from '../../components/ui/Field'
import { FormSkeleton } from '../../components/feedback/Skeleton'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../utils/errors'
import { qk } from '../../lib/queryClient'

export default function OfficeSettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: qk.officeSettings,
    queryFn: async () => {
      const { data, error } = await supabase.from('office_settings').select('*').limit(1).single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  const save = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, is_singleton, ...payload } = form
      const { error } = await supabase.from('office_settings').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Office settings saved')
      queryClient.invalidateQueries({ queryKey: qk.officeSettings })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (isLoading || !form) return <FormSkeleton fields={10} />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <PageHeader
        title="Office Settings"
        description="Used across the application and printed on every receipt."
        actions={<Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Building2 className="h-4 w-4 text-slate-400" /> Office identity
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Office name" value={form.office_name ?? ''} onChange={set('office_name')} wrapperClassName="sm:col-span-2" />
            <Input label="Logo URL" value={form.logo_url ?? ''} onChange={set('logo_url')} hint="Upload to the office-assets bucket, then paste the URL" wrapperClassName="sm:col-span-2" />
            <Textarea label="Address" value={form.address ?? ''} onChange={set('address')} rows={2} wrapperClassName="sm:col-span-2" />
            <Input label="City" value={form.city ?? ''} onChange={set('city')} />
            <Input label="Country" value={form.country ?? ''} onChange={set('country')} />
            <Input label="Primary phone" value={form.phone_primary ?? ''} onChange={set('phone_primary')} />
            <Input label="Secondary phone" value={form.phone_secondary ?? ''} onChange={set('phone_secondary')} />
            <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} />
            <Input label="Website" value={form.website ?? ''} onChange={set('website')} />
            <Input label="Tax number" value={form.tax_number ?? ''} onChange={set('tax_number')} wrapperClassName="sm:col-span-2" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ReceiptText className="h-4 w-4 text-slate-400" /> Receipt
            </h3>
            <div className="grid gap-4">
              <Input label="Receipt header" value={form.receipt_header ?? ''} onChange={set('receipt_header')} />
              <Textarea label="Receipt footer" value={form.receipt_footer ?? ''} onChange={set('receipt_footer')} rows={2} />
              <Textarea label="Legal disclaimer" value={form.legal_disclaimer ?? ''} onChange={set('legal_disclaimer')} rows={2} />
              <Input label="Signature image URL" value={form.signature_url ?? ''} onChange={set('signature_url')} />
              <Input label="Office stamp image URL" value={form.stamp_url ?? ''} onChange={set('stamp_url')} />
              <Checkbox label="Print a QR code on receipts" checked={!!form.qr_enabled} onChange={(e) => setForm({ ...form, qr_enabled: e.target.checked })} />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Printer className="h-4 w-4 text-slate-400" /> Format and numbering
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Currency code" value={form.currency ?? ''} onChange={set('currency')} />
              <Input label="Currency symbol" value={form.currency_symbol ?? ''} onChange={set('currency_symbol')} />
              <Select
                label="Date format"
                value={form.date_format ?? 'DD/MM/YYYY'}
                onChange={set('date_format')}
                options={[{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]}
              />
              <Input label="Timezone" value={form.timezone ?? ''} onChange={set('timezone')} />
              <Input label="Registration prefix" value={form.registration_prefix ?? ''} onChange={set('registration_prefix')} hint="e.g. COLAAD" />
              <Input label="Receipt prefix" value={form.receipt_prefix ?? ''} onChange={set('receipt_prefix')} hint="e.g. RCP" />
              <Input label="Invoice prefix" value={form.invoice_prefix ?? ''} onChange={set('invoice_prefix')} hint="e.g. INV" wrapperClassName="sm:col-span-2" />
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Changing a prefix affects only numbers issued from now on. Existing
              registration, receipt and invoice numbers never change.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
