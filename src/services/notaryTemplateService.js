import { supabase } from '../lib/supabaseClient'
import { somaliMoneyWords } from '../utils/somaliNumbers'

/**
 * The wording of each legal document.
 *
 * Templates are rows, not code, so the office can correct a phrase without
 * waiting for a release. The law article lives on the template because it
 * changes with the document — a sale cites 415, a gift 483 — and a wrong
 * article makes the document legally wrong.
 */

const TEMPLATE_COLUMNS =
  'id, code, title, service_category, service_id, law_article, attestation, ' +
  'body, party1_label, party2_label, display_order, is_active, updated_at, updated_by_name'

export async function listTemplates({ includeInactive = true } = {}) {
  let q = supabase
    .from('notary_document_templates')
    .select(TEMPLATE_COLUMNS)
    .is('deleted_at', null)
    .order('display_order')
    .order('title')
  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/** The template a given service should use, or null if none is set up yet. */
export async function templateForService({ serviceId, category }) {
  const all = await listTemplates({ includeInactive: false })
  return (
    all.find((t) => serviceId && t.service_id === serviceId) ||
    all.find((t) => category && t.service_category === category) ||
    null
  )
}

export async function saveTemplate(t) {
  const row = {
    code: t.code.trim(),
    title: t.title.trim(),
    service_category: t.service_category || null,
    service_id: t.service_id || null,
    law_article: t.law_article?.trim() || null,
    body: t.body,
    attestation: t.attestation,
    party1_label: t.party1_label?.trim() || 'Dhinaca Koowaad',
    party2_label: t.party2_label?.trim() || null,
    display_order: Number(t.display_order) || 0,
    is_active: t.is_active !== false,
  }
  const q = t.id
    ? supabase.from('notary_document_templates').update(row).eq('id', t.id)
    : supabase.from('notary_document_templates').insert(row)
  const { error } = await q
  if (error) throw error
}

export async function retireTemplate(id) {
  const { error } = await supabase
    .from('notary_document_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------- rendering

const PLACEHOLDER = /\{\{(\w+)\}\}/g

/**
 * Placeholders that are allowed to come out empty.
 *
 * company_clause is a whole sentence that only belongs on a deed when the
 * land is held by a company. On an ordinary sale it is deliberately nothing,
 * and treating that as an unfilled field left «company_clause» printed on the
 * page and blocked the officer from generating at all.
 */
export const OPTIONAL_PLACEHOLDERS = new Set(['company_clause'])

/** Every placeholder a piece of template text asks for. */
export function placeholdersIn(text) {
  return [...new Set([...(text ?? '').matchAll(PLACEHOLDER)].map((m) => m[1]))]
}

/**
 * Fills a template.
 *
 * A value that is missing is left as «name» rather than blanked. On a legal
 * document a silent gap is far worse than a visible one: the officer can see
 * what still needs filling, and can never hand over a deed that quietly says
 * "ku dhashay , 1990" where a birthplace should be.
 *
 * Returns { text, missing[] } so the screen can refuse to finalise while
 * anything is still outstanding.
 */
export function renderTemplate(text, data, { optional = OPTIONAL_PLACEHOLDERS } = {}) {
  const missing = []
  const filled = (text ?? '').replace(PLACEHOLDER, (_, key) => {
    const value = data?.[key]
    const isBlank = value === undefined || value === null || String(value).trim() === ''

    // An optional clause that is empty is an answer, not an omission.
    if (isBlank && optional.has(key)) return ''

    if (isBlank) {
      missing.push(key)
      return `«${key}»`
    }
    return String(value)
  })
  return { text: filled, missing: [...new Set(missing)] }
}

/**
 * Turns a recorded service into the values a template asks for.
 *
 * The Somali amount is generated here and passed in like any other value, so
 * the officer can overwrite it before finalising — the office asked to be
 * able to correct that line, since it is the one a notary reads aloud.
 */
export function buildDocumentData(service, { office, template } = {}) {
  const p1 = service.party1 ?? {}
  const p2 = service.party2 ?? {}
  const land = service.land ?? {}
  const amount = Number(service.amount) || 0

  return {
    date: service.document_date ?? '',
    office_district: office?.district ?? 'Hodan',
    office_street: office?.street ?? 'Taleex',
    notary_name: service.notary_name ?? office?.notary_name ?? 'Dr. Mohamed Abdi Dahir',
    law_article: template?.law_article ?? '',

    seller_name: p1.name, seller_mother: p1.mother_name,
    seller_birthplace: p1.birthplace, seller_birth: p1.birth,
    seller_id_type: p1.id_type, seller_id_no: p1.id_no,
    seller_id_authority: p1.id_authority, seller_phone: p1.phone,

    buyer_name: p2.name, buyer_mother: p2.mother_name,
    buyer_birthplace: p2.birthplace, buyer_birth: p2.birth,
    buyer_id_type: p2.id_type, buyer_id_no: p2.id_no,
    buyer_id_authority: p2.id_authority, buyer_phone: p2.phone,

    land_district: land.district, land_area_name: land.area_name,
    land_size: land.size, land_sqm: land.sqm, lot_no: land.lot_no,
    land_boundaries: land.boundaries,
    sabarlog_no: land.sabarlog_no, sabarlog_date: land.sabarlog_date,

    amount: amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    // Pre-filled, and overwritable: the office reviews this line by hand.
    amount_words: service.amount_words ?? somaliMoneyWords(amount),

    // Only present when the land belongs to a company, so an ordinary deed
    // does not carry an empty clause.
    company_clause: service.company?.is_company
      ? ` ku qoran magaca Shirkadda ${service.company.name ?? ''}` +
        ` sida ku cad Xeer-hoosaad Aasaaska Shirkadda leh Ref No: ${service.company.deed_no ?? ''}` +
        ` uuna saxiixay ${service.company.notary ?? ''},` +
        ` Lehna Shatti Ganacsi No: ${service.company.licence_no ?? ''},`
      : '',

    reference_no: service.reference_no ?? '',
  }
}
