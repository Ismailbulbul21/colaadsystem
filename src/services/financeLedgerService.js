import { supabase } from '../lib/supabaseClient'

/**
 * The daily cash book — money in, money out, one row each.
 *
 * Separate from payments/receipts on purpose: this is typed by hand and can
 * be corrected, whereas a receipt must stay identical to the one handed to
 * the client on the day.
 */

const TXN_COLUMNS =
  'id, txn_date, kind, type_id, type_name, amount, method_id, method_name, ' +
  'method_bucket, counterparty, notary_ref, description, handled_by, ' +
  'file_path, file_name, file_size, created_by_name, updated_by_name, created_at'

/** Everything the dashboard and the daily report show, counted in the database. */
export async function financeSummary(date) {
  const { data, error } = await supabase.rpc('finance_summary', {
    p_date: date ?? null,
  })
  if (error) throw error
  return data
}

export async function listTransactions({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('finance_transactions')
    .select(TXN_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.kind) q = q.eq('kind', filters.kind)
  if (filters.from) q = q.gte('txn_date', filters.from)
  if (filters.to) q = q.lte('txn_date', filters.to)
  if (filters.ref) q = q.ilike('notary_ref', `%${filters.ref}%`)
  if (filters.who) q = q.ilike('counterparty', `%${filters.who}%`)
  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(
      `description.ilike.${like},counterparty.ilike.${like},` +
      `notary_ref.ilike.${like},type_name.ilike.${like}`,
    )
  }

  q = q
    .order(sort?.key ?? 'txn_date', { ascending: sort?.dir === 'asc' })
    .order('created_at', { ascending: false })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function addTransaction(kind, form) {
  const { data, error } = await supabase.rpc('add_finance_transaction', {
    p_kind: kind,
    p_txn_date: form.txn_date,
    p_type_id: form.type_id,
    p_amount: Number(form.amount),
    p_method_id: form.method_id,
    p_counterparty: form.counterparty?.trim() || null,
    p_description: form.description?.trim() || null,
    p_handled_by: form.handled_by?.trim() || null,
    p_notary_ref: form.notary_ref?.trim() || null,
    p_file_path: form.file_path ?? null,
    p_file_name: form.file_name ?? null,
    p_file_size: form.file_size ?? null,
  })
  if (error) throw error
  return data
}

export async function updateTransaction(id, form) {
  const { data, error } = await supabase.rpc('update_finance_transaction', {
    p_id: id,
    p_txn_date: form.txn_date,
    p_type_id: form.type_id,
    p_amount: Number(form.amount),
    p_method_id: form.method_id,
    p_counterparty: form.counterparty?.trim() || null,
    p_description: form.description?.trim() || null,
    p_handled_by: form.handled_by?.trim() || null,
    p_notary_ref: form.notary_ref?.trim() || null,
  })
  if (error) throw error
  return data
}

/** Hides the row rather than destroying it, so the ledger stays reconstructable. */
export async function deleteTransaction(id) {
  const { data, error } = await supabase.rpc('delete_finance_transaction', { p_id: id })
  if (error) throw error
  return data
}

// ------------------------------------------------------------ managed lists

export async function listTypes(kind) {
  let q = supabase
    .from('finance_types')
    .select('id, kind, name, display_order, is_active')
    .is('deleted_at', null)
    .order('kind')
    .order('display_order')
    .order('name')
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function listMethods() {
  const { data, error } = await supabase
    .from('finance_payment_methods')
    .select('id, name, bucket, display_order, is_active')
    .is('deleted_at', null)
    .order('display_order')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveType({ id, kind, name, is_active = true }) {
  const row = { kind, name: name.trim(), is_active }
  const q = id
    ? supabase.from('finance_types').update(row).eq('id', id)
    : supabase.from('finance_types').insert(row)
  const { error } = await q
  if (error) throw error
}

export async function saveMethod({ id, name, bucket, is_active = true }) {
  const row = { name: name.trim(), bucket, is_active }
  const q = id
    ? supabase.from('finance_payment_methods').update(row).eq('id', id)
    : supabase.from('finance_payment_methods').insert(row)
  const { error } = await q
  if (error) throw error
}

/** Retiring a type keeps every past entry readable — the name was copied in. */
export async function retireType(id) {
  const { error } = await supabase
    .from('finance_types')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function retireMethod(id) {
  const { error } = await supabase
    .from('finance_payment_methods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------------ receipts

export async function uploadAttachment(file, kind) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `finance/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('client-documents')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return { file_path: path, file_name: file.name, file_size: file.size }
}

export async function attachmentUrl(path) {
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
