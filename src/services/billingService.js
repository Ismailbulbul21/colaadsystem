import { supabase } from '../lib/supabaseClient'

/**
 * Invoices and receipts for the ledger.
 *
 *   INVOICE (a bill, has a due date)  ──paid──►  income line + RECEIPT
 *
 * A receipt can also be issued straight from an income line typed directly,
 * since not every payment starts life as a bill.
 */

const INVOICE_COLUMNS =
  'id, invoice_no, invoice_date, due_date, bill_to_name, bill_to_address, ' +
  'bill_to_phone, subtotal, discount, tax_percent, tax_amount, total, status, ' +
  'paid_by, method_name, paid_at, transaction_id, notes, created_by_name, created_at'

const RECEIPT_COLUMNS =
  'id, receipt_no, receipt_date, received_from, payment_for, method_name, ' +
  'reference, total, transaction_id, invoice_id, notes, created_by_name, created_at'

// ---------------------------------------------------------------- invoices

export async function listInvoices({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('finance_invoices')
    .select(INVOICE_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(`invoice_no.ilike.${like},bill_to_name.ilike.${like}`)
  }
  q = q.order(sort?.key ?? 'invoice_date', { ascending: sort?.dir === 'asc' })
       .order('created_at', { ascending: false })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function getInvoice(id) {
  const [head, items] = await Promise.all([
    supabase.from('finance_invoices').select(INVOICE_COLUMNS).eq('id', id).single(),
    supabase.from('finance_invoice_items')
      .select('id, line_no, description, qty, unit_price, amount')
      .eq('invoice_id', id).order('line_no'),
  ])
  if (head.error) throw head.error
  if (items.error) throw items.error
  return { ...head.data, items: items.data ?? [] }
}

/** Totals are recalculated in the database; whatever the browser thinks is ignored. */
export async function saveInvoice(form) {
  const { data, error } = await supabase.rpc('save_invoice', {
    p_id: form.id ?? null,
    p_invoice_date: form.invoice_date,
    p_due_date: form.due_date || null,
    p_bill_to_name: form.bill_to_name.trim(),
    p_items: (form.items ?? [])
      .filter((i) => i.description?.trim())
      .map((i) => ({
        description: i.description.trim(),
        qty: Number(i.qty) || 1,
        unit_price: Number(i.unit_price) || 0,
      })),
    p_bill_to_address: form.bill_to_address?.trim() || null,
    p_bill_to_phone: form.bill_to_phone?.trim() || null,
    p_discount: Number(form.discount) || 0,
    p_tax_percent: Number(form.tax_percent) || 0,
    p_notes: form.notes?.trim() || null,
  })
  if (error) throw error
  return data
}

/** Records the income AND issues the receipt in one step, so they cannot drift. */
export async function payInvoice({ invoiceId, methodId, typeId, paidBy, paidDate }) {
  const { data, error } = await supabase.rpc('pay_invoice', {
    p_invoice_id: invoiceId,
    p_method_id: methodId,
    p_type_id: typeId,
    p_paid_by: paidBy?.trim() || null,
    p_paid_date: paidDate || null,
  })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------- receipts

export async function listReceipts({ filters = {}, range, sort } = {}) {
  let q = supabase
    .from('finance_receipts')
    .select(RECEIPT_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.q) {
    const like = `%${filters.q}%`
    q = q.or(`receipt_no.ilike.${like},received_from.ilike.${like},reference.ilike.${like}`)
  }
  q = q.order(sort?.key ?? 'receipt_date', { ascending: sort?.dir === 'asc' })
       .order('created_at', { ascending: false })
  if (range) q = q.range(range.from, range.to)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function getReceipt(id) {
  const [head, items] = await Promise.all([
    supabase.from('finance_receipts').select(RECEIPT_COLUMNS).eq('id', id).single(),
    supabase.from('finance_receipt_items')
      .select('id, line_no, description, qty, amount')
      .eq('receipt_id', id).order('line_no'),
  ])
  if (head.error) throw head.error
  if (items.error) throw items.error
  return { ...head.data, items: items.data ?? [] }
}

export async function issueReceipt(transactionId) {
  const { data, error } = await supabase.rpc('issue_receipt', {
    p_transaction_id: transactionId,
  })
  if (error) throw error
  return data
}

/**
 * Only the wording and the names are editable. The amount stays tied to the
 * ledger entry, so a receipt can never claim a different sum from the money
 * actually recorded.
 */
export async function updateReceipt(id, form) {
  const { data, error } = await supabase.rpc('update_receipt', {
    p_id: id,
    p_received_from: form.received_from.trim(),
    p_payment_for: form.payment_for?.trim() || null,
    p_reference: form.reference?.trim() || null,
    p_notes: form.notes?.trim() || null,
  })
  if (error) throw error
  return data
}

export async function voidDocument(kind, id) {
  const { data, error } = await supabase.rpc('void_finance_doc', { p_kind: kind, p_id: id })
  if (error) throw error
  return data
}

// ------------------------------------------------------------ amount in words

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy',
  'Eighty', 'Ninety']

function under1000(n) {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
  return `${ONES[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` ${under1000(n % 100)}` : '')
}

/** "Fifteen US Dollars Only" — the line printed under every total. */
export function amountInWords(value) {
  const n = Math.floor(Math.abs(Number(value) || 0))
  const cents = Math.round((Math.abs(Number(value) || 0) - n) * 100)

  let words = ''
  if (n === 0) {
    words = 'Zero'
  } else {
    const groups = [
      [1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1000, 'Thousand'],
    ]
    let rest = n
    for (const [size, label] of groups) {
      if (rest >= size) {
        words += `${under1000(Math.floor(rest / size))} ${label} `
        rest %= size
      }
    }
    if (rest) words += under1000(rest)
  }

  words = words.trim()
  // "Forty-Five US Dollars and Twenty-Five Cents Only" — the cents belong
  // AFTER the word Dollars, not before it, and one dollar is singular.
  const unit = n === 1 && cents === 0 ? 'US Dollar' : 'US Dollars'
  const centWords = cents
    ? ` and ${under1000(cents)} Cent${cents === 1 ? '' : 's'}`
    : ''
  return `${words} ${unit}${centWords} Only`
}
