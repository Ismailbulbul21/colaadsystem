import { supabase } from '../lib/supabaseClient'

/**
 * A notary service from customer to finished document.
 *
 * A draft costs nothing — no reference is taken until the officer finalises,
 * so an abandoned service never burns a number out of the office's paper
 * series. Finalising freezes the fees and the wording onto the row and locks
 * it: a deed that could change after the parties signed would be worthless.
 */

const COLUMNS =
  'id, reference_no, service_id, service_name, service_category, template_id, ' +
  'template_code, document_date, customer_name, customer_phone, notary_name, ' +
  'party1, party2, agent, land, company, witnesses, amount, amount_words, ' +
  'fee_lines, total_fees, status, document_title, law_article, document_text, ' +
  'attestation_text, finalized_at, finalized_by_name, created_by_name, ' +
  'created_at, updated_at'

export async function listServices({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('notary_services')
    .select(COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(
      `reference_no.ilike.${like},customer_name.ilike.${like},service_name.ilike.${like}`,
    )
  }
  if (filters.from) q = q.gte('document_date', filters.from)
  if (filters.to) q = q.lte('document_date', filters.to)

  q = q
    .order(sort?.key ?? 'updated_at', { ascending: sort?.dir === 'asc' })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function getService(id) {
  const { data, error } = await supabase
    .from('notary_services').select(COLUMNS).eq('id', id).single()
  if (error) throw error
  return data
}

/** Saves whatever has been typed so far. Returns the id and the chosen template. */
export async function saveDraft({ id, serviceId, templateId, form }) {
  const { data, error } = await supabase.rpc('save_notary_service', {
    p_id: id ?? null,
    p_service_id: serviceId,
    // The officer's choice, when a service has more than one document type.
    p_template_id: templateId ?? null,
    p_payload: {
      document_date: form.document_date || null,
      customer_name: form.customer_name?.trim() || null,
      customer_phone: form.customer_phone?.trim() || null,
      notary_name: form.notary_name?.trim() || null,
      party1: form.party1 ?? {},
      party2: form.party2 ?? {},
      agent: form.agent ?? {},
      land: form.land ?? {},
      company: form.company ?? {},
      witnesses: (form.witnesses ?? []).filter((w) => w?.trim?.()),
      amount: Number(form.amount) || 0,
      amount_words: form.amount_words ?? null,
    },
  })
  if (error) throw error
  return data
}

/**
 * Takes the reference, freezes the fees and the wording, locks the record.
 * The rendered text is sent up rather than rebuilt here so that what the
 * officer approved on screen is exactly what is stored.
 */
export async function finalizeService({ id, documentText, attestationText }) {
  const { data, error } = await supabase.rpc('finalize_notary_service', {
    p_id: id,
    p_document_text: documentText,
    p_attestation_text: attestationText,
  })
  if (error) throw error
  return data
}

export async function cancelService(id, reason) {
  const { data, error } = await supabase.rpc('cancel_notary_service', {
    p_id: id, p_reason: reason ?? null,
  })
  if (error) throw error
  return data
}
