import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase, usernameToEmail } from '../lib/supabaseClient'
import { queryClient } from '../lib/queryClient'
import { friendlyError } from '../utils/errors'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const loginRecorded = useRef(false)

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_profile')
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      // Authenticated against GoTrue but no employee profile: not a valid account.
      await supabase.auth.signOut()
      throw new Error('This account is not set up. Contact the Administrator.')
    }
    setProfile(row)
    return row
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      if (data.session) {
        try {
          await loadProfile()
        } catch {
          setProfile(null)
        }
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!active) return
      setSession(newSession ?? null)

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        loginRecorded.current = false
        queryClient.clear()
        return
      }
      if (newSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        try {
          await loadProfile()
        } catch {
          setProfile(null)
        }
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (username, password) => {
      const email = usernameToEmail(username)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Count the strike so Admin can see it and the account can lock.
        try {
          const { data: res } = await supabase.rpc('record_failed_login', { p_username: username })
          if (res?.locked) {
            throw new Error(
              'This account is now locked after 5 failed attempts. Ask the Administrator to unlock it.',
            )
          }
          if (typeof res?.attempts_left === 'number' && res.attempts_left <= 2) {
            throw new Error(
              `Incorrect username or password. ${res.attempts_left} attempt(s) left before the account locks.`,
            )
          }
        } catch (inner) {
          if (inner?.message && !/Invalid login/i.test(inner.message)) throw inner
        }
        throw new Error(friendlyError(error))
      }

      const row = await loadProfile()

      if (!row.is_active) {
        await supabase.auth.signOut()
        throw new Error('This account is disabled. Contact the Administrator.')
      }
      if (row.locked_until && new Date(row.locked_until) > new Date()) {
        await supabase.auth.signOut()
        throw new Error('This account is locked. Ask the Administrator to unlock it.')
      }

      if (!loginRecorded.current) {
        loginRecorded.current = true
        supabase.rpc('record_login', { p_user_agent: navigator.userAgent }).catch(() => {})
      }
      setSession(data.session)
      return row
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    try {
      await supabase.rpc('record_logout')
    } catch {
      /* logging out must never be blocked by a logging failure */
    }
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    queryClient.clear()
  }, [])

  const changePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(friendlyError(error))
    const { error: rpcError } = await supabase.rpc('complete_password_change')
    if (rpcError) throw new Error(friendlyError(rpcError))
    setProfile((p) => (p ? { ...p, must_change_password: false } : p))
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      role: profile?.role_code ?? null,
      isAdmin: profile?.role_code === 'admin',
      mustChangePassword: !!profile?.must_change_password,
      signIn,
      signOut,
      changePassword,
      refreshProfile: loadProfile,
      hasRole: (...roles) => !!profile && roles.includes(profile.role_code),
    }),
    [session, profile, loading, signIn, signOut, changePassword, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
