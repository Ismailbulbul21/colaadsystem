import { supabase } from '../lib/supabaseClient'

export async function listActiveServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, category, price, description, estimated_time')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_order')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function listAllServices() {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .is('deleted_at', null)
    .order('display_order')
    .order('name')
  if (error) throw error
  return data ?? []
}

/**
 * The Registration form is rendered from these rows. Adding a field to a
 * service is a data change, not a code change — no rebuild, no redeploy.
 */
export async function getServiceFields(serviceId) {
  if (!serviceId) return []
  const { data, error } = await supabase
    .from('service_field_definitions')
    .select('id, field_key, label, field_type, options, placeholder, help_text, is_required, display_order, section')
    .eq('service_id', serviceId)
    .is('deleted_at', null)
    // Section first: both parties reuse display_order 1..5, so ordering by
    // that alone leaves the tie unbroken and the sections can come back in
    // any order — Party 2 was rendering above Party 1.
    .order('section')
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function createService(payload) {
  const { data, error } = await supabase.from('services').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateService(id, payload) {
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Services are disabled, never deleted, so historical records stay intact. */
export async function setServiceActive(id, isActive) {
  const { error } = await supabase.from('services').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function softDeleteService(id) {
  const { error } = await supabase
    .from('services')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function upsertServiceField(payload) {
  const { data, error } = await supabase
    .from('service_field_definitions')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteServiceField(id) {
  const { error } = await supabase
    .from('service_field_definitions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
