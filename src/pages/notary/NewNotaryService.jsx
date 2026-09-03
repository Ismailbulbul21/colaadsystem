import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Check, ChevronRight, ChevronLeft, Save, Printer, FileCheck2, User, Users,
  MapPin, Calculator, FileText, AlertTriangle, Plus, X, ArrowLeft, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useDebounce } from '../../hooks/useDebounce'
import NotaryDocument from '../../components/notary/NotaryDocument'
import { listActiveServices } from '../../services/serviceService'
import { calculateFees } from '../../services/notaryFeeService'
import {
  listTemplates, renderTemplate, buildDocumentData,
} from '../../services/notaryTemplateService'
import {
  saveDraft, finalizeService, getService,
} from '../../services/notaryServiceService'
import { somaliMoneyWords } from '../../utils/somaliNumbers'
import { friendlyError } from '../../utils/errors'
import { qk, LONG_CACHE } from '../../lib/queryClient'

const STEPS = [
  { key: 'customer', label: 'Customer Information', icon: User },
  { key: 'service',  label: 'Select Service',       icon: FileText },
  { key: 'details',  label: 'Fill Details',         icon: Users },
  { key: 'fees',     label: 'Fee Calculation',      icon: Calculator },
  { key: 'preview',  label: 'Preview & Generate',   icon: FileCheck2 },
]

const ID_TYPES = ['Aqoonsi Qaran', 'Baasaboor', 'Sugnaan', 'Aqoonsi']
const ID_AUTHORITIES = [
  'Hayadda NIRA',
  'Laanta Socdaalka iyo Jinsiyadda Soomaaliya',
  'Dowladda Hoose ee Muqdisho',
]

const emptyParty = () => ({
  name: '', mother_name: '', birthplace: '', birth: '',
  id_type: 'Aqoonsi Qaran', id_no: '', id_authority: 'Hayadda NIRA',
  phone: '', address: '',
})

const blank = () => ({
  document_date: new Date().toISOString().slice(0, 10),
  customer_name: '', customer_phone: '', notary_name: 'Dr. Mohamed Abdi Dahir',
  service_id: '',
  party1: emptyParty(), party2: emptyParty(),
  agent: { has_agent: false, name: '', id_no: '', phone: '' },
  land: {
    district: '', area_name: '', size: '', sqm: '', lot_no: '',
    boundaries: '', sabarlog_no: '', sabarlog_date: '',
    previous_ref: '', previous_ref_date: '', other: '',
  },
  company: { is_company: false, name: '', deed_no: '', notary: '', licence_no: '' },
  witnesses: ['', '', ''],
  amount: '', amount_words: '',
})

/**
 * One officer, one workflow: customer, service, details, fees, document.
 *
 * The officer never calculates a fee and never opens Word. Editing means
 * going back a step and regenerating, so the stored document and the stored
 * data can never drift apart.
 */
