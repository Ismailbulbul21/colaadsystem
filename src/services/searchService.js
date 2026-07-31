import { supabase } from '../lib/supabaseClient'

const LIMIT = 5

/**
 * One search box for the whole application.
 *
 * Each source is queried only if the role is allowed to see it, so a
 * Registration employee searching "RCP" simply gets no receipt section rather
 * than an error. RLS would block it anyway; this just keeps the UI honest.
 */
export async function universalSearch(term, role) {
  const like = `%${term}%`
  const isAdmin = role === 'admin'
  const canSeeFinance = role === 'admin' || role === 'finance'

  const tasks = []

  tasks.push(
    supabase
      .from('clients')
      .select('id, registration_no, full_name, phone, service_name_snapshot, status')
      .or(`full_name.ilike.${like},phone.ilike.${like},registration_no.ilike.${like},national_id.ilike.${like}`)
      .is('deleted_at', null)
      .order('registered_at', { ascending: false })
      .limit(LIMIT)
      .then((r) => ['clients', r.data ?? []]),
  )

  if (canSeeFinance) {
    tasks.push(
      supabase
        .from('receipts')
        .select('id, receipt_no, client_name, service_name, final_price, issued_at')
        .or(`receipt_no.ilike.${like},client_name.ilike.${like},registration_no.ilike.${like}`)
        .order('issued_at', { ascending: false })
        .limit(LIMIT)
        .then((r) => ['receipts', r.data ?? []]),
    )
    tasks.push(
      supabase
        .from('invoices')
        .select('id, invoice_no, client_name, service_name, final_price, issued_at')
        .or(`invoice_no.ilike.${like},client_name.ilike.${like},registration_no.ilike.${like}`)
        .order('issued_at', { ascending: false })
        .limit(LIMIT)
        .then((r) => ['invoices', r.data ?? []]),
    )
  }

  // Documents are searchable by title or file name, which is how staff refer
  // to them ("the House Transfer agreement", "agreement_v2.docx").
  if (role === 'admin' || role === 'alt' || role === 'finance') {
    tasks.push(
      supabase
        .from('uploaded_documents')
        .select('id, title, file_name, version, client_id, clients(full_name, registration_no)')
        .or(`title.ilike.${like},file_name.ilike.${like}`)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(LIMIT)
        .then((r) => ['documents', r.data ?? []]),
    )
  }

  tasks.push(
    supabase
      .from('services')
      .select('id, name, category, price')
      .ilike('name', like)
      .is('deleted_at', null)
      .limit(LIMIT)
      .then((r) => ['services', r.data ?? []]),
  )

  if (isAdmin) {
    tasks.push(
      supabase
        .rpc('user_directory')
        .ilike('full_name', like)
        .limit(LIMIT)
        .then((r) => ['employees', r.data ?? []]),
    )
  }

  const settled = await Promise.all(tasks)
  const out = { clients: [], receipts: [], invoices: [], documents: [], services: [], employees: [] }
  for (const [key, value] of settled) out[key] = value
  return out
}
