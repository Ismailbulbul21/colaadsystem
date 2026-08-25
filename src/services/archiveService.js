import { supabase } from '../lib/supabaseClient'

/** Documents the office notarised on paper before this system existed. */
const LIST_COLUMNS =
  'id, reference_no, client_name, client_phone, document_type, service_name, ' +
  'document_date, ministry_reg_no, status, amount, notes, file_path, file_name, ' +
  'file_size, added_by_name, created_at'

/**
 * Tells the form whether a reference can be used.
 * Returns { state: 'free' | 'duplicate' | 'live' | 'empty', reference? }
 */
export async function checkReference(reference) {
  const { data, error } = await supabase.rpc('check_archive_reference', { p_ref: reference })
  if (error) throw error
  return data
}

export async function listArchived({ filters = {}, range, sort } = {}) {
  let q = supabase.from('archived_documents').select(LIST_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(`reference_no.ilike.${like},client_name.ilike.${like},service_name.ilike.${like},ministry_reg_no.ilike.${like}`)
  }
  if (filters.service) q = q.eq('service_name', filters.service)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.year) {
    q = q.gte('document_date', `${filters.year}-01-01`).lte('document_date', `${filters.year}-12-31`)
  }

  q = q.order(sort?.key ?? 'created_at', { ascending: sort?.dir === 'asc' })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function addArchivedDocument(doc) {
  const { data, error } = await supabase.rpc('add_archived_document', {
    p_reference_no: doc.reference_no.trim(),
    p_client_name: doc.client_name.trim(),
    p_service_name: doc.service_name,
    p_document_date: doc.document_date,
    p_status: doc.status || 'completed',
    p_client_phone: doc.client_phone?.trim() || null,
    p_file_path: doc.file_path ?? null,
    p_file_name: doc.file_name ?? null,
    p_file_size: doc.file_size ?? null,
  })
  if (error) throw error
  return data
}

/**
 * Puts the scan in the PRIVATE client-documents bucket, under archive/.
 * That bucket is proven — ALT uploads through it daily — and being private
 * means the file has no public address; it is reached only through a signed
 * link that expires.
 */
export async function uploadScan(file, referenceNo) {
  const safeRef = referenceNo.replace(/[^A-Za-z0-9]/g, '-')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `archive/${safeRef}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('client-documents')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return { file_path: path, file_name: file.name, file_size: file.size }
}

/** Short-lived link so a private file can be opened without being public. */
export async function scanUrl(path) {
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

/** Counts for the Archive Reports tab. */
export async function archiveSummary() {
  const { data, error } = await supabase
    .from('archived_documents')
    .select('document_date, service_name, amount')
    .is('deleted_at', null)
  if (error) throw error

  const byYear = new Map()
  const byService = new Map()
  let total = 0

  for (const row of data ?? []) {
    const year = String(row.document_date).slice(0, 4)
    byYear.set(year, (byYear.get(year) ?? 0) + 1)
    byService.set(row.service_name, (byService.get(row.service_name) ?? 0) + 1)
    total += 1
  }

  const sorted = (m, desc = true) =>
    [...m.entries()].sort((a, b) => (desc ? b[1] - a[1] : String(a[0]).localeCompare(String(b[0]))))

  return {
    total,
    byYear: [...byYear.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]))),
    byService: sorted(byService),
  }
}

/** Distinct years present, for the year filter. */
export async function archivedYears() {
  const { data, error } = await supabase
    .from('archived_documents')
    .select('document_date')
    .is('deleted_at', null)
  if (error) throw error
  const years = new Set((data ?? []).map((r) => String(r.document_date).slice(0, 4)))
  return [...years].sort((a, b) => b.localeCompare(a))
}
