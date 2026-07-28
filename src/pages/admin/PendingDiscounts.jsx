import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgePercent, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Input, Textarea, ReadOnlyMoney } from '../../components/ui/Field'
import { TableSkeleton } from '../../components/feedback/Skeleton'
import { EmptyState, ErrorState } from '../../components/feedback/States'
import { listPendingDiscounts, approveDiscount, rejectDiscount } from '../../services/clientService'
import { useOfficeSettings } from '../../contexts/OfficeSettingsContext'
import { useRealtime } from '../../hooks/useRealtime'
import { friendlyError } from '../../utils/errors'
import { formatRelative } from '../../utils/format'

export default function PendingDiscounts() {
  const queryClient = useQueryClient()
  const { money, currency } = useOfficeSettings()

  const [active, setActive] = useState(null)
  const [mode, setMode] = useState(null) // 'approve' | 'reject'
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['discounts', 'pending'],
    queryFn: listPendingDiscounts,
    staleTime: 15_000,
  })

  useRealtime('discount_requests', [['discounts', 'pending'], ['stats', 'admin'], ['sidebar-badges', 'admin']])

  const close = () => {
    setActive(null)
    setMode(null)
    setAmount('')
    setNotes('')
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['discounts'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
  }

  const approve = useMutation({
    mutationFn: () => approveDiscount(active.id, Number(amount), notes || null),
    onSuccess: (res) => {
      toast.success(`Approved — final amount ${money(res.final_price)}`)
      invalidate()
      close()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const reject = useMutation({
    mutationFn: () => rejectDiscount(active.id, notes),
    onSuccess: () => {
      toast.success('Discount request rejected')
      invalidate()
      close()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (isError) return <ErrorState error={error} onRetry={refetch} />

  const original = Number(active?.original_price ?? 0)
  const discount = Number(amount || 0)
  const finalPrice = Math.max(0, original - discount)
  const invalidAmount = amount !== '' && (discount < 0 || discount > original)

  return (
    <>
      <PageHeader
        title="Pending Discount Requests"
        description="Registration sends the reason. You decide the amount, and it is then locked."
      />

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : !data?.length ? (
        <EmptyState
          icon={BadgePercent}
          title="No discount requests waiting"
          description="When Registration asks for a discount it will appear here for your decision."
        />
      ) : (
        <div className="space-y-3">
          {data.map((req) => (
            <div key={req.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">
                    {req.clients?.full_name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 tabular">
                    {req.clients?.registration_no} · {req.clients?.phone}
                  </p>
                  <p className="mt-3 text-sm text-slate-700">
                    <span className="text-slate-500">Service:</span>{' '}
                    {req.clients?.service_name_snapshot}
                  </p>
                  <div className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5">
                    <p className="text-xs font-medium text-amber-900">Reason given</p>
                    <p className="mt-0.5 text-sm text-amber-800">{req.reason}</p>
                  </div>
                  <p className="mt-2.5 text-[11px] text-slate-400">
                    Requested {formatRelative(req.requested_at)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Original price</p>
                    <p className="text-2xl font-semibold tabular text-slate-900">
                      {money(req.original_price)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      icon={X}
                      onClick={() => {
                        setActive(req)
                        setMode('reject')
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="success"
                      icon={Check}
                      onClick={() => {
                        setActive(req)
                        setMode('approve')
                        setAmount('')
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- approve ---------- */}
      <Modal
        open={mode === 'approve'}
        onClose={close}
        title="Approve discount"
        description={`${active?.clients?.full_name} — ${active?.clients?.service_name_snapshot}`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="success"
              loading={approve.isPending}
              disabled={amount === '' || invalidAmount}
              onClick={() => approve.mutate()}
            >
              Approve and lock {money(finalPrice)}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-muted px-3.5 py-2.5">
            <p className="text-xs font-medium text-slate-600">Reason given by Registration</p>
            <p className="mt-0.5 text-sm text-slate-800">{active?.reason}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyMoney label="Original price" value={original} symbol={currency} />
            <Input
              label="Discount amount"
              required
              type="number"
              step="0.01"
              min="0"
              max={original}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={invalidAmount ? `Must be between 0 and ${money(original)}` : undefined}
              autoFocus
            />
          </div>

          <ReadOnlyMoney
            label="Final amount the client pays"
            value={finalPrice}
            symbol={currency}
            tone="success"
            note="Locked once approved. Registration cannot change it afterwards."
          />

          <Textarea
            label="Admin notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            hint="Optional — stored on the audit record"
            rows={2}
          />
        </div>
      </Modal>

      {/* ---------- reject ---------- */}
      <Modal
        open={mode === 'reject'}
        onClose={close}
        title="Reject discount request"
        description={`${active?.clients?.full_name} will pay the full price of ${money(original)}.`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              disabled={!notes.trim()}
              onClick={() => reject.mutate()}
            >
              Reject request
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rejecting"
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          autoFocus
          hint="Registration will see this."
        />
      </Modal>
    </>
  )
}
