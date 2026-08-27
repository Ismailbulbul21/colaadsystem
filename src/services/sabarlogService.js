import { supabase } from '../lib/supabaseClient'

/**
 * Sabarlog — land deeds.
 *
 * A sabarlog is a BLOCK, not a single plot. It covers a range of lot numbers
 * and the system creates one child lot per number:
 *
 *   SABARLOG R-001/2026  (1207 – 1217)
 *       ├── 1207  sold to Ahmed
 *       ├── 1208  sold to Hassan
 *       └── 1209 … 1217  free
 *
 * A buyer takes ONE lot, so a sale attaches to a lot rather than to the deed.
 * The paper itself is signed out of the archive separately (la-bixiyay).
 */

const SABARLOG_COLUMNS =
  'id, sabarlog_no, company_owner, lot_structure, lot_from, lot_to, total_lots, ' +
  'total_size, registered_date, registered_by_name, is_previous, ' +
  'file_path, file_name, file_size, created_by_name, updated_by_name, created_at'

const DHABAR_COLUMNS =
  'id, sabarlog_id, lot_id, lot_no, owner_wakiil, notary_ref, land_size, ' +
  'entry_date, created_by_name, updated_by_name, created_at'

const LABIXIYAY_COLUMNS =
  'id, sabarlog_id, lot_id, lot_no, taken_by, land_size, taken_date, ' +
  'created_by_name, updated_by_name, created_at'

// ---------------------------------------------------------------- checks

/**
 * What a range would produce, before anything is saved:
 * { state:'ok'|'clash'|'error', count, lots[], taken[], message? }
 */
