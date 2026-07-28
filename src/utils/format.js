import { format, parseISO, isValid } from 'date-fns'

/** Money is stored as numeric(12,2); never do maths on the formatted string. */
export function formatMoney(value, symbol = '$') {
  const n = Number(value ?? 0)
  return `${symbol}${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US')
}

function toDate(value) {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

export function formatDate(value, pattern = 'dd/MM/yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export function formatDateTime(value) {
  const d = toDate(value)
  return d ? format(d, 'dd/MM/yyyy HH:mm') : '—'
}

export function formatTime(value) {
  const d = toDate(value)
  return d ? format(d, 'HH:mm') : '—'
}

export function formatRelative(value) {
  const d = toDate(value)
  if (!d) return '—'
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return format(d, 'dd MMM yyyy')
}

export function formatFileSize(bytes) {
  const b = Number(bytes ?? 0)
  if (b === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

/** ISO date string for `<input type="date">`. */
export function toDateInput(value) {
  const d = toDate(value)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

export const todayInput = () => format(new Date(), 'yyyy-MM-dd')

export function startOfMonthInput() {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

/**
 * A date-only filter like "2026-07-27" must cover the whole day, so the upper
 * bound is exclusive midnight of the next day rather than 23:59:59.
 */
export function dayRangeToTimestamps(from, to) {
  const start = from ? new Date(`${from}T00:00:00`).toISOString() : null
  let end = null
  if (to) {
    const d = new Date(`${to}T00:00:00`)
    d.setDate(d.getDate() + 1)
    end = d.toISOString()
  }
  return { start, end }
}
