import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Check, X, AlertCircle, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../contexts/AuthContext'
import { useT } from '../../contexts/LanguageContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { HOME_BY_ROLE } from '../../constants'

const RULES = [
  { key: 'length', tKey: 'pw.ruleLength', test: (p) => p.length >= 8 },
  { key: 'letter', tKey: 'pw.ruleLetter', test: (p) => /[a-z]/i.test(p) },
  { key: 'number', tKey: 'pw.ruleNumber', test: (p) => /\d/.test(p) },
]

/**
 * This screen sits outside the dashboard shell. Until the temporary password
 * is replaced there is no sidebar, no navigation, and no data is fetched.
 */
export default function ChangePassword() {
  const { changePassword, profile, signOut } = useAuth()
  const t = useT()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const checks = useMemo(() => RULES.map((r) => ({ ...r, ok: r.test(password) })), [password])
  const allOk = checks.every((c) => c.ok)
  const matches = password.length > 0 && password === confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')

    if (!allOk) return setError(t('pw.notMeet'))
    if (!matches) return setError(t('pw.mismatch'))

    setBusy(true)
    try {
      await changePassword(password)
      toast.success(t('pw.updated'))
      navigate(HOME_BY_ROLE[profile?.role_code] ?? '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted px-6 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-navy-50 text-navy-700">
            <KeyRound className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-900">{t('pw.title')}</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {profile?.full_name}, {t('pw.subtitle')}
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

            <Input
              label={t('pw.new')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              disabled={busy}
            />

            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li
                  key={c.key}
                  className={`flex items-center gap-2 text-xs ${
                    c.ok ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {t(c.tKey)}
                </li>
              ))}
            </ul>

            <Input
              label={t('pw.confirm')}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
              error={confirm && !matches ? t('pw.mismatch') : undefined}
            />

            <Button
              type="submit"
              loading={busy}
              disabled={!allOk || !matches}
              className="w-full"
              size="lg"
            >
              {t('pw.save')}
            </Button>
          </form>
        </div>

        <button
          onClick={async () => {
            await signOut()
            navigate('/login', { replace: true })
          }}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
        >
          <LogOut className="h-3.5 w-3.5" /> {t('pw.signOutInstead')}
        </button>
      </div>
    </div>
  )
}
