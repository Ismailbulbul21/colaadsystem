/**
 * Employees should never see "duplicate key value violates unique constraint".
 * Everything that reaches the UI passes through here first.
 */

const PATTERNS = [
  [/duplicate key value.*registration_no/i, 'That registration number already exists.'],
  [/duplicate key value.*receipt_no/i, 'That receipt number already exists.'],
  [/duplicate key value.*username/i, 'That username is already taken.'],
  [/duplicate key value.*uq_client_field/i, 'This information was already saved for this client.'],
  [/duplicate key value/i, 'This record already exists.'],
  [/violates foreign key/i, 'This record is linked to other data and cannot be changed.'],
  [/violates row-level security/i, 'You do not have permission to do this.'],
  [/insufficient_privilege|permission denied/i, 'You do not have permission to do this.'],
  [/JWT expired|invalid claim/i, 'Your session expired. Please sign in again.'],
  [/Invalid login credentials/i, 'Incorrect username or password.'],
  [/Email not confirmed/i, 'This account is not activated yet. Contact the Administrator.'],
  [/Password should be at least/i, 'Password must be at least 8 characters.'],
  [/Failed to fetch|NetworkError|network request failed/i,
    'Cannot reach the server. Check your internet connection and try again.'],
  [/exceeded the maximum allowed size|Payload too large/i, 'That file is too large.'],
  [/mime type .* is not supported/i, 'That file type is not allowed.'],
  [/new row violates check constraint.*discount_not_over_price/i,
    'The discount cannot be larger than the service price.'],
]

export function friendlyError(error) {
  if (!error) return 'Something went wrong.'
  const raw =
    typeof error === 'string'
      ? error
      : error.message || error.error_description || error.details || ''

  // Our own RAISE EXCEPTION messages are already written for employees.
  for (const [pattern, message] of PATTERNS) {
    if (pattern.test(raw)) return message
  }
  if (raw && raw.length < 200 && !/^[A-Z_]+$/.test(raw)) return raw
  return 'Something went wrong. Please try again.'
}

export function isOffline(error) {
  const raw = typeof error === 'string' ? error : error?.message || ''
  return /Failed to fetch|NetworkError|network request failed/i.test(raw)
}
