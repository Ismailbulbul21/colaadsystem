import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Save, Trash2, Pencil, Plus, Eye, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { Input, Select, Textarea } from '../../components/ui/Field'
import {
  listTemplates, saveTemplate, retireTemplate,
  renderTemplate, placeholdersIn, buildDocumentData,
} from '../../services/notaryTemplateService'
import { listActiveServices } from '../../services/serviceService'
import { friendlyError } from '../../utils/errors'
import { qk, LONG_CACHE } from '../../lib/queryClient'

const blank = () => ({
  code: '', title: '', service_category: '', law_article: '',
  party1_label: 'Dhinaca Koowaad', party2_label: 'Dhinaca Labaad',
  body: '', attestation: '', display_order: 0, is_active: true,
})

/** Sample values so a template can be previewed before it meets a customer. */
const SAMPLE = buildDocumentData({
  document_date: '01/08/2026',
  amount: 30000,
  party1: {
    name: 'Mubarak Abdulkadir Ali', mother_name: 'Sadia Abdi Hassan',
    birthplace: 'Beledweyn', birth: '1994', id_type: 'Baasaboor',
    id_no: 'P01556770', id_authority: 'Laanta Socdaalka Jinsiyadda Soomaaliya',
    phone: '+252615327722',
  },
  party2: {
    name: 'Mariam Yusuf Khaire', mother_name: 'Hasno Siad Hirabe',
    birthplace: 'Mogadishu', birth: '1979-tii', id_type: 'Sugnaan',
    id_no: '762733', id_authority: 'Dowladda Hoose', phone: '+252615327722',
  },
  land: {
    district: 'Hodan', area_name: 'Soonakey', size: '10X15-M', sqm: '150',
    lot_no: '817-K', boundaries: 'Waqooyi Jid, Inta kale dhul dad',
    sabarlog_no: 'LAR-1103-M8JBMP/60', sabarlog_date: '06/07/2026',
  },
  company: { is_company: false },
  reference_no: 'NR132/04321/ON/2026',
}, { template: { law_article: '415' } })

/**
 * The wording of every legal document the office issues.
 *
 * Kept as editable text rather than in code so a phrase can be corrected
 * without a release — and previewed here with sample values, so a mistake is
 * found before a customer is sitting across the desk.
 */