export async function previewLotRange(from, to) {
  const { data, error } = await supabase.rpc('preview_lot_range', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return data
}

/** { state:'free'|'duplicate'|'empty', sabarlog_no?, lot_no? } */
export async function checkSabarlogNo(no) {
  const { data, error } = await supabase.rpc('check_sabarlog_no', { p_no: no })
  if (error) throw error
  return data
}

// -------------------------------------------------------------- the deed

export async function listSabarlogs({ filters = {}, range, sort, isPrevious } = {}) {
  let q = supabase
    .from('sabarlogs')
    .select(SABARLOG_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (typeof isPrevious === 'boolean') q = q.eq('is_previous', isPrevious)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(
      `sabarlog_no.ilike.${like},company_owner.ilike.${like},` +
      `lot_from.ilike.${like},lot_to.ilike.${like}`,
    )
  }
  if (filters.year) {
    q = q
      .gte('registered_date', `${filters.year}-01-01`)
      .lte('registered_date', `${filters.year}-12-31`)
  }

  q = q.order(sort?.key ?? 'registered_date', { ascending: sort?.dir === 'asc' })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function addSabarlog(form) {
  const { data, error } = await supabase.rpc('add_sabarlog', {
    p_sabarlog_no: form.sabarlog_no.trim(),
    p_company_owner: form.company_owner.trim(),
    p_lot_structure: form.lot_structure || 'single',
    p_lot_from: form.lot_from.trim(),
    p_lot_to: form.lot_structure === 'range' ? form.lot_to.trim() : null,
    p_registered_date: form.registered_date,
    p_total_size: form.total_size?.trim() || null,
    p_registered_by_name: form.registered_by_name?.trim() || null,
    p_is_previous: !!form.is_previous,
    p_file_path: form.file_path ?? null,
    p_file_name: form.file_name ?? null,
    p_file_size: form.file_size ?? null,
  })
  if (error) throw error
  return data
}

/**
 * Lot numbers are not editable: they identify pieces of land that buyers are
 * already attached to, so changing one by hand would move a sale to a
 * different plot without anyone noticing.
 */
export async function updateSabarlog(id, form) {
  const { data, error } = await supabase.rpc('update_sabarlog', {
    p_id: id,
    p_company_owner: form.company_owner.trim(),
    p_registered_date: form.registered_date,
    p_total_size: form.total_size?.trim() || null,
    p_registered_by_name: form.registered_by_name?.trim() || null,
  })
  if (error) throw error
  return data
}

// ----------------------------------------------------------------- lots

/**
 * Fills the lot dropdown. Sold lots are returned too — the office asked to see
 * them marked rather than hidden — and carry the buyer's name.
 */
export async function listLots({ sabarlogId, search, onlyFree, limit = 300 } = {}) {
  let q = supabase
    .from('sabarlog_lot_status')
    .select('lot_id, sabarlog_id, lot_no, lot_seq, land_size, sabarlog_no, company_owner, is_sold, buyer_name')

  if (sabarlogId) q = q.eq('sabarlog_id', sabarlogId)
  if (onlyFree) q = q.eq('is_sold', false)
  if (search) q = q.ilike('lot_no', `%${search}%`)

  q = q.order('sabarlog_no').order('lot_seq').limit(limit)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/** Every lot of one deed, for the "Lots Created" panel. */
export async function lotsOfSabarlog(sabarlogId) {
  const { data, error } = await supabase
    .from('sabarlog_lot_status')
    .select('lot_id, lot_no, lot_seq, is_sold, buyer_name, land_size')
    .eq('sabarlog_id', sabarlogId)
    .order('lot_seq')
  if (error) throw error
  return data ?? []
}

// ------------------------------------------------- back of the deed (sales)

export async function listDhabarKaDil({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('sabarlog_dhabar_ka_dil')
    .select(DHABAR_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(`lot_no.ilike.${like},owner_wakiil.ilike.${like},notary_ref.ilike.${like}`)
  }
  q = q.order(sort?.key ?? 'entry_date', { ascending: sort?.dir === 'asc' })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function addDhabarKaDil(form) {
  const { data, error } = await supabase.rpc('add_dhabar_ka_dil', {
    p_lot_id: form.lot_id,
    p_owner_wakiil: form.owner_wakiil.trim(),
    p_entry_date: form.entry_date,
    p_notary_ref: form.notary_ref?.trim() || null,
    p_land_size: form.land_size?.trim() || null,
  })
  if (error) throw error
  return data
}

export async function updateDhabarKaDil(id, form) {
  const { data, error } = await supabase.rpc('update_dhabar_ka_dil', {
    p_id: id,
    p_owner_wakiil: form.owner_wakiil.trim(),
    p_entry_date: form.entry_date,
    p_notary_ref: form.notary_ref?.trim() || null,
    p_land_size: form.land_size?.trim() || null,
  })
  if (error) throw error
  return data
}

// ----------------------------------------------- paper leaving the archive

export async function listLaBixiyay({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('sabarlog_la_bixiyay')
    .select(LABIXIYAY_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(`lot_no.ilike.${like},taken_by.ilike.${like}`)
  }
  q = q.order(sort?.key ?? 'taken_date', { ascending: sort?.dir === 'asc' })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function addLaBixiyay(form) {
  const { data, error } = await supabase.rpc('add_la_bixiyay', {
    p_lot_id: form.lot_id,
    p_taken_by: form.taken_by.trim(),
    p_taken_date: form.taken_date,
    p_land_size: form.land_size?.trim() || null,
  })
  if (error) throw error
  return data
}

export async function updateLaBixiyay(id, form) {
  const { data, error } = await supabase.rpc('update_la_bixiyay', {
    p_id: id,
    p_taken_by: form.taken_by.trim(),
    p_taken_date: form.taken_date,
    p_land_size: form.land_size?.trim() || null,
  })
  if (error) throw error
  return data
}

// -------------------------------------------------------------- removal

/** Hides a record rather than destroying it, and only for an Administrator. */
export async function deleteSabarlogRecord(kind, id) {
  const { data, error } = await supabase.rpc('delete_sabarlog_record', {
    p_kind: kind,
    p_id: id,
  })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------- scans

export async function uploadScan(file, sabarlogNo) {
  const safe = sabarlogNo.replace(/[^A-Za-z0-9]/g, '-')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `sabarlog/${safe}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('client-documents')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return { file_path: path, file_name: file.name, file_size: file.size }
}

export async function scanUrl(path) {
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// --------------------------------------------------------------- reports

export async function sabarlogSummary() {
  const [deeds, lots, sales, taken] = await Promise.all([
    supabase
      .from('sabarlogs')
      .select('registered_date, company_owner, is_previous, total_lots')
      .is('deleted_at', null),
    supabase.from('sabarlog_lot_status').select('lot_id, is_sold'),
    supabase.from('sabarlog_dhabar_ka_dil').select('id').is('deleted_at', null),
    supabase.from('sabarlog_la_bixiyay').select('id').is('deleted_at', null),
  ])
  for (const r of [deeds, lots, sales, taken]) if (r.error) throw r.error

  const byYear = new Map()
  const byCompany = new Map()
  let previous = 0
  let totalLots = 0

  for (const row of deeds.data ?? []) {
    const year = String(row.registered_date).slice(0, 4)
    byYear.set(year, (byYear.get(year) ?? 0) + 1)
    // Companies are ranked by how much land they hold, not how many papers.
    byCompany.set(row.company_owner, (byCompany.get(row.company_owner) ?? 0) + (row.total_lots ?? 1))
    if (row.is_previous) previous += 1
    totalLots += row.total_lots ?? 1
  }

  const sold = (lots.data ?? []).filter((l) => l.is_sold).length
  const free = (lots.data ?? []).length - sold

  return {
    totalDeeds: deeds.data?.length ?? 0,
    totalLots,
    soldLots: sold,
    freeLots: free,
    totalSales: sales.data?.length ?? 0,
    totalTaken: taken.data?.length ?? 0,
    previous,
    byYear: [...byYear.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
    byCompany: [...byCompany.entries()].sort((a, b) => b[1] - a[1]),
  }
}
