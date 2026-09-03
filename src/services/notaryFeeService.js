import { supabase } from '../lib/supabaseClient'

/**
 * Government and office fees charged on a notary service.
 *
 * The officer types the transaction amount and the database works out every
 * line. Nothing is calculated in the browser, so the entry screen, the
 * printed document and Finance cannot each arrive at a different figure.
 */

const RULE_COLUMNS =
  'id, category, rule_type, rule_value, applies_to_category, display_order, ' +
  'is_active, notes, created_by_name, updated_by_name, updated_at'

export async function listFeeRules({ includeInactive = true } = {}) {
  let q = supabase
    .from('notary_fee_rules')
    .select(RULE_COLUMNS)
    .is('deleted_at', null)
    .order('display_order')
    .order('category')
  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function saveFeeRule(rule) {
  const row = {
    category: rule.category.trim(),
    rule_type: rule.rule_type,
    rule_value: Number(rule.rule_value),
    applies_to_category: rule.applies_to_category || null,
    display_order: Number(rule.display_order) || 0,
    is_active: rule.is_active !== false,
    notes: rule.notes?.trim() || null,
  }
  const q = rule.id
    ? supabase.from('notary_fee_rules').update(row).eq('id', rule.id)
    : supabase.from('notary_fee_rules').insert(row)
  const { error } = await q
  if (error) throw error
}

/**
 * Retiring a rule hides it from future services. Services already recorded
 * keep the fee lines they were given, so last year's document is unaffected.
 */
export async function retireFeeRule(id) {
  const { error } = await supabase
    .from('notary_fee_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * { amount, lines[], total_fees, grand_total }
 *
 * grand_total is what the customer hands over altogether. It is NOT office
 * income — the office earns total_fees; the transaction amount passes between
 * the two parties.
 */
export async function calculateFees(amount, serviceCategory = null) {
  const { data, error } = await supabase.rpc('calculate_notary_fees', {
    p_amount: Number(amount) || 0,
    p_category: serviceCategory,
  })
  if (error) throw error
  return data
}

/** How a rule reads on screen: "3% of amount" or "$30 fixed". */
export function describeRule(rule) {
  const v = Number(rule.rule_value)
  return rule.rule_type === 'percentage'
    ? `${v % 1 === 0 ? v : v.toFixed(2)}% of amount`
    : `$${v.toFixed(2)} fixed`
}
