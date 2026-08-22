import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, AlertCircle, Moon, Sun } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTheme } from '../../contexts/ThemeContext'
import Button from '../../components/ui/Button'
import { BUNDLED_LOGO, setRememberMe, getRememberMe } from '../../lib/supabaseClient'
import { HOME_BY_ROLE } from '../../constants'

/**
 * A single centred card, matching the Ministry's own notary portal, which is
 * the layout the office asked for.
 */
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
    <div className="flex min-h-screen flex-col bg-surface-muted">
      {/* ---------- language + theme ---------- */}
      <div className="flex shrink-0 items-center justify-end gap-3 px-5 py-2.5">
        <div className="flex items-center overflow-hidden rounded-lg border border-surface-border bg-surface">
          {[
            ['so', 'Soomaali'],
            ['en', 'English'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                lang === code ? 'bg-navy-600 text-white' : 'text-ink-500 hover:bg-ink-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="grid h-9 w-9 place-items-center rounded-lg border border-surface-border bg-surface text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* ---------- the card ----------
          Centred, but the whole column can scroll if a very short window
          cannot fit it — the card is never clipped off the bottom. */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-2">
        <div className="w-full max-w-[880px]">
          {/* Logo beside the form on a normal screen; stacked on a phone,
              where side-by-side would squeeze both halves. */}
          <div className="grid items-center gap-6 rounded-xl border border-surface-border bg-surface p-5 shadow-card sm:p-7 md:grid-cols-2 md:gap-10">
            <div className="text-center md:border-r md:border-surface-border md:pr-10">
              <img
                src={BUNDLED_LOGO}
                alt="Olad Law Office and Public Notary Service"
                className="mx-auto h-28 w-auto object-contain md:h-40"
              />
              <h1 className="mt-4 text-base font-bold uppercase leading-tight tracking-tight text-green-800 dark:text-green-300 md:text-lg">
                Olad Law Office and Public Notary Service
              </h1>
              <p className="mt-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400">
                Xafiiska Nootaayada iyo Latalinta Arimaha Sharciga
              </p>
            </div>

            <div>
              <h2 className="text-center text-xl font-semibold tracking-tight text-ink-900">
                {t('auth.welcome')}
              </h2>
              <p className="mx-auto mt-1 max-w-xs text-center text-[13px] leading-snug text-ink-500">
                {t('auth.welcomeHint')}
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
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
                  className="h-4 w-4 rounded border-ink-300 text-navy-600 focus:ring-navy-500"
                />
                {t('auth.rememberMe')}
              </label>

              <Button type="submit" loading={busy} icon={Lock} size="lg" className="w-full">
                {t('auth.signIn')}
              </Button>
              </form>

              <p className="mt-3 text-center text-2xs leading-snug text-ink-400">
                {t('auth.noSignup')}
                <br />
                {t('auth.lockWarning')}
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-2xs text-ink-400">
            © {new Date().getFullYear()} Olad Law Office and Public Notary Service.
          </p>
        </div>
      </div>
    </div>
  )
}
