import { supabase } from '../lib/supabaseClient'
import { downloadBlob } from '../utils/export'

/**
 * Tables included in a backup, in dependency order so the file reads like the
 * office's history from the top down. Read-only: taking a backup never
 * modifies anything.
 */
export const BACKUP_TABLES = [
  'roles',
  'users',
  'services',
  'service_field_definitions',
  'expense_categories',
  'office_settings',
  'number_sequences',
  'clients',
  'client_service_details',
  'discount_requests',
  'uploaded_documents',
  'document_print_logs',
  'payments',
  'payment_corrections',
  'receipts',
  'invoices',
  'expenses',
  'activity_logs',
  'login_history',
  'notifications',
]

const PAGE = 1000

/** Pulls a whole table in pages so a large history cannot blow up memory. */
async function fetchAll(table, onProgress) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    // A table the current role cannot read is recorded, not fatal.
    if (error) return { rows: null, error: error.message }
    rows.push(...(data ?? []))
    onProgress?.(rows.length)
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

/**
 * Full snapshot as a single JSON file.
 * Note this captures DATABASE rows only — uploaded Word and PDF files live in
 * Supabase Storage and are not part of this file.
 */
export async function createBackup(onStep) {
  const result = {
    meta: {
      office: 'Colaad Public Notary Office',
      created_at: new Date().toISOString(),
      format_version: 1,
      note: 'Database rows only. Uploaded documents live in Supabase Storage and are not included.',
    },
    tables: {},
    skipped: {},
  }

  for (const table of BACKUP_TABLES) {
    onStep?.(table)
    const { rows, error } = await fetchAll(table)
    if (error) result.skipped[table] = error
    else result.tables[table] = rows
  }

  result.meta.row_counts = Object.fromEntries(
    Object.entries(result.tables).map(([t, r]) => [t, r.length]),
  )
  return result
}

export function downloadBackup(backup) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `colaad-backup-${stamp}.json`)
}

/** One CSV per table, for opening in Excel. */
export function tableToCsv(rows) {
  if (!rows?.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n')
}

export function downloadTableCsv(table, rows) {
  const csv = tableToCsv(rows)
  if (!csv) return false
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${table}-${stamp}.csv`)
  return true
}
