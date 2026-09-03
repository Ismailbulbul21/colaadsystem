import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, KeyRound, Unlock, UserX, UserCheck, Users, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/table/DataTable'
import Badge from '../../components/ui/Badge'
import { Input, Select, Checkbox } from '../../components/ui/Field'
import { supabase, callAdminAction } from '../../lib/supabaseClient'
import { friendlyError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'
import { ROLE_LABELS } from '../../constants'
import { useAuth } from '../../contexts/AuthContext'

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))
const BLANK = { full_name: '', username: '', password: '', phone: '', role_code: 'nootaayo', is_active: true }

export default function Employees() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [resetFor, setResetFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmState, setConfirmState] = useState(null)

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, username, phone, is_active, locked_until, failed_login_attempts, last_login_at, created_at, roles(code, name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] })

  const run = useMutation({
    mutationFn: ({ action, payload }) => callAdminAction(action, payload),
    onSuccess: (_d, vars) => {
      toast.success(vars.successMessage ?? 'Done')
      refresh()
      setCreateOpen(false)
      setResetFor(null)
      setNewPassword('')
      setForm(BLANK)
      setConfirmState(null)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const isLocked = (u) => u.locked_until && new Date(u.locked_until) > new Date()

  const columns = [
    {
      key: 'full_name',
      header: 'Employee',
      render: (u) => (
        <div>
          <p className="font-medium text-slate-800">{u.full_name}</p>
          <p className="text-xs text-slate-400">@{u.username}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <Badge tone="navy">{u.roles?.name}</Badge> },
    { key: 'phone', header: 'Phone', className: 'tabular' },
    {
      key: 'status',
      header: 'Status',
      render: (u) =>
        !u.is_active ? (
          <Badge tone="slate" dot>Disabled</Badge>
        ) : isLocked(u) ? (
          <Badge tone="red" dot>Locked</Badge>
        ) : (
          <Badge tone="emerald" dot>Active</Badge>
        ),
    },
    { key: 'last_login_at', header: 'Last sign-in', render: (u) => formatDateTime(u.last_login_at) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setResetFor(u)}>
            Reset
          </Button>
          {isLocked(u) && (
            <Button
              size="sm"
              variant="ghost"
              icon={Unlock}
              onClick={() =>
                run.mutate({ action: 'unlock_account', payload: { user_id: u.id }, successMessage: 'Account unlocked' })
              }
            >
              Unlock
            </Button>
          )}
          {u.id !== profile?.id && (
            <Button
              size="sm"
              variant="ghost"
              icon={u.is_active ? UserX : UserCheck}
              onClick={() =>
                setConfirmState({
                  title: u.is_active ? 'Disable this account?' : 'Activate this account?',
                  message: u.is_active
                    ? `${u.full_name} will not be able to sign in, and will lose access to all data immediately.`
                    : `${u.full_name} will be able to sign in again.`,
                  tone: u.is_active ? 'danger' : 'security',
                  confirmLabel: u.is_active ? 'Disable' : 'Activate',
                  onConfirm: () =>
                    run.mutate({
                      action: 'set_active',
                      payload: { user_id: u.id, is_active: !u.is_active },
                      successMessage: u.is_active ? 'Account disabled' : 'Account activated',
                    }),
                })
              }
            >
              {u.is_active ? 'Disable' : 'Activate'}
            </Button>
          )}
          {u.id !== profile?.id && (
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              className="text-red-600 hover:bg-red-50"
              onClick={() =>
                setConfirmState({
                  title: 'Permanently delete this account?',
                  message: (
                    <>
                      <p>
                        <strong>{u.full_name}</strong> (@{u.username}) will be removed
                        completely and will never be able to sign in again. This cannot
                        be undone.
                      </p>
                      <p className="mt-2">
                        Their past work is kept: clients, receipts, payments and activity
                        logs all store the employee name alongside the link, so history and
                        reports still read correctly.
                      </p>
                      <p className="mt-2 text-slate-500">
                        To keep the account but block sign-in, use <strong>Disable</strong> instead.
                      </p>
                    </>
                  ),
                  tone: 'danger',
                  confirmLabel: 'Delete permanently',
                  confirmPhrase: u.username,
                  onConfirm: () =>
                    run.mutate({
                      action: 'delete_account',
                      payload: { user_id: u.id },
                      successMessage: `${u.full_name} was permanently deleted`,
                    }),
                })
              }
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Employees"
        description="Accounts are created here. Employees cannot sign up themselves."
        actions={
          <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
            Add Employee
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data}
        total={data.length}
        page={1}
        pageSize={data.length || 1}
        loading={isLoading}
        error={isError ? error : null}
        onRetry={refetch}
        emptyIcon={Users}
        emptyTitle="No employees yet"
        emptyDescription="Add the first employee account to get started."
        exportFileName="employees"
      />

      {/* ---------- create ---------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Employee"
        description="They will be forced to change this temporary password on first sign-in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={run.isPending}
              disabled={!form.full_name || !form.username || form.password.length < 8}
              onClick={() =>
                run.mutate({ action: 'create_employee', payload: form, successMessage: 'Employee account created' })
              }
            >
              Create account
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} wrapperClassName="sm:col-span-2" />
          <Input label="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} hint="Letters, numbers, dot, dash" autoCapitalize="none" />
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Temporary password" required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="At least 8 characters. Give this to the employee." />
          <Select label="Role" required value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} options={ROLE_OPTIONS} />
          <Checkbox label="Account is active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="sm:col-span-2" />
        </div>
      </Modal>

      {/* ---------- reset password ---------- */}
      <Modal
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title="Reset password"
        description={`${resetFor?.full_name} will be forced to change it on next sign-in.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button
              loading={run.isPending}
              disabled={newPassword.length < 8}
              onClick={() =>
                run.mutate({
                  action: 'reset_password',
                  payload: { user_id: resetFor.id, new_password: newPassword },
                  successMessage: 'Password reset',
                })
              }
            >
              Reset password
            </Button>
          </>
        }
      >
        <Input label="New temporary password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="At least 8 characters" autoFocus />
      </Modal>

      <ConfirmDialog
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        loading={run.isPending}
        {...(confirmState ?? {})}
      />
    </>
  )
}
