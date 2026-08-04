import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck, Clock, Users, Phone, Mail, MapPin, Moon, Sun,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTheme } from '../../contexts/ThemeContext'
import Button from '../../components/ui/Button'
import { BUNDLED_LOGO, setRememberMe, getRememberMe } from '../../lib/supabaseClient'
import { HOME_BY_ROLE } from '../../constants'

const CONTACT = {
  phone1: '+252617221414',
  phone2: '+252611101040',
  email: 'info@colaadnotary.so',
  city: 'Mogadishu, Somalia',
}

export default function Login() {
  const { signIn } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const { isDark, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(getRememberMe)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return // guards against a double click submitting twice
    setError('')

    if (!username.trim() || !password) {
      setError(t('auth.enterBoth'))
      return
    }

    // Decide where the session is kept BEFORE signing in, so the token lands
    // in the right place: localStorage survives closing the browser,
    // sessionStorage does not.
    setRememberMe(remember)

    setBusy(true)
    try {
      const profile = await signIn(username.trim(), password)
      if (profile.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        navigate(location.state?.from || HOME_BY_ROLE[profile.role_code] || '/', { replace: true })
      }
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl bg-surface shadow-panel sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">
        <div className="flex w-full flex-col lg:flex-row">

          {/* ================= left: identity ================= */}
          <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-b from-surface to-surface-sunken p-10 lg:flex">
            {/* faint map of Somalia behind the panel */}
            <svg
              viewBox="0 0 200 260"
              aria-hidden
              className="pointer-events-none absolute right-2 top-16 h-72 w-56 text-navy-500/[0.07]"
              fill="currentColor"
            >
              <path d="M40 20 L70 12 95 30 118 25 140 45 168 60 176 92 150 120 128 150 118 186 96 214 74 236 60 224 66 190 52 160 44 122 30 90 34 52 Z" />
            </svg>

            <div className="relative">
              <img src={BUNDLED_LOGO} alt="Colaad Notary" className="h-28 w-auto object-contain" />

              <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight text-ink-900">
                Colaad Notary
                <br />
                Management System
              </h1>

              <div className="mt-5 h-px w-24 bg-gradient-to-r from-brass-400 to-transparent" />

              <p className="mt-5 text-sm font-medium text-ink-500">
                Fast <span className="text-brass-500">•</span> Secure{' '}
                <span className="text-brass-500">•</span> Trusted Legal Services
              </p>
            </div>

            {/* three assurances along the bottom */}
            <div className="relative mt-10 grid grid-cols-3 gap-4 border-t border-surface-border pt-6">
              {[
                { icon: ShieldCheck, title: 'Secure', sub: 'Data Protection' },
                { icon: Clock, title: 'Efficient', sub: 'Save Time' },
                { icon: Users, title: 'Reliable', sub: 'Trusted Service' },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brass-500" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight text-ink-900">{title}</p>
                    <p className="text-2xs leading-tight text-ink-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================= right: sign in ================= */}
          <div className="flex w-full flex-col bg-surface lg:w-1/2">
            {/* language + theme */}
            <div className="flex items-center justify-end gap-3 p-5">
              <div className="flex items-center overflow-hidden rounded-lg border border-surface-border">
                <button
                  type="button"
                  onClick={() => setLang('so')}
                  className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    lang === 'so' ? 'bg-navy-700 text-white' : 'text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  Soomaali
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    lang === 'en' ? 'bg-navy-700 text-white' : 'text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  English
                </button>
              </div>

              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center px-6 pb-6 sm:px-10">
              <div className="w-full max-w-sm">
                {/* logo again on small screens, where the left panel is hidden */}
                <img
                  src={BUNDLED_LOGO}
                  alt=""
                  className="mx-auto mb-6 h-20 w-auto object-contain lg:hidden"
                />

                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-navy-50 dark:bg-navy-800/40">
                  <User className="h-8 w-8 text-navy-600 dark:text-navy-200" strokeWidth={1.8} />
                </div>

                <h2 className="mt-5 text-center text-2xl font-semibold tracking-tight text-ink-900">
                  {t('auth.welcome')}
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-center text-[13px] leading-relaxed text-ink-500">
                  {t('auth.welcomeHint')}
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="login-username" className="label">
                      {t('auth.username')}
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input
                        id="login-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('auth.usernamePlaceholder')}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus
                        disabled={busy}
                        className="h-11 w-full rounded-lg border border-surface-border bg-surface pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 transition-colors focus:border-navy-500 disabled:bg-ink-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="label">
                      {t('auth.password')}
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        disabled={busy}
                        className="h-11 w-full rounded-lg border border-surface-border bg-surface pl-9 pr-10 text-sm text-ink-800 placeholder:text-ink-400 transition-colors focus:border-navy-500 disabled:bg-ink-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-600">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-ink-300 text-navy-700 focus:ring-navy-500"
                    />
                    {t('auth.rememberMe')}
                  </label>

                  <Button
                    type="submit"
                    loading={busy}
                    icon={Lock}
                    size="lg"
                    className="w-full bg-gradient-to-r from-navy-700 to-navy-600 hover:from-navy-800 hover:to-navy-700"
                  >
                    {t('auth.signIn')}
                  </Button>
                </form>

                <p className="mt-6 text-center text-2xs leading-relaxed text-ink-400">
                  {t('auth.noSignup')}
                </p>
                <p className="mt-1.5 text-center text-2xs text-ink-400">
                  {t('auth.lockWarning')}
                </p>
              </div>
            </div>

            {/* contact strip */}
            <div className="border-t border-surface-border bg-navy-900 px-6 py-4">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-2xs text-navy-100">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-brass-400" /> {CONTACT.phone1}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-brass-400" /> {CONTACT.phone2}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-brass-400" /> {CONTACT.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brass-400" /> {CONTACT.city}
                </span>
              </div>
              <p className="mt-2 text-center text-2xs text-navy-300">
                © {new Date().getFullYear()} Colaad Notary. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
