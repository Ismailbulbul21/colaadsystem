import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertTriangle, UserPlus, Info, FileClock } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Field'
import DynamicServiceFields from '../../components/form/DynamicServiceFields'
import { FormSkeleton } from '../../components/feedback/Skeleton'
import { StatusBadge } from '../../components/ui/Badge'

import { listActiveServices, getServiceFields } from '../../services/serviceService'
import {
  createClient, updateDraft, findSimilarClients, getClient, getClientDetails,
} from '../../services/clientService'
import { supabase } from '../../lib/supabaseClient'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useAuth } from '../../contexts/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { friendlyError } from '../../utils/errors'
import { qk, LONG_CACHE } from '../../lib/queryClient'
import { MOGADISHU_DISTRICTS, ID_TYPES } from '../../constants'
import { formatDate } from '../../utils/format'

const EMPTY = {
  full_name: '',
  mother_name: '',
  date_of_birth: '',
  phone: '',
  id_type: '',
  national_id: '',
  address: '',
  service_id: '',
  original_price: '',
  reference_no: '',
}

export default function NewClient() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currency } = useOfficeSettings()
  const { isAdmin } = useAuth()

  // Present when continuing a saved draft: /registration/draft/:draftId
  const { draftId } = useParams()
  const isEditingDraft = !!draftId
  const [draftLoaded, setDraftLoaded] = useState(false)

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

  // The Ministry reference the office must declare this document under.
  // Suggested, never forced — their numbering is not strictly sequential.
  const nextReference = useQuery({
    queryKey: ['next-moj-reference'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('peek_moj_reference')
      if (error) throw error
      return data
    },
    staleTime: 0,
  })

  useEffect(() => {
    // Only suggest a fresh reference for a NEW registration — a draft already
    // took one when it was first saved and must keep it.
    if (isEditingDraft) return
    if (nextReference.data && !form.reference_no) {
      setForm((f) => (f.reference_no ? f : { ...f, reference_no: nextReference.data }))
    }
  }, [nextReference.data, form.reference_no, isEditingDraft])

  // ---------- continuing a saved draft ----------
  const draft = useQuery({
    queryKey: ['draft', draftId],
    enabled: isEditingDraft,
    queryFn: async () => {
      const [client, rows] = await Promise.all([getClient(draftId), getClientDetails(draftId)])
      return { client, rows }
    },
  })

  useEffect(() => {
    if (!draft.data || draftLoaded) return
    const { client, rows } = draft.data

    setForm({
      full_name: client.full_name ?? '',
      mother_name: client.mother_name ?? '',
      date_of_birth: client.date_of_birth ?? '',
      phone: client.phone ?? '',
      id_type: client.id_type ?? '',
      national_id: client.national_id ?? '',
      address: client.address ?? '',
      service_id: client.service_id ?? '',
      original_price: client.original_price != null ? String(client.original_price) : '',
      reference_no: client.reference_no ?? '',
    })

    // Answers come back keyed by field so the dynamic sections refill.
    setDetails(Object.fromEntries((rows ?? []).map((r) => [r.field_key, r.value])))
    setDraftLoaded(true)
  }, [draft.data, draftLoaded])

  const selectedService = useMemo(
    () => services.data?.find((s) => s.id === form.service_id) ?? null,
    [services.data, form.service_id],
  )

  // Grouped for the dropdown, keeping the order the office listed them in.
  const servicesByCategory = useMemo(() => {
    const groups = new Map()
    for (const s of services.data ?? []) {
      const key = s.category || 'Kale'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    }
    return [...groups.entries()]
  }, [services.data])

  const priceChanged =
    selectedService != null &&
    form.original_price !== '' &&
    Number(form.original_price) !== Number(selectedService.price)

  /**
   * A sale or transfer is between two people, so those services collect the
   * parties instead of one "client". The client row still needs a name and a
   * phone, and Party 1 is the one giving/selling — so that is who it takes.
   */
  const isTwoParty = useMemo(
    () => (fields.data ?? []).some((f) => f.field_key === 'p1_full_name'),
    [fields.data],
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
      // A draft being continued matches itself on name and phone, which would
      // warn the clerk their own unfinished work is a duplicate.
      .then((rows) => !cancelled && setDuplicates(rows.filter((r) => r.id !== draftId)))
      .catch(() => !cancelled && setDuplicates([]))
    return () => {
      cancelled = true
    }
  }, [debouncedName, debouncedPhone, draftId])

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const setDetail = (key, value) => {
    setDetails((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Changing service resets the dynamic answers: the old fields no longer
  // exist. The amount refills from the newly chosen service's price.
  const handleServiceChange = (id) => {
    const svc = services.data?.find((s) => s.id === id)
    setForm((prev) => ({
      ...prev,
      service_id: id,
      original_price: svc ? String(svc.price) : '',
    }))
    setDetails({})
    setErrors({})
  }

  /**
   * A draft is deliberately lenient: the point is to park unfinished work.
   * It still needs a name and a phone, because the client row cannot exist
   * without them, and a service, because the price and reference hang off it.
   */
  const validateDraft = () => {
    const next = {}
    if (!form.service_id) next.service_id = 'Choose a service before saving a draft.'
    const name = isTwoParty ? (details.p1_full_name ?? '') : form.full_name
    const phone = isTwoParty ? (details.p1_phone ?? '') : form.phone
    if (!String(name).trim()) {
      next[isTwoParty ? 'p1_full_name' : 'full_name'] = 'A name is needed even for a draft.'
    }
    if (!String(phone).trim()) {
      next[isTwoParty ? 'p1_phone' : 'phone'] = 'A phone number is needed even for a draft.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const validate = () => {
    const next = {}
    if (!form.service_id) next.service_id = 'Choose a service.'
    if (!form.reference_no.trim()) next.reference_no = 'Enter the ministry reference.'

    if (form.original_price === '' || Number.isNaN(Number(form.original_price))) {
      next.original_price = 'Enter the amount.'
    } else if (Number(form.original_price) < 0) {
      next.original_price = 'The amount cannot be negative.'
    }

    // On a two-party service there is no separate "client" — Party 1 is the
    // client, and those fields are validated with the rest of the section
    // below, so these checks would be asking for the same thing twice.
    if (!isTwoParty) {
      if (!form.full_name.trim()) next.full_name = 'Client name is required.'
      if (!form.phone.trim()) next.phone = 'Phone number is required.'
      else if (form.phone.trim().length < 7) next.phone = 'Enter a valid phone number.'
      // A document type without its number is worse than recording neither.
      if (form.id_type && !form.national_id.trim()) {
        next.national_id = 'Enter the number on the document, or clear the type.'
      }
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
    mutationFn: (status) => {
      const payload = {
        // On a two-party service the client IS Party 1, so the record takes
        // its name, phone and ID from there rather than from a duplicate
        // "Client Information" block the clerk would have to fill twice.
        client: isTwoParty
          ? {
              ...form,
              status,
              full_name: (details.p1_full_name ?? '').trim(),
              phone: (details.p1_phone ?? '').trim(),
              national_id: (details.p1_id_number ?? '').trim() || null,
              id_type: null,
            }
          : { ...form, status },
        details: (fields.data ?? []).map((f) => ({
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          section: f.section,
          display_order: f.display_order,
          value: details[f.field_key],
        })),
      }
      return isEditingDraft
        ? updateDraft({ id: draftId, status, ...payload })
        : createClient(payload)
    },
    onSuccess: (data, status) => {
      toast.success(
        status === 'draft'
          ? `Draft saved — ${data.reference_no ?? data.registration_no}`
          : `Registration completed — ${data.reference_no ?? data.registration_no}`,
      )
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] })
      // Staying on a draft lets the clerk keep working; finishing moves on.
      navigate(status === 'draft' ? '/registration/drafts' : `/clients/${data.id}`)
    },
    onError: (error) => toast.error(friendlyError(error)),
  })

  const handleSaveDraft = () => {
    if (save.isPending) return
    if (!validateDraft()) {
      toast.error('A draft still needs a service, a name and a phone number.')
      return
    }
    save.mutate('draft')
  }

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
    save.mutate("waiting_alt")
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
        title={isEditingDraft ? 'Continue Draft' : 'Register New Client'}
        description={
          isEditingDraft
            ? 'Carry on where you left off. Save it as a draft again, or finish it to send it to Nootaayo.'
            : 'Fill in the client details and choose the service they need.'
        }
        breadcrumbs={
          isEditingDraft
            ? [
                { label: 'Registration', to: '/registration' },
                { label: 'Drafts', to: '/registration/drafts' },
                { label: 'Continue' },
              ]
            : [{ label: 'Registration', to: '/registration' }, { label: 'New Client' }]
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              icon={FileClock}
              size="lg"
              disabled={save.isPending}
              onClick={handleSaveDraft}
            >
              Save as Draft
            </Button>
            <Button type="submit" icon={Save} size="lg" loading={save.isPending}>
              {isEditingDraft ? 'Complete Registration' : 'Save Client'}
            </Button>
          </>
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
          {/* ---------- client ----------
              Hidden for sales and transfers: those are between two people, so
              the two party sections below replace this rather than asking for
              the same person twice. */}
          <div className={clsx('card p-6', isTwoParty && 'hidden')}>
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
                label="Magaca hooyada"
                value={form.mother_name}
                onChange={(e) => setField('mother_name', e.target.value)}
                hint="Mother's name"
              />
              <Input
                label="Taariikhda dhalashada"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
                hint="Date of birth"
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
                options={ID_TYPES}
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

            {/* Grouped by category so a clerk can jump straight to the group
                they want. Several categories contain a type called "Nooc
                kale", so the group heading is what tells them apart. */}
            <Select
              label="Service"
              required
              placeholder="Choose a service…"
              value={form.service_id}
              onChange={(e) => handleServiceChange(e.target.value)}
              error={errors.service_id}
            >
              {servicesByCategory.map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {/* Name only. The price belongs in the Amount box below,
                      which still fills from this choice. */}
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>

            <div className="mt-4">
              <Input
                label="Reference"
                required
                value={form.reference_no}
                onChange={(e) => setField('reference_no', e.target.value)}
                error={errors.reference_no}
                placeholder={nextReference.data ?? 'NR132/…/2026'}
                hint="Ministry reference — change it if the ministry issued a different one"
              />
            </div>

            {/* Always in the same place, so choosing a service does not make
                the panel jump. Empty and disabled until a service is picked,
                then filled with its price and editable. */}
            <div className="mt-5">
              <Input
                label="Amount"
                required
                type="number"
                step="0.01"
                min="0"
                value={form.original_price}
                onChange={(e) => setField('original_price', e.target.value)}
                error={errors.original_price}
                disabled={!selectedService}
                placeholder={selectedService ? undefined : 'Choose a service first'}
                hint={
                  !selectedService
                    ? 'Appears once you choose a service'
                    : priceChanged
                      ? `List price is ${currency}${Number(selectedService.price).toFixed(2)}`
                      : 'Filled from the service price — change it if needed'
                }
              />
            </div>

            {selectedService && (
              <>
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
              {isEditingDraft ? 'Complete Registration' : 'Save Client'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              icon={FileClock}
              className="mt-2 w-full"
              disabled={save.isPending}
              onClick={handleSaveDraft}
            >
              Save as Draft
            </Button>
            <p className="mt-2 text-center text-2xs leading-snug text-ink-400">
              A draft is not sent to Nootaayo and cannot be paid for until you finish it.
            </p>
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
                save.mutate("waiting_alt")
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