export default function NewNotaryService() {
  const { serviceId: draftId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { settings, money } = useOfficeSettings()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(blank())
  const [savedId, setSavedId] = useState(draftId ?? null)
  const [loadedId, setLoadedId] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [wordsTouched, setWordsTouched] = useState(false)

  const services = useQuery({
    queryKey: qk.services('active'), queryFn: listActiveServices, ...LONG_CACHE,
  })
  const templates = useQuery({ queryKey: ['doc-templates'], queryFn: () => listTemplates() })

  // Reopen a draft the officer saved earlier.
  const existing = useQuery({
    queryKey: ['notary-service', draftId],
    queryFn: () => getService(draftId),
    enabled: !!draftId,
  })
  if (existing.data && existing.data.id !== loadedId) {
    setLoadedId(existing.data.id)
    const d = existing.data
    setForm({
      ...blank(),
      document_date: d.document_date,
      customer_name: d.customer_name ?? '', customer_phone: d.customer_phone ?? '',
      notary_name: d.notary_name ?? 'Dr. Mohamed Abdi Dahir',
      service_id: d.service_id ?? '',
      party1: { ...emptyParty(), ...(d.party1 ?? {}) },
      party2: { ...emptyParty(), ...(d.party2 ?? {}) },
      agent: { has_agent: false, name: '', id_no: '', phone: '', ...(d.agent ?? {}) },
      land: { ...blank().land, ...(d.land ?? {}) },
      company: { ...blank().company, ...(d.company ?? {}) },
      witnesses: (d.witnesses ?? []).length ? d.witnesses : ['', '', ''],
      amount: d.amount ?? '', amount_words: d.amount_words ?? '',
    })
    if (d.status === 'final') setFinalResult({ reference_no: d.reference_no, frozen: d })
  }

  const service = useMemo(
    () => (services.data ?? []).find((s) => s.id === form.service_id),
    [services.data, form.service_id],
  )

  const template = useMemo(() => {
    const all = (templates.data ?? []).filter((t) => t.is_active)
    return all.find((t) => t.service_id === form.service_id)
        || all.find((t) => t.service_category === service?.category)
        || null
  }, [templates.data, form.service_id, service?.category])

  // Fees come from the database so the screen, the document and Finance
  // cannot each arrive at a different figure.
  const debouncedAmount = useDebounce(String(form.amount), 400)
  const fees = useQuery({
    queryKey: ['notary-fees', debouncedAmount, service?.category],
    queryFn: () => calculateFees(debouncedAmount, service?.category ?? null),
    enabled: debouncedAmount !== '' && Number(debouncedAmount) >= 0,
  })

  const autoWords = somaliMoneyWords(Number(form.amount) || 0)
  const amountWords = wordsTouched && form.amount_words ? form.amount_words : autoWords

  const rendered = useMemo(() => {
    if (!template) return null
    const data = buildDocumentData(
      {
        document_date: new Date(form.document_date).toLocaleDateString('en-GB'),
        amount: Number(form.amount) || 0,
        amount_words: amountWords,
        notary_name: form.notary_name,
        party1: form.party1, party2: form.party2,
        land: form.land, company: form.company, agent: form.agent,
        reference_no: finalResult?.reference_no,
      },
      {
        template,
        office: {
          district: settings?.district ?? 'Hodan',
          street: settings?.street ?? 'Taleex',
          notary_name: form.notary_name,
        },
      },
    )
    const body = renderTemplate(template.body, data)
    const att = renderTemplate(template.attestation, data)
    return {
      body: body.text, attestation: att.text,
      missing: [...new Set([...body.missing, ...att.missing])],
    }
  }, [template, form, amountWords, settings, finalResult])

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const setIn = (section, k) => (e) =>
    setForm((p) => ({ ...p, [section]: { ...p[section], [k]: e.target.value } }))

  const save = useMutation({
    mutationFn: () => saveDraft({ id: savedId, serviceId: form.service_id, form: { ...form, amount_words: amountWords } }),
    onSuccess: (d) => {
      setSavedId(d.id)
      toast.success('Draft saved')
      queryClient.invalidateQueries({ queryKey: ['notary-services'] })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const finalize = useMutation({
    mutationFn: async () => {
      let id = savedId
      if (!id) {
        const d = await saveDraft({ id: null, serviceId: form.service_id, form: { ...form, amount_words: amountWords } })
        id = d.id
        setSavedId(id)
      } else {
        await saveDraft({ id, serviceId: form.service_id, form: { ...form, amount_words: amountWords } })
      }
      return finalizeService({
        id,
        documentText: rendered.body,
        attestationText: rendered.attestation,
      })
    },
    onSuccess: (d) => {
      setFinalResult(d)
      toast.success(`Document generated — ${d.reference_no}`)
      queryClient.invalidateQueries({ queryKey: ['notary-services'] })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const canLeave = (i) => {
    if (i === 0) return !!form.customer_name.trim()
    if (i === 1) return !!form.service_id
    if (i === 2) return !!form.party1.name.trim()
    return true
  }
  const go = (i) => {
    for (let s = 0; s < i; s += 1) {
      if (!canLeave(s)) { setStep(s); toast.error('Finish this step first.'); return }
    }
    setStep(i)
  }

  const isFinal = !!finalResult

  return (
    <>
      <PageHeader
        title={isFinal ? 'Document Generated' : 'New Notary Service'}
        description={isFinal
          ? 'The document is finalised and locked. It can be printed or saved as PDF.'
          : 'Customer, service, details, fees, document — one officer, one workflow.'}
        breadcrumbs={[{ label: 'Notary Services', to: '/notary' }, { label: 'New' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/notary"><Button variant="secondary" icon={ArrowLeft}>Back</Button></Link>
            {!isFinal && (
              <Button variant="secondary" icon={Save} loading={save.isPending}
                      disabled={!form.service_id}
                      onClick={() => save.mutate()}>Save Draft</Button>
            )}
          </div>
        }
      />

      {/* ---------------- stepper ---------------- */}
      <div className="mb-5 card p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button key={s.key} type="button" onClick={() => go(i)}
                    disabled={isFinal && i < 4}
                    className="flex flex-1 items-center gap-2 whitespace-nowrap disabled:cursor-default">
              <span className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < step || isFinal ? 'bg-emerald-600 text-white'
                  : i === step ? 'bg-navy-800 text-white'
                  : 'bg-ink-100 text-ink-500',
              )}>
                {i < step || isFinal ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={clsx('hidden text-xs font-medium sm:block',
                i === step ? 'text-navy-800' : 'text-ink-500')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-surface-border" />}
            </button>
          ))}
        </div>
      </div>

      {/* ================= step 1 ================= */}
      {step === 0 && !isFinal && (
        <div className="card p-6">
          <h3 className="mb-1 text-sm font-semibold text-ink-800">Customer Information</h3>
          <p className="mb-5 text-[13px] text-ink-500">Who has come to the office.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Customer Name" required value={form.customer_name}
                   onChange={set('customer_name')} />
            <Input label="Phone Number" value={form.customer_phone}
                   onChange={set('customer_phone')} />
            <Input label="Date" required type="date" value={form.document_date}
                   onChange={set('document_date')} />
            <Input label="Notary / Staff" value={form.notary_name}
                   onChange={set('notary_name')}
                   hint="Signs the attestation" />
          </div>
        </div>
      )}

      {/* ================= step 2 ================= */}
      {step === 1 && !isFinal && (
        <div className="card p-6">
          <h3 className="mb-1 text-sm font-semibold text-ink-800">Select Service</h3>
          <p className="mb-5 text-[13px] text-ink-500">
            Dooro adeegga. The service decides the form and the document wording.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(services.data ?? []).map((s) => {
              const chosen = form.service_id === s.id
              return (
                <button key={s.id} type="button"
                        onClick={() => setForm((p) => ({ ...p, service_id: s.id }))}
                        className={clsx(
                          'rounded-xl border p-4 text-left transition-colors',
                          chosen
                            ? 'border-navy-500 bg-navy-50/60 dark:bg-navy-950/20'
                            : 'border-surface-border hover:border-navy-300',
                        )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-800">{s.name}</p>
                      <p className="text-xs text-ink-500">{s.category}</p>
                    </div>
                    {chosen && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  </div>
                </button>
              )
            })}
          </div>

          {form.service_id && (
            <div className={clsx(
              'mt-5 rounded-lg border p-3 text-xs',
              template
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200',
            )}>
              {template
                ? <>Document: <strong>{template.title}</strong>
                    {template.law_article && <> · Qodobka {template.law_article}</>}</>
                : <>No template is set up for this service yet, so a document cannot be
                   generated. An Administrator can add one under Templates.</>}
            </div>
          )}
        </div>
      )}

      {/* ================= step 3 ================= */}
      {step === 2 && !isFinal && (
        <DetailsStep form={form} setForm={setForm} setIn={setIn} template={template} />
      )}

      {/* ================= step 4 ================= */}
      {step === 3 && !isFinal && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Transaction Amount</h3>
            <p className="mb-5 text-[13px] text-ink-500">
              Type the amount. The system works out every fee.
            </p>
            <div className="space-y-4">
              <Input label="Amount (USD)" required type="number" min="0" step="0.01"
                     value={form.amount} onChange={set('amount')} />
              <div>
                <Textarea
                  label="Amount in Somali words" rows={2}
                  value={amountWords}
                  onChange={(e) => { setWordsTouched(true); setForm((p) => ({ ...p, amount_words: e.target.value })) }}
                  hint="Written for you — correct it if the notary prefers different wording"
                />
                {wordsTouched && (
                  <button type="button"
                          className="mt-1 text-xs text-navy-700 underline"
                          onClick={() => { setWordsTouched(false); setForm((p) => ({ ...p, amount_words: '' })) }}>
                    Use the automatic wording again
                  </button>
                )}
              </div>
            </div>
          </div>

          <FeeTable fees={fees.data} money={money} loading={fees.isLoading} />
        </div>
      )}

      {/* ================= step 5 ================= */}
      {(step === 4 || isFinal) && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isFinal ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Finalised as <strong>{finalResult.reference_no}</strong>. The wording is
                  locked and cannot be changed — cancel and reissue if it is wrong.
                </span>
              </div>
            ) : rendered?.missing?.length ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Still empty: {rendered.missing.map((m) => `«${m}»`).join(', ')}.
                  Go back and fill these — the document cannot be generated with gaps in it.
                </span>
              </div>
            ) : null}

            <div className="card overflow-auto p-0 print:border-0 print:shadow-none">
              {template && rendered ? (
                <NotaryDocument
                  title={template.title}
                  bodyText={rendered.body}
                  attestationText={rendered.attestation}
                  service={{
                    ...form,
                    party1_label: template.party1_label,
                    party2_label: template.party2_label,
                  }}
                  reference={finalResult?.reference_no ?? '(taken when you generate)'}
                  notaryName={form.notary_name}
                />
              ) : (
                <p className="p-8 text-center text-sm text-ink-400">
                  Choose a service with a template to see the document.
                </p>
              )}
            </div>
          </div>

          <div className="no-print space-y-4">
            <FeeTable fees={fees.data} money={money} loading={fees.isLoading} compact />

            <div className="card p-5">
              {isFinal ? (
                <div className="space-y-2">
                  <Button icon={Printer} className="w-full" onClick={() => window.print()}>
                    Print Document
                  </Button>
                  <Button variant="secondary" className="w-full"
                          onClick={() => navigate('/notary/new')}>
                    New Notary Service
                  </Button>
                  <Button variant="secondary" className="w-full"
                          onClick={() => navigate('/notary')}>
                    All Services
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs leading-relaxed text-ink-500">
                    Generating takes the next reference number and locks the wording.
                    Check the document first.
                  </p>
                  <Button icon={FileCheck2} className="w-full" variant="success"
                          loading={finalize.isPending}
                          disabled={!template || !rendered || rendered.missing.length > 0
                                    || !form.party1.name?.trim()}
                          onClick={() => finalize.mutate()}>
                    Generate Document
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- step buttons ---------------- */}
      {!isFinal && (
        <div className="no-print mt-5 flex items-center justify-between">
          <Button variant="secondary" icon={ChevronLeft}
                  disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Previous
          </Button>
          <Button iconRight={ChevronRight}
                  disabled={step === STEPS.length - 1 || !canLeave(step)}
                  onClick={() => go(step + 1)}>
            Next: {STEPS[Math.min(step + 1, STEPS.length - 1)].label}
          </Button>
        </div>
      )}
    </>
  )
}

/* --------------------------------------------------------------- step 3 */

function DetailsStep({ form, setForm, setIn, template }) {
  const witnesses = form.witnesses

  const setWitness = (i) => (e) =>
    setForm((p) => {
      const w = [...p.witnesses]; w[i] = e.target.value; return { ...p, witnesses: w }
    })

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <PartyCard title={`A. ${template?.party1_label ?? 'Dhinaca Koowaad'}`}
                   party={form.party1} section="party1" setIn={setIn} required />
        <PartyCard title={`B. ${template?.party2_label ?? 'Dhinaca Labaad'}`}
                   party={form.party2} section="party2" setIn={setIn} />
      </div>

      <div className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-800">
          <MapPin className="h-4 w-4 text-ink-400" /> C. Faahfaahinta Dhulka
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Degmada" value={form.land.district} onChange={setIn('land','district')} />
          <Input label="Gaar ahaan" value={form.land.area_name} onChange={setIn('land','area_name')}
                 placeholder="Soonakey" />
          <Input label="Lotto No" value={form.land.lot_no} onChange={setIn('land','lot_no')}
                 placeholder="817-K" />
          <Input label="Cabirka" value={form.land.size} onChange={setIn('land','size')}
                 placeholder="10X15-M" />
          <Input label="Cabbirka MQ" value={form.land.sqm} onChange={setIn('land','sqm')}
                 placeholder="150" />
          <Input label="Sabarlog No" value={form.land.sabarlog_no}
                 onChange={setIn('land','sabarlog_no')} placeholder="LAR-1103-M8JBMP/60" />
          <Input label="Taariikhda Sabarlogga" value={form.land.sabarlog_date}
                 onChange={setIn('land','sabarlog_date')} placeholder="06/07/2026" />
          <Input label="Reference hore" value={form.land.previous_ref}
                 onChange={setIn('land','previous_ref')} placeholder="NR132/01667/ON/2025"
                 hint="Deedka hore" />
          <Input label="Taariikhda Ref hore" value={form.land.previous_ref_date}
                 onChange={setIn('land','previous_ref_date')} placeholder="25/01/2025" />
          <Input label="Jihooyinka" value={form.land.boundaries}
                 onChange={setIn('land','boundaries')}
                 placeholder="Waqooyi Jid, Inta kale dhul dad"
                 wrapperClassName="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink-800">D. Maragyada</h3>
          <div className="space-y-3">
            {witnesses.map((w, i) => (
              <Input key={i} label={`Marag ${i + 1}${i === 2 ? ' (ikhtiyaari)' : ''}`}
                     value={w} onChange={setWitness(i)} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-800">
              <input type="checkbox" checked={!!form.agent.has_agent}
                     onChange={(e) => setForm((p) => ({ ...p, agent: { ...p.agent, has_agent: e.target.checked } }))}
                     className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
              E. Wakiil ma jiraa?
            </label>
            {form.agent.has_agent && (
              <div className="mt-4 space-y-3">
                <Input label="Magaca Wakiilka" value={form.agent.name} onChange={setIn('agent','name')} />
                <Input label="Aqoonsiga" value={form.agent.id_no} onChange={setIn('agent','id_no')} />
                <Input label="Taleefanka" value={form.agent.phone} onChange={setIn('agent','phone')} />
              </div>
            )}
          </div>

          <div className="card p-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-800">
              <input type="checkbox" checked={!!form.company.is_company}
                     onChange={(e) => setForm((p) => ({ ...p, company: { ...p.company, is_company: e.target.checked } }))}
                     className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
              F. Dhulka shirkad ma leedahay?
            </label>
            {form.company.is_company && (
              <div className="mt-4 space-y-3">
                <Input label="Magaca Shirkadda" value={form.company.name} onChange={setIn('company','name')} />
                <Input label="Xeer-hoosaadka Aasaaska" value={form.company.deed_no}
                       onChange={setIn('company','deed_no')} placeholder="4487/XNSH/24" />
                <Input label="Dr-ka Saxiixay" value={form.company.notary} onChange={setIn('company','notary')} />
                <Input label="Shatiga Ganacsiga" value={form.company.licence_no}
                       onChange={setIn('company','licence_no')} placeholder="P4JSERW" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PartyCard({ title, party, section, setIn, required }) {
  return (
    <div className="card p-6">
      <h3 className="mb-4 text-sm font-semibold text-ink-800">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Magaca" required={required} value={party.name}
               onChange={setIn(section,'name')} wrapperClassName="sm:col-span-2" />
        <Input label="Magaca Hooyada (ina)" value={party.mother_name}
               onChange={setIn(section,'mother_name')} />
        <Input label="Goobta Dhalashada" value={party.birthplace}
               onChange={setIn(section,'birthplace')} placeholder="Mogadishu" />
        <Input label="Sanadka Dhalashada" value={party.birth}
               onChange={setIn(section,'birth')} placeholder="1990-kii" />
        <Select label="Nooca Aqoonsiga" value={party.id_type} onChange={setIn(section,'id_type')}
                options={ID_TYPES.map((t) => ({ value: t, label: t }))} />
        <Input label="Lambarka Aqoonsiga" value={party.id_no} onChange={setIn(section,'id_no')} />
        <Select label="Kasoo baxay" value={party.id_authority}
                onChange={setIn(section,'id_authority')}
                options={ID_AUTHORITIES.map((a) => ({ value: a, label: a }))} />
        <Input label="Taleefanka" value={party.phone} onChange={setIn(section,'phone')} />
        <Input label="Cinwaanka" value={party.address} onChange={setIn(section,'address')} />
      </div>
    </div>
  )
}

function FeeTable({ fees, money, loading, compact }) {
  return (
    <div className="card p-6">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Calculator className="h-4 w-4 text-ink-400" /> Fees
      </h3>
      <p className="mb-4 text-[13px] text-ink-500">Worked out from the rules in Settings.</p>

      {loading && <p className="text-sm text-ink-400">Calculating…</p>}
      {!loading && !fees && <p className="text-sm text-ink-400">Enter an amount.</p>}

      {fees && (
        <>
          <table className="w-full text-sm">
            <tbody>
              {(fees.lines ?? []).map((l) => (
                <tr key={l.rule_id} className="border-b border-surface-border">
                  <td className="py-1.5 text-ink-700">{l.category}</td>
                  <td className="py-1.5 text-xs text-ink-400">
                    {l.rule_type === 'percentage'
                      ? `${Number(l.rule_value)}%` : 'fixed'}
                  </td>
                  <td className="py-1.5 text-right tabular">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2" colSpan={2}>Total fees</td>
                <td className="py-2 text-right tabular text-navy-800">{money(fees.total_fees)}</td>
              </tr>
            </tbody>
          </table>

          {!compact && (
            <div className="mt-4 rounded-lg border border-surface-border bg-surface-sunken p-3 text-xs leading-relaxed text-ink-500">
              Customer pays <strong>{money(fees.grand_total)}</strong> altogether.
              Only the <strong>{money(fees.total_fees)}</strong> in fees is office
              income — the {money(fees.amount)} passes between the two parties.
            </div>
          )}
        </>
      )}
    </div>
  )
}
