import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2, Pencil, Calculator, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useDebounce } from '../../hooks/useDebounce'
import {
  listFeeRules, saveFeeRule, retireFeeRule, calculateFees, describeRule,
} from '../../services/notaryFeeService'
import { listActiveServices } from '../../services/serviceService'
import { friendlyError } from '../../utils/errors'
import { qk, LONG_CACHE } from '../../lib/queryClient'

const RULE_TYPES = [
  { value: 'percentage', label: 'Percentage of amount' },
  { value: 'fixed', label: 'Fixed amount' },
]

const blank = () => ({
  category: '', rule_type: 'percentage', rule_value: '',
  applies_to_category: '', display_order: 0, is_active: true, notes: '',
})

/**
 * The fees charged on every notary service.
 *
 * Each rule is either a percentage of the transaction amount or a flat
 * charge. The tester at the bottom runs the real database calculation, so
 * what the Administrator sees here is exactly what an officer will get.
 */
export default function FeeRules() {
  const { money } = useOfficeSettings()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [retiring, setRetiring] = useState(null)

  const rules = useQuery({ queryKey: ['fee-rules'], queryFn: () => listFeeRules() })
  const services = useQuery({
    queryKey: qk.services('active'), queryFn: listActiveServices, ...LONG_CACHE,
  })

  const categories = useMemo(
    () => [...new Set((services.data ?? []).map((s) => s.category))].sort(),
    [services.data],
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fee-rules'] })

  const retire = useMutation({
    mutationFn: (id) => retireFeeRule(id),
    onSuccess: () => { toast.success('Rule removed'); setRetiring(null); refresh() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const rows = rules.data ?? []

  return (
    <>
      <PageHeader
        title="Fee Rules"
        description="What each service is charged. The officer never works a fee out by hand — the system applies these rules the moment an amount is typed."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Fee Rules' }]}
        actions={
          <Button icon={Plus} onClick={() => setEditing(blank())}>Add Fee Rule</Button>
        }
      />

      <div className="card mb-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 font-medium">Fee Category</th>
              <th className="px-4 py-3 font-medium">Calculation Rule</th>
              <th className="px-4 py-3 font-medium">Applies To</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rules.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">Loading…</td></tr>
            )}
            {!rules.isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">
                No fee rules yet. Press Add Fee Rule.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink-800">{r.category}</td>
                <td className="px-4 py-3">
                  <Badge tone={r.rule_type === 'percentage' ? 'blue' : 'slate'}>
                    {describeRule(r)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {r.applies_to_category
                    ? `${r.applies_to_category} services`
                    : 'All services'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.is_active ? 'emerald' : 'slate'} dot>
                    {r.is_active ? 'Active' : 'Off'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" icon={Pencil}
                            onClick={() => setEditing({
                              ...r,
                              applies_to_category: r.applies_to_category ?? '',
                              notes: r.notes ?? '',
                            })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" icon={Trash2}
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setRetiring(r)}>
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FeeTester money={money} />

      <RuleModal
        rule={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); refresh() }}
      />

      <ConfirmDialog
        open={!!retiring}
        title="Remove this fee rule?"
        message={retiring
          ? `"${retiring.category}" will not be charged on new services. Services already recorded keep the fees they were given.`
          : ''}
        confirmLabel="Yes, remove"
        tone="warning"
        loading={retire.isPending}
        onConfirm={() => retire.mutate(retiring.id)}
        onClose={() => setRetiring(null)}
      />
    </>
  )
}

/**
 * Runs the real calculation so the Administrator can see the effect of a rule
 * change before an officer meets it on a live service.
 */
function FeeTester({ money }) {
  const [amount, setAmount] = useState('30000')
  const debounced = useDebounce(amount, 400)

  const result = useQuery({
    queryKey: ['fee-preview', debounced],
    queryFn: () => calculateFees(debounced),
    enabled: debounced !== '' && Number(debounced) >= 0,
  })
  const r = result.data

  return (
    <div className="card p-6">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Calculator className="h-4 w-4 text-ink-400" /> Try it
      </h3>
      <p className="mb-4 text-[13px] text-ink-500">
        Type an amount to see exactly what an officer will be shown.
      </p>

      <div className="grid gap-5 sm:grid-cols-3">
        <Input
          label="Transaction amount (USD)" type="number" min="0" step="0.01"
          value={amount} onChange={(e) => setAmount(e.target.value)}
        />

        <div className="sm:col-span-2">
          {r ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-ink-500">
                  <th className="py-1.5 font-medium">Fee</th>
                  <th className="py-1.5 font-medium">Rule</th>
                  <th className="py-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(r.lines ?? []).map((l) => (
                  <tr key={l.rule_id} className="border-b border-surface-border">
                    <td className="py-1.5 text-ink-700">{l.category}</td>
                    <td className="py-1.5 text-ink-500">
                      {l.rule_type === 'percentage'
                        ? `${Number(l.rule_value)}%`
                        : `$${Number(l.rule_value).toFixed(2)}`}
                    </td>
                    <td className="py-1.5 text-right tabular">{money(l.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>Total fees</td>
                  <td className="py-2 text-right tabular text-navy-800">{money(r.total_fees)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-400">Enter an amount.</p>
          )}

          {r && (
            <div className="mt-4 rounded-lg border border-surface-border bg-surface-sunken p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Customer pays altogether</span>
                <span className="tabular font-semibold">{money(r.grand_total)}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
                Of that, the office earns <strong>{money(r.total_fees)}</strong>.
                The {money(r.amount)} passes between the two parties and is not
                office income — only the fees reach Finance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RuleModal({ rule, categories, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [loadedId, setLoadedId] = useState(null)

  const key = rule?.id ?? (rule ? 'new' : null)
  if (rule && key !== loadedId) { setLoadedId(key); setForm({ ...rule }) }
  if (!rule && loadedId) { setLoadedId(null); setForm(null) }

  const save = useMutation({
    mutationFn: () => saveFeeRule(form),
    onSuccess: () => { toast.success('Saved'); onSaved() },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!rule || !form) return null
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const isPct = form.rule_type === 'percentage'

  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit fee rule' : 'Add fee rule'}>
      <div className="space-y-3">
        <Input label="Fee category" required value={form.category}
               onChange={set('category')} placeholder="e.g. Maaliyadda" />
        <Select label="Calculation rule" required value={form.rule_type}
                onChange={set('rule_type')} options={RULE_TYPES} />
        <Input
          label={isPct ? 'Percentage (%)' : 'Fixed amount (USD)'}
          required type="number" min="0" step={isPct ? '0.01' : '0.01'}
          value={form.rule_value} onChange={set('rule_value')}
          hint={isPct ? 'Type 3 for 3% of the transaction amount' : 'Charged whatever the amount'}
        />
        <Select label="Applies to" placeholder="All services"
                value={form.applies_to_category} onChange={set('applies_to_category')}
                options={categories.map((c) => ({ value: c, label: `${c} services` }))}
                hint="Leave blank to charge it on every service" />
        <Input label="Order" type="number" value={form.display_order}
               onChange={set('display_order')} hint="Lower numbers appear first" />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={form.is_active !== false}
                 onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                 className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
          Charge this fee
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Save} loading={save.isPending}
                disabled={!form.category.trim() || form.rule_value === ''}
                onClick={() => save.mutate()}>
          Save rule
        </Button>
      </div>
    </Modal>
  )
}
