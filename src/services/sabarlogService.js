import { supabase } from '../lib/supabaseClient'

/**
 * Sabarlog — the land deed.
 *
 * One deed per lot. The deed is subdivided and sold to many buyers, and each
 * sale is endorsed on the BACK of it (dhabar-ka-dil). Separately the physical
 * paper gets signed out of the archive (la-bixiyay). Both of those hang off a
 * deed by lot number, which is why nothing can be filed against a lot that
 * has no deed.
 */

const SABARLOG_COLUMNS =
  'id, sabarlog_no, company_owner, lot_no, total_size, registered_date, ' +
  'registered_by_name, is_previous, file_path, file_name, file_size, ' +
  'created_by_name, updated_by_name, updated_at, created_at'

const DHABAR_COLUMNS =
  'id, sabarlog_id, lot_no, owner_wakiil, notary_ref, land_size, entry_date, ' +
  'created_by_name, updated_by_name, created_at'

const LABIXIYAY_COLUMNS =
  'id, sabarlog_id, lot_no, taken_by, land_size, taken_date, ' +
  'created_by_name, updated_by_name, created_at'

// ---------------------------------------------------------------- checks

/** { state: 'free' | 'duplicate' | 'empty', sabarlog_no?, lot_no? } */
export async function checkSabarlogNo(no) {
  const { data, error } = await supabase.rpc('check_sabarlog_no', { p_no: no })
  if (error) throw error
  return data
}

/** { state: 'found' | 'missing' | 'empty', sabarlog_no?, company_owner?, … } */
export async function checkLot(lot) {
  const { data, error } = await supabase.rpc('check_sabarlog_lot', { p_lot: lot })
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
      `lot_no.ilike.${like},sabarlog_no.ilike.${like},company_owner.ilike.${like}`,
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
    p_lot_no: form.lot_no.trim(),
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

export async function updateSabarlog(id, form) {
  const { data, error } = await supabase.rpc('update_sabarlog', {
    p_id: id,
    p_company_owner: form.company_owner.trim(),
    p_lot_no: form.lot_no.trim(),
    p_registered_date: form.registered_date,
    p_total_size: form.total_size?.trim() || null,
    p_registered_by_name: form.registered_by_name?.trim() || null,
  })
  if (error) throw error
  return data
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
    p_lot_no: form.lot_no.trim(),
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
    p_lot_no: form.lot_no.trim(),
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

/**
 * Hides a record rather than destroying it, and only for an Administrator —
 * the database refuses everyone else, so this is not merely a hidden button.
 */
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
  const [deeds, sales, taken] = await Promise.all([
    supabase
      .from('sabarlogs')
      .select('registered_date, company_owner, is_previous')
      .is('deleted_at', null),
    supabase.from('sabarlog_dhabar_ka_dil').select('lot_no').is('deleted_at', null),
    supabase.from('sabarlog_la_bixiyay').select('lot_no').is('deleted_at', null),
  ])
  if (deeds.error) throw deeds.error
  if (sales.error) throw sales.error
  if (taken.error) throw taken.error

  const byYear = new Map()
  const byCompany = new Map()
  let previous = 0

  for (const row of deeds.data ?? []) {
    const year = String(row.registered_date).slice(0, 4)
    byYear.set(year, (byYear.get(year) ?? 0) + 1)
    byCompany.set(row.company_owner, (byCompany.get(row.company_owner) ?? 0) + 1)
    if (row.is_previous) previous += 1
  }

  // Which deeds have been carved up the most — the practical question the
  // office asks of this data.
  const byLot = new Map()
  for (const row of sales.data ?? []) {
    byLot.set(row.lot_no, (byLot.get(row.lot_no) ?? 0) + 1)
  }

  const desc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])

  return {
    totalDeeds: deeds.data?.length ?? 0,
    totalSales: sales.data?.length ?? 0,
    totalTaken: taken.data?.length ?? 0,
    previous,
    byYear: [...byYear.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
    byCompany: desc(byCompany),
    byLot: desc(byLot),
  }
}

export async function sabarlogYears() {
  const { data, error } = await supabase
    .from('sabarlogs')
    .select('registered_date')
    .is('deleted_at', null)
  if (error) throw error
  const years = new Set((data ?? []).map((r) => String(r.registered_date).slice(0, 4)))
  return [...years].sort((a, b) => b.localeCompare(a))
}
