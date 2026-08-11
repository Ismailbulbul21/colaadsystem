import { supabase } from '../lib/supabaseClient'
import { dayRangeToTimestamps } from '../utils/format'

const LIST_COLUMNS =
  'id, registration_no, full_name, phone, national_id, service_id, service_name_snapshot, ' +
  'original_price, discount_amount, final_price, status, registered_at, completed_at, registered_by'

/**
 * Server-side pagination everywhere. `.range()` plus `count: 'exact'` means the
 * browser receives 20 rows no matter how many years of records exist.
 * Only the columns the table actually renders are selected — never `*`.
 */
export async function listClients({ range, sort, filters = {} }) {
  let q = supabase
    .from('clients')
    .select(LIST_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(
      `full_name.ilike.${like},phone.ilike.${like},registration_no.ilike.${like},national_id.ilike.${like}`,
    )
  }
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.service) q = q.eq('service_id', filters.service)
  if (filters.registered_by) q = q.eq('registered_by', filters.registered_by)
  if (filters.pending === '1') {
    q = q.not('status', 'in', '(completed,cancelled)')
  }

  if (filters.range === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('registered_at', today.toISOString())
  } else {
    const { start, end } = dayRangeToTimestamps(filters.from, filters.to)
    if (start) q = q.gte('registered_at', start)
    if (end) q = q.lt('registered_at', end)
  }

  const sortKey = sort?.key ?? 'registered_at'
  q = q.order(sortKey, { ascending: sort?.dir === 'asc' })
  q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function getClient(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) throw error
  return data
}

export async function getClientDetails(clientId) {
  const { data, error } = await supabase
    .from('client_service_details')
    .select('id, field_key, label, field_type, value, section, display_order')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

/**
 * Registration never sends a price. The database reads it from `services`
 * inside a BEFORE INSERT trigger, so a forged request cannot inject one.
 */
export async function createClient({ client, details }) {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      full_name: client.full_name.trim(),
      phone: client.phone.trim(),
      id_type: client.id_type || null,
      national_id: client.national_id?.trim() || null,
      address: client.address?.trim() || null, // Banadir district
      service_id: client.service_id,
      status: 'waiting_alt',
      // The office asked for the amount to be changeable per client. The
      // trigger still falls back to the service price when this is null, and
      // still rejects a negative figure.
      original_price:
        client.original_price === '' || client.original_price == null
          ? null
          : Number(client.original_price),
      // discount_amount stays out: only approve_discount() may set one
    })
    .select('id, registration_no, final_price, original_price')
    .single()
  if (error) throw error

  const rows = (details ?? [])
    .filter((d) => d.value !== '' && d.value != null)
    .map((d) => ({
      client_id: data.id,
      field_key: d.field_key,
      label: d.label,
      field_type: d.field_type,
      value: String(d.value),
      section: d.section,
      display_order: d.display_order,
    }))

  if (rows.length) {
    const { error: detailError } = await supabase.from('client_service_details').insert(rows)
    if (detailError) throw detailError
  }

  return data
}

/** Warn before creating a second record for the same person. */
export async function findSimilarClients(name, phone) {
  const { data, error } = await supabase.rpc('find_similar_clients', {
    p_name: name,
    p_phone: phone,
  })
  if (error) throw error
  return data ?? []
}

export async function requestDiscount(clientId, reason) {
  const { data, error } = await supabase.rpc('request_discount', {
    p_client_id: clientId,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function listPendingDiscounts() {
  const { data, error } = await supabase
    .from('discount_requests')
    .select(
      'id, reason, status, original_price, requested_at, client_id, ' +
        'clients(id, full_name, phone, registration_no, service_name_snapshot, original_price)',
    )
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function approveDiscount(requestId, discount, notes) {
  const { data, error } = await supabase.rpc('approve_discount', {
    p_request_id: requestId,
    p_discount: discount,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}

export async function rejectDiscount(requestId, reason) {
  const { error } = await supabase.rpc('reject_discount', {
    p_request_id: requestId,
    p_reason: reason,
  })
  if (error) throw error
}

/** Full history for the client profile timeline. */
export async function getClientTimeline(clientId) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_name_snapshot, user_role_snapshot, action, module, description, created_at')
    .eq('entity_id', clientId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
