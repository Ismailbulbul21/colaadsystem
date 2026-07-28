import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the build received its Supabase settings.
 *
 * This used to `throw` here. That is a module-level throw, so it fired before
 * React mounted and before any error boundary existed — the whole page went
 * blank with nothing but a console message. On a hosting platform where the
 * environment variables simply had not been added yet, that is impossible to
 * diagnose from the browser. The app now boots and says what is missing.
 */
export const isConfigured = Boolean(url && anonKey)

export const missingConfigKeys = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

// Harmless placeholders keep every `import { supabase }` working so the app can
// render the setup screen instead of collapsing at import time.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'olod-auth',
  },
  db: { schema: 'public' },
  realtime: { params: { eventsPerSecond: 5 } },
  global: { headers: { 'x-application-name': 'olod-notary' } },
})

// Dev-only handle so the client can be exercised from the browser console
// while debugging. Stripped from production builds by the DEV guard.
if (import.meta.env.DEV) {
  window.__supabase = supabase
}

/**
 * Employees sign in with a username, not an email address. The Supabase Auth
 * email is derived from a fixed domain, so the app never needs a public
 * username lookup endpoint that would leak who works here.
 */
const EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'olodnotary.so'

export function usernameToEmail(username) {
  const clean = String(username || '').trim().toLowerCase()
  return clean.includes('@') ? clean : `${clean}@${EMAIL_DOMAIN}`
}

/** Public URL for a file in the office-assets bucket. */
export function assetUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return supabase.storage.from('office-assets').getPublicUrl(path).data.publicUrl
}

/**
 * Client documents live in a PRIVATE bucket, so they are only ever reachable
 * through a short-lived signed URL that the storage policies must approve.
 */
export async function signedDocumentUrl(path, expiresInSeconds = 120) {
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function callAdminAction(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { action, payload },
  })
  if (error) {
    // Edge Function errors carry the useful message in the response body
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch {
      /* keep the original message */
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
