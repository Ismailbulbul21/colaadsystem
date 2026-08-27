import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Save, X, Archive } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Input, Select } from '../../components/ui/Field'
import {
  listTypes, listMethods, saveType, saveMethod, retireType, retireMethod,
} from '../../services/financeLedgerService'
import { friendlyError } from '../../utils/errors'

const BUCKETS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'mobile', label: 'Mobile Money' },
]

/**
 * The lists behind the two ledger forms, so the office can add a new kind of
 * income or a new way of being paid without waiting for a code change.
 *
 * Nothing here is ever hard-deleted. Every ledger entry copied its type and
 * method NAME in at the time, so retiring one only stops it appearing on new
 * entries — last year's report still reads exactly as it did.
 */
export default function LedgerSetup() {
  const queryClient = useQueryClient()
  const [retiring, setRetiring] = useState(null)

  const types = useQuery({ queryKey: ['finance-types'], queryFn: () => listTypes() })
  const methods = useQuery({ queryKey: ['finance-methods'], queryFn: listMethods })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-types'] })
    queryClient.invalidateQueries({ queryKey: ['finance-methods'] })
  }

  const retire = useMutation({
    mutationFn: ({ what, id }) => (what === 'type' ? retireType(id) : retireMethod(id)),
    onSuccess: () => { toast.success('Removed from the list'); setRetiring(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  return (
    <>
      <PageHeader
        title="Finance Setup"
        description="The income types, expense types and payment methods offered on the ledger forms."
        breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Setup' }]}
        actions={
          <Link to="/finance">
            <Button variant="secondary" icon={ArrowLeft}>Back</Button>
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <TypeList
          title="Income Types" kind="income"
          rows={(types.data ?? []).filter((t) => t.kind === 'income')}
          loading={types.isLoading} onChanged={refresh} onRetire={setRetiring}
        />
        <TypeList
          title="Expense Types" kind="expense"
          rows={(types.data ?? []).filter((t) => t.kind === 'expense')}
          loading={types.isLoading} onChanged={refresh} onRetire={setRetiring}
        />
        <MethodList
          rows={methods.data ?? []} loading={methods.isLoading}
          onChanged={refresh} onRetire={setRetiring}
        />
      </div>

      <ConfirmDialog
        open={!!retiring}
        title="Remove from the list?"
        message={
          retiring
            ? `"${retiring.name}" will no longer be offered on new entries. Every entry already recorded with it keeps its name and stays correct.`
            : ''
        }
        confirmLabel="Yes, remove"
        tone="warning"
        loading={retire.isPending}
        onConfirm={() => retire.mutate(retiring)}
        onClose={() => setRetiring(null)}
      />
    </>
  )
}

function TypeList({ title, kind, rows, loading, onChanged, onRetire }) {
  const [name, setName] = useState('')

  const add = useMutation({
    mutationFn: () => saveType({ kind, name }),
    onSuccess: () => { toast.success('Added'); setName(''); onChanged() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const toggle = useMutation({
    mutationFn: (row) => saveType({ id: row.id, kind: row.kind, name: row.name, is_active: !row.is_active }),
    onSuccess: onChanged,
    onError: (e) => toast.error(friendlyError(e)),
  })

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-ink-800">{title}</h3>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate() }}
        className="mb-4 flex items-end gap-2"
      >
        <Input label="Add new" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="e.g. Notary Fee" wrapperClassName="mb-0 flex-1" />
        <Button type="submit" icon={Plus} loading={add.isPending} disabled={!name.trim()}>
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length ? (
        <ul className="divide-y divide-surface-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <span className={clsx('min-w-0 flex-1 truncate text-sm',
                r.is_active ? 'text-ink-700' : 'text-ink-400 line-through')}>
                {r.name}
              </span>
              <button
                type="button"
                onClick={() => toggle.mutate(r)}
                className="shrink-0"
                title={r.is_active ? 'Hide from the form' : 'Show on the form'}
              >
                <Badge tone={r.is_active ? 'emerald' : 'slate'}>
                  {r.is_active ? 'On' : 'Off'}
                </Badge>
              </button>
              <Button size="sm" variant="ghost" icon={X}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onRetire({ what: 'type', id: r.id, name: r.name })}>
                <span className="sr-only">Remove {r.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-400">Nothing in this list yet.</p>
      )}
    </div>
  )
}

function MethodList({ rows, loading, onChanged, onRetire }) {
  const [form, setForm] = useState({ name: '', bucket: 'cash' })

  const add = useMutation({
    mutationFn: () => saveMethod(form),
    onSuccess: () => { toast.success('Added'); setForm({ name: '', bucket: 'cash' }); onChanged() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const toggle = useMutation({
    mutationFn: (row) => saveMethod({ id: row.id, name: row.name, bucket: row.bucket, is_active: !row.is_active }),
    onSuccess: onChanged,
    onError: (e) => toast.error(friendlyError(e)),
  })

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold text-ink-800">Payment Methods</h3>
      <p className="mb-4 text-xs text-ink-500">
        Each one counts towards one of the three balances.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) add.mutate() }}
        className="mb-4 space-y-2"
      >
        <Input label="Add new" value={form.name}
               onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
               placeholder="e.g. EVC Plus" wrapperClassName="mb-0" />
        <div className="flex items-end gap-2">
          <Select label="Counts as" value={form.bucket} options={BUCKETS}
                  onChange={(e) => setForm((p) => ({ ...p, bucket: e.target.value }))}
                  wrapperClassName="mb-0 flex-1" />
          <Button type="submit" icon={Plus} loading={add.isPending} disabled={!form.name.trim()}>
            Add
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <span className={clsx('min-w-0 flex-1 truncate text-sm',
                r.is_active ? 'text-ink-700' : 'text-ink-400 line-through')}>
                {r.name}
              </span>
              <Badge tone={{ cash: 'emerald', bank: 'blue', mobile: 'violet' }[r.bucket]}>
                {BUCKETS.find((b) => b.value === r.bucket)?.label}
              </Badge>
              <button type="button" onClick={() => toggle.mutate(r)} className="shrink-0"
                      title={r.is_active ? 'Hide from the form' : 'Show on the form'}>
                <Badge tone={r.is_active ? 'emerald' : 'slate'}>{r.is_active ? 'On' : 'Off'}</Badge>
              </button>
              <Button size="sm" variant="ghost" icon={X}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onRetire({ what: 'method', id: r.id, name: r.name })}>
                <span className="sr-only">Remove {r.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
