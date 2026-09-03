import { supabase } from '../lib/supabaseClient'

/**
 * Dashboard counters use `head: true` with `count: 'exact'`, so Postgres
 * returns a number and zero rows. A dashboard with 12 cards costs 12 counts,
 * not 12 table scans pulled into the browser.
 */
function countClients(filter) {
  let q = supabase.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null)
  return filter(q)
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

async function sum(table, column, apply) {
  // Supabase has no SUM aggregate over the REST API, so we select just the
  // one numeric column for the filtered slice and total it in memory.
  // Filters are always a single day or month, so this stays small.
  let q = supabase.from(table).select(column)
  q = apply(q)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).reduce((acc, row) => acc + Number(row[column] ?? 0), 0)
}

export async function fetchSidebarBadges(role) {
  const out = {}
  const tasks = []

  if (role === 'admin') {
    tasks.push(
      supabase
        .from('discount_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then((r) => (out.discounts = r.count ?? 0)),
    )
  }
  if (role === 'nootaayo' || role === 'admin') {
    tasks.push(
      countClients((q) => q.in('status', ['waiting_alt', 'document_uploaded'])).then(
        (r) => (out.altQueue = r.count ?? 0),
      ),
    )
  }
  if (role === 'finance' || role === 'admin') {
    tasks.push(
      countClients((q) => q.eq('status', 'waiting_payment')).then(
        (r) => (out.pendingPayments = r.count ?? 0),
      ),
    )
  }
  if (role === 'nootaayo') {
    // Unfinished work is easy to forget, so the count sits in the menu.
    tasks.push(
      countClients((q) => q.eq('status', 'draft')).then((r) => (out.drafts = r.count ?? 0)),
    )
  }

  await Promise.all(tasks)
  return out
}

export async function fetchAdminStats() {
  const today = startOfToday()
  const month = startOfMonth()
  const day = todayDate()

  const [
    todayClients, pendingClients, waitingDocs, waitingPayments,
    pendingDiscounts, employees, services, documentsPrinted,
    todayIncome, todayExpenses, monthRevenue, monthExpenses,
  ] = await Promise.all([
    countClients((q) => q.gte('registered_at', today)),
    countClients((q) => q.in('status', ['registered', 'waiting_admin_approval', 'waiting_alt', 'document_uploaded', 'waiting_payment'])),
    countClients((q) => q.in('status', ['waiting_alt', 'document_uploaded'])),
    countClients((q) => q.eq('status', 'waiting_payment')),
    supabase.from('discount_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true),
    supabase.from('services').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true),
    supabase.from('document_print_logs').select('id', { count: 'exact', head: true }),
    sum('payments', 'amount_paid', (q) => q.gte('paid_at', today)),
    sum('expenses', 'amount', (q) => q.eq('expense_date', day).is('deleted_at', null)),
    sum('payments', 'amount_paid', (q) => q.gte('paid_at', month)),
    sum('expenses', 'amount', (q) => q.gte('expense_date', month.slice(0, 10)).is('deleted_at', null)),
  ])

  return {
    todayClients: todayClients.count ?? 0,
    pendingClients: pendingClients.count ?? 0,
    waitingDocuments: waitingDocs.count ?? 0,
    waitingPayments: waitingPayments.count ?? 0,
    pendingDiscounts: pendingDiscounts.count ?? 0,
    totalEmployees: employees.count ?? 0,
    totalServices: services.count ?? 0,
    documentsPrinted: documentsPrinted.count ?? 0,
    todayIncome,
    todayExpenses,
    monthRevenue,
    monthExpenses,
    monthProfit: monthRevenue - monthExpenses,
  }
}

export async function fetchRegistrationStats(userId) {
  const today = startOfToday()

  const [todayClients, waitingAlt, waitingApproval, waitingPayment, completed] = await Promise.all([
    countClients((q) => q.gte('registered_at', today).eq('registered_by', userId)),
    countClients((q) => q.eq('status', 'waiting_alt')),
    countClients((q) => q.eq('status', 'waiting_admin_approval')),
    countClients((q) => q.eq('status', 'waiting_payment')),
    countClients((q) => q.eq('status', 'completed').gte('completed_at', today)),
  ])

  return {
    todayClients: todayClients.count ?? 0,
    waitingAlt: waitingAlt.count ?? 0,
    waitingApproval: waitingApproval.count ?? 0,
    waitingPayment: waitingPayment.count ?? 0,
    completedToday: completed.count ?? 0,
  }
}

export async function fetchAltStats() {
  const today = startOfToday()

  const [waiting, uploadedToday, printedToday, reprints] = await Promise.all([
    countClients((q) => q.eq('status', 'waiting_alt')),
    supabase
      .from('uploaded_documents')
      .select('id', { count: 'exact', head: true })
      .gte('uploaded_at', today)
      .is('deleted_at', null),
    supabase
      .from('document_print_logs')
      .select('id', { count: 'exact', head: true })
      .gte('printed_at', today)
      .eq('is_reprint', false),
    supabase
      .from('document_print_logs')
      .select('id', { count: 'exact', head: true })
      .gte('printed_at', today)
      .eq('is_reprint', true),
  ])

  return {
    waitingDocuments: waiting.count ?? 0,
    uploadedToday: uploadedToday.count ?? 0,
    printedToday: printedToday.count ?? 0,
    reprintedToday: reprints.count ?? 0,
  }
}

export async function fetchFinanceStats() {
  const today = startOfToday()
  const month = startOfMonth()
  const day = todayDate()

  const [pending, receiptsToday, todayIncome, todayExpenses, monthRevenue] = await Promise.all([
    countClients((q) => q.eq('status', 'waiting_payment')),
    supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .gte('issued_at', today),
    sum('payments', 'amount_paid', (q) => q.gte('paid_at', today)),
    sum('expenses', 'amount', (q) => q.eq('expense_date', day).is('deleted_at', null)),
    sum('payments', 'amount_paid', (q) => q.gte('paid_at', month)),
  ])

  return {
    pendingPayments: pending.count ?? 0,
    receiptsToday: receiptsToday.count ?? 0,
    todayIncome,
    todayExpenses,
    todayProfit: todayIncome - todayExpenses,
    monthRevenue,
  }
}

/** Recent activity feed for the Admin dashboard. */
export async function fetchRecentActivity(limit = 10) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_name_snapshot, action, module, description, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Chart data: last 14 days of income vs expenses. */
export async function fetchIncomeTrend(days = 14) {
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)
  const fromIso = from.toISOString()

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('payments').select('amount_paid, paid_at').gte('paid_at', fromIso),
    supabase.from('expenses').select('amount, expense_date').gte('expense_date', fromIso.slice(0, 10)).is('deleted_at', null),
  ])

  const buckets = new Map()
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    buckets.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), income: 0, expenses: 0 })
  }

  for (const p of payments ?? []) {
    const key = String(p.paid_at).slice(0, 10)
    if (buckets.has(key)) buckets.get(key).income += Number(p.amount_paid ?? 0)
  }
  for (const e of expenses ?? []) {
    const key = String(e.expense_date).slice(0, 10)
    if (buckets.has(key)) buckets.get(key).expenses += Number(e.amount ?? 0)
  }

  return Array.from(buckets.values())
}

/** Chart data: which services actually bring in the money. */
export async function fetchServiceBreakdown(days = 30) {
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data, error } = await supabase
    .from('receipts')
    .select('service_name, amount_paid')
    .gte('issued_at', from.toISOString())
  if (error) throw error

  const map = new Map()
  for (const row of data ?? []) {
    const key = row.service_name || 'Unknown'
    map.set(key, (map.get(key) ?? 0) + Number(row.amount_paid ?? 0))
  }
  return Array.from(map, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}