export default function DocumentTemplates() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [retiring, setRetiring] = useState(null)

  const templates = useQuery({ queryKey: ['doc-templates'], queryFn: () => listTemplates() })
  const services = useQuery({
    queryKey: qk.services('active'), queryFn: listActiveServices, ...LONG_CACHE,
  })
  const categories = useMemo(
    () => [...new Set((services.data ?? []).map((s) => s.category))].sort(),
    [services.data],
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['doc-templates'] })

  const retire = useMutation({
    mutationFn: (id) => retireTemplate(id),
    onSuccess: () => { toast.success('Template removed'); setRetiring(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const rows = templates.data ?? []

  return (
    <>
      <PageHeader
        title="Document Templates"
        description="The wording of each legal document. Change a phrase here and every document made afterwards uses it."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Templates' }]}
        actions={<Button icon={Plus} onClick={() => setEditing(blank())}>Add Template</Button>}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Used for</th>
              <th className="px-4 py-3 font-medium">Law article</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">Loading…</td></tr>
            )}
            {!templates.isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">
                No templates yet.
              </td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-800">{t.title}</p>
                  <p className="text-xs text-ink-400">{t.code}</p>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {t.service_category ? `${t.service_category} services` : 'Any service'}
                </td>
                <td className="px-4 py-3">
                  {t.law_article
                    ? <Badge tone="indigo">Qodobka {t.law_article}</Badge>
                    : <span className="text-xs text-ink-400">none</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={t.is_active ? 'emerald' : 'slate'} dot>
                    {t.is_active ? 'Active' : 'Off'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" icon={Eye}
                            onClick={() => setPreviewing(t)}>Preview</Button>
                    <Button size="sm" variant="ghost" icon={Pencil}
                            onClick={() => setEditing({
                              ...t,
                              service_category: t.service_category ?? '',
                              law_article: t.law_article ?? '',
                              party2_label: t.party2_label ?? '',
                            })}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={Trash2}
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setRetiring(t)}>Remove</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TemplateModal template={editing} categories={categories}
                     onClose={() => setEditing(null)}
                     onSaved={() => { setEditing(null); refresh() }} />

      <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />

      <ConfirmDialog
        open={!!retiring}
        title="Remove this template?"
        message={retiring
          ? `"${retiring.title}" will no longer be offered. Documents already issued keep their own wording and are unaffected.`
          : ''}
        confirmLabel="Yes, remove"
        tone="warning"
        loading={retire.isPending}
        onConfirm={() => retire.mutate(retiring.id)}
        onClose={() => setRetiring(null)}
      />
    </>
  )
}

function TemplateModal({ template, categories, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [loadedId, setLoadedId] = useState(null)

  const key = template?.id ?? (template ? 'new' : null)
  if (template && key !== loadedId) { setLoadedId(key); setForm({ ...template }) }
  if (!template && loadedId) { setLoadedId(null); setForm(null) }

  const save = useMutation({
    mutationFn: () => saveTemplate(form),
    onSuccess: () => { toast.success('Template saved'); onSaved() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!template || !form) return null
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const used = placeholdersIn(`${form.body} ${form.attestation}`)

  return (
    <Modal open onClose={onClose} size="lg"
           title={form.id ? `Edit ${form.title}` : 'Add template'}>
      <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Code" required value={form.code} onChange={set('code')}
                 placeholder="beec_dhul" hint="Short name, no spaces" />
          <Input label="Law article" value={form.law_article} onChange={set('law_article')}
                 placeholder="415" hint="Printed in the attestation" />
        </div>
        <Input label="Document title (UJEEDO)" required value={form.title}
               onChange={set('title')} placeholder="HESHIIS BEEC DHUL" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Used for" placeholder="Any service"
                  value={form.service_category} onChange={set('service_category')}
                  options={categories.map((c) => ({ value: c, label: `${c} services` }))} />
          <Input label="Order" type="number" value={form.display_order}
                 onChange={set('display_order')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="First party is called" value={form.party1_label}
                 onChange={set('party1_label')} placeholder="Iska Gadaha Dhulka" />
          <Input label="Second party is called" value={form.party2_label}
                 onChange={set('party2_label')} placeholder="Gataha Dhulka" />
        </div>

        <Textarea label="Document body" required rows={14} value={form.body}
                  onChange={set('body')}
                  hint="Write {{placeholders}} where a value goes" />
        <Textarea label="Attestation (SUGITAANKA)" required rows={5}
                  value={form.attestation} onChange={set('attestation')} />

        {used.length > 0 && (
          <div className="rounded-lg border border-surface-border bg-surface-sunken p-3">
            <p className="mb-1.5 text-xs font-medium text-ink-600">
              Values this template asks for ({used.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {used.map((p) => (
                <code key={p} className="rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-700 dark:bg-navy-950/40 dark:text-navy-200">
                  {p}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Save} loading={save.isPending}
                disabled={!form.code.trim() || !form.title.trim() || !form.body.trim()}
                onClick={() => save.mutate()}>
          Save template
        </Button>
      </div>
    </Modal>
  )
}

/** Fills the template with sample values so wording can be judged on the page. */
function PreviewModal({ template, onClose }) {
  if (!template) return null

  const data = { ...SAMPLE, law_article: template.law_article ?? '' }
  const body = renderTemplate(template.body, data)
  const att = renderTemplate(template.attestation, data)
  const missing = [...new Set([...body.missing, ...att.missing])]

  return (
    <Modal open onClose={onClose} size="lg" title={`Preview — ${template.title}`}>
      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The sample has no value for {missing.map((m) => `«${m}»`).join(', ')}.
            On a real document the officer will be stopped until these are filled.
          </span>
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-lg border border-surface-border bg-white p-6 dark:bg-surface-sunken">
        <p className="mb-4 text-center font-bold underline">UJEEDO : {template.title}</p>
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-800">
          {body.text}
        </p>
        <p className="mt-6 text-center text-sm font-bold">
          SUGITAANKA XAFIISKA NOOTAAYADA COLAAD
        </p>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-800">
          {att.text}
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-400">
        Sample values are shown. The real document uses what the officer enters.
      </p>
    </Modal>
  )
}
