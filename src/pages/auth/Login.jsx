import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { BUNDLED_LOGO } from '../../lib/supabaseClient'
import { HOME_BY_ROLE } from '../../constants'

export default function Login() {
  const { signIn } = useAuth()
  const { t, lang, setLang, languages } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

    setBusy(true)
    try {
      const profile = await signIn(username.trim(), password)
      if (profile.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        const target = location.state?.from || HOME_BY_ROLE[profile.role_code] || '/'
        navigate(target, { replace: true })
      }
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- brand panel ---------- */}
      <div className="relative hidden flex-col justify-between bg-navy-900 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <img
            src={BUNDLED_LOGO}
            alt=""
            className="h-12 w-12 rounded-xl bg-white object-contain p-1"
          />
          <div>
            <p className="text-base font-semibold text-white">{t('app.name')}</p>
            <p className="text-xs text-navy-200">{t('app.system')}</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            {t('auth.tagline')}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">{t('auth.blurb')}</p>

          <div className="mt-8 flex items-center gap-2.5 text-xs text-navy-200">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('auth.noSignup')}
          </div>
        </div>

        <p className="text-xs text-navy-300">
          © {new Date().getFullYear()} Colaad Public Notary Office
        </p>
      </div>

      {/* ---------- form ---------- */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img src={BUNDLED_LOGO} alt="" className="h-14 w-14 object-contain" />
          </div>

          {/* Language can be switched before signing in */}
          <div className="mb-6 flex items-center justify-end gap-1">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  lang === l.code
                    ? 'bg-navy-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">{t('auth.signIn')}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{t('auth.signInHint')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              autoComplete="username"
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
            />

            <div className="relative">
              <Input
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={busy}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-[34px] rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" loading={busy} icon={LogIn} className="w-full" size="lg">
              {t('auth.signIn')}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
            {t('auth.forgot')}
            <br />
            {t('auth.lockWarning')}
          </p>
        </div>
      </div>
    </div>
  )
}
