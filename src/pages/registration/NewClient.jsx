import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Lock, AlertTriangle, UserPlus, Info } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Input, Select, ReadOnlyMoney } from '../../components/ui/Field'
import DynamicServiceFields from '../../components/form/DynamicServiceFields'
import { FormSkeleton } from '../../components/feedback/Skeleton'
import { StatusBadge } from '../../components/ui/Badge'

import { listActiveServices, getServiceFields } from '../../services/serviceService'
import { createClient, findSimilarClients } from '../../services/clientService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useAuth } from '../../contexts/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { friendlyError } from '../../utils/errors'
import { qk, LONG_CACHE } from '../../lib/queryClient'
import { MOGADISHU_DISTRICTS, ID_TYPES } from '../../constants'
import { formatDate } from '../../utils/format'

const EMPTY = {
  full_name: '',
  phone: '',
  id_type: '',
  national_id: '',
  address: '',
  service_id: '',
}

export default function NewClient() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currency } = useOfficeSettings()
  const { isAdmin } = useAuth()

  const [form, setForm] = useState(EMPTY)
  const [details, setDetails] = useState({})
  const [errors, setErrors] = useState({})
  const [duplicates, setDuplicates] = useState([])
  const [duplicateModal, setDuplicateModal] = useState(false)

  const services = useQuery({
    queryKey: qk.services('active'),
    queryFn: listActiveServices,
    ...LONG_CACHE,
  })

  const fields = useQuery({
    queryKey: qk.serviceFields(form.service_id),
    queryFn: () => getServiceFields(form.service_id),
    enabled: !!form.service_id,
    ...LONG_CACHE,
  })

  const selectedService = useMemo(
    () => services.data?.find((s) => s.id === form.service_id) ?? null,
    [services.data, form.service_id],
  )

  // "Passport Number" reads better than a generic "ID Number" once chosen.
  const idNumberLabel = useMemo(() => {
    const t = ID_TYPES.find((x) => x.value === form.id_type)
    return t ? `${t.label} Number` : 'Document Number'
  }, [form.id_type])

  // ---------- duplicate warning ----------
  const debouncedName = useDebounce(form.full_name, 500)
  const debouncedPhone = useDebounce(form.phone, 500)

  useEffect(() => {
    if (debouncedName.trim().length < 3 && debouncedPhone.trim().length < 6) {
      setDuplicates([])
      return
    }
    let cancelled = false
    findSimilarClients(debouncedName.trim(), debouncedPhone.trim())
      .then((rows) => !cancelled && setDuplicates(rows))
      .catch(() => !cancelled && setDuplicates([]))
    return () => {
      cancelled = true
    }
  }, [debouncedName, debouncedPhone])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const setDetail = (key, value) => {
    setDetails((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Changing service resets the dynamic answers: the old fields no longer exist.
  const handleServiceChange = (id) => {
    setField('service_id', id)
    setDetails({})
  }

  const validate = () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Client name is required.'
    if (!form.phone.trim()) next.phone = 'Phone number is required.'
    else if (form.phone.trim().length < 7) next.phone = 'Enter a valid phone number.'
    if (!form.service_id) next.service_id = 'Choose a service.'
    // A document type without its number is worse than recording neither.
    if (form.id_type && !form.national_id.trim()) {
      next.national_id = 'Enter the number on the document, or clear the type.'
    }

    for (const f of fields.data ?? []) {
      if (f.is_required && !String(details[f.field_key] ?? '').trim()) {
        next[f.field_key] = `${f.label} is required.`
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = useMutation({
    mutationFn: () =>
      createClient({
        client: form,
        details: (fields.data ?? []).map((f) => ({
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          section: f.section,
          display_order: f.display_order,
          value: details[f.field_key],
        })),
      }),
    onSuccess: (data) => {
      toast.success(`Client registered — ${data.registration_no}`)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      navigate(`/clients/${data.id}`)
    },
    onError: (error) => toast.error(friendlyError(error)),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (save.isPending) return // one click, one client
    if (!validate()) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    if (duplicates.length > 0) {
      setDuplicateModal(true)
      return
    }
    save.mutate()
  }

  if (services.isLoading) return <FormSkeleton fields={7} />

  // A clean install has no services yet. Without this the receptionist just
  // sees an empty dropdown and no way to understand why.
  if (!services.data?.length) {
    return (
      <>
        <PageHeader
          title="Register New Client"
          breadcrumbs={[{ label: 'Registration', to: '/registration' }, { label: 'New Client' }]}
        />
        <div className="card border-dashed p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-800">
            No services have been set up yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
            Clients are registered against a service, so an Administrator needs to add
            the office services and their fixed prices before registration can begin.
          </p>
          {isAdmin && (
            <Link to="/admin/services" className="mt-5 inline-block">
              <Button>Set up services</Button>
            </Link>
          )}
        </div>
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title="Register New Client"
        description="Fill in the client details and choose the service they need."
        breadcrumbs={[{ label: 'Registration', to: '/registration' }, { label: 'New Client' }]}
        actions={
          <Button type="submit" icon={Save} size="lg" loading={save.isPending}>
            Save Client
          </Button>
        }
      />

      {duplicates.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              {duplicates.length} similar record{duplicates.length === 1 ? '' : 's'} already exist
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Check this is not the same person before saving.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {duplicates.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-amber-900">{d.full_name}</span>
                  <span className="text-amber-700 tabular">{d.phone}</span>
                  <span className="text-amber-600 tabular">{d.registration_no}</span>
                  <StatusBadge status={d.status} />
                  <span className="text-amber-600">({d.match_reason})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ---------- client ---------- */}
          <div className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserPlus className="h-4 w-4 text-slate-400" /> Client Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Client Name"
                required
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                error={errors.full_name}
                autoFocus
                wrapperClassName="sm:col-span-2"
              />
              <Input
                label="Phone Number"
                required
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                error={errors.phone}
                placeholder="+252 61 000 0000"
              />
              <Select
                label="District"
                placeholder="Choose a district…"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                options={MOGADISHU_DISTRICTS.map((d) => ({ value: d, label: d }))}
                hint="Degmada"
              />
              <Select
                label="Identification"
                placeholder="Choose a document…"
                value={form.id_type}
                onChange={(e) => setField('id_type', e.target.value)}
                options={ID_TYPES.map((t) => ({ value: t.value, label: `${t.label} — ${t.so}` }))}
              />
              <Input
                label={idNumberLabel}
                value={form.national_id}
                onChange={(e) => setField('national_id', e.target.value)}
                error={errors.national_id}
                disabled={!form.id_type}
                placeholder={form.id_type ? undefined : 'Choose a document first'}
                hint={form.id_type ? 'The number on the document' : undefined}
              />
            </div>
          </div>

          {/* ---------- service-specific fields ---------- */}
          {form.service_id && (
            <DynamicServiceFields
              fields={fields.data}
              values={details}
              onChange={setDetail}
              errors={errors}
              loading={fields.isLoading}
            />
          )}
        </div>

        {/* ---------- service + price ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Service</h3>

            <Select
              label="Service"
              required
              placeholder="Choose a service…"
              value={form.service_id}
              onChange={(e) => handleServiceChange(e.target.value)}
              error={errors.service_id}
              options={(services.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.name}${s.category ? ` — ${s.category}` : ''}`,
              }))}
            />

            {selectedService && (
              <>
                <div className="mt-5">
                  <ReadOnlyMoney
                    label="Service Price"
                    value={selectedService.price}
                    symbol={currency}
                    tone="locked"
                  />
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                    Prices are fixed. Only an Administrator can change them.
                  </p>
                </div>

                {selectedService.description && (
                  <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                    {selectedService.description}
                  </p>
                )}

                {selectedService.estimated_time && (
                  <p className="mt-2 text-xs text-slate-400">
                    Usually takes {selectedService.estimated_time}
                  </p>
                )}
              </>
            )}

            <div className="mt-5 flex items-start gap-2 rounded-lg bg-navy-50 px-3 py-2.5 text-xs leading-relaxed text-navy-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Need a discount for this client? Save them first, then open their
                profile and press <strong>Request Discount</strong>. An
                Administrator decides the amount.
              </span>
            </div>

            <Button
              type="submit"
              icon={Save}
              className="mt-5 w-full"
              size="lg"
              loading={save.isPending}
            >
              Save Client
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- duplicate confirmation ---------- */}
      <Modal
        open={duplicateModal}
        onClose={() => setDuplicateModal(false)}
        title="Possible duplicate client"
        description="These records look similar. Register anyway?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateModal(false)}>
              Go back and check
            </Button>
            <Button
              loading={save.isPending}
              onClick={() => {
                setDuplicateModal(false)
                save.mutate()
              }}
            >
              Yes, register anyway
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {duplicates.map((d) => (
            <div key={d.id} className="rounded-lg border border-surface-border px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{d.full_name}</p>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500 tabular">
                {d.phone} · {d.registration_no} · {d.service_name} ·{' '}
                {formatDate(d.registered_at)}
              </p>
              <p className="mt-1 text-xs text-amber-700">{d.match_reason}</p>
            </div>
          ))}
        </div>
      </Modal>
    </form>
  )
}
