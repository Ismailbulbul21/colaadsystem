import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Save, User } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'
import { useLanguage } from '../../contexts/LanguageContext'

export default function Profile() {
  const { profile, changePassword, refreshProfile } = useAuth()
  const { t, setLang, languages } = useLanguage()

  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [language, setLanguage] = useState(profile?.preferred_language ?? 'en')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('users')
        .update({ phone: phone.trim() || null, preferred_language: language })
        .eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
    },
    onSuccess: () => toast.success('Profile updated'),
    onError: (e) => toast.error(friendlyError(e)),
  })

  const savePassword = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: () => {
      toast.success('Password changed')
      setPassword('')
      setConfirm('')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const passwordValid = password.length >= 8 && password === confirm

  return (
    <>
      <PageHeader title="My Profile" description="Your account details and password." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <User className="h-4 w-4 text-slate-400" /> Account
          </h3>

          <dl className="mb-5 space-y-2.5 rounded-lg bg-surface-muted p-4 text-sm">
            {[
              ['Full name', profile?.full_name],
              ['Username', `@${profile?.username}`],
              ['Role', t(`role.${profile?.role_code}`, profile?.role_code)],
              ['Last sign-in', formatDateTime(profile?.last_login_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800">{v || '—'}</dd>
              </div>
            ))}
          </dl>

          <p className="mb-4 text-xs text-slate-400">
            Only an Administrator can change your name, username or role.
          </p>

          <div className="space-y-4">
            <Input
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Select
              label={t('common.language')}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setLang(e.target.value) // apply straight away, before saving
              }}
              options={languages.map((l) => ({ value: l.code, label: l.label }))}
            />
            <Button icon={Save} loading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
              Save changes
            </Button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <KeyRound className="h-4 w-4 text-slate-400" /> Change password
          </h3>

          <div className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hint="At least 8 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={confirm && password !== confirm ? 'Passwords do not match' : undefined}
            />
            <Button
              icon={KeyRound}
              disabled={!passwordValid}
              loading={savePassword.isPending}
              onClick={() => savePassword.mutate()}
            >
              Update password
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
