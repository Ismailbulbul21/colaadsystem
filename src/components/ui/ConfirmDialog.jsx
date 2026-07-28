import { useState, useCallback } from 'react'
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { Input } from './Field'

const TONES = {
  danger: { icon: Trash2, wrap: 'bg-red-50 text-red-600', button: 'danger' },
  warning: { icon: AlertTriangle, wrap: 'bg-amber-50 text-amber-600', button: 'primary' },
  security: { icon: ShieldAlert, wrap: 'bg-navy-50 text-navy-700', button: 'primary' },
}

/**
 * Confirmation before anything destructive or financial.
 * `confirmPhrase` forces the user to type a word for the worst cases
 * (deleting an account, replacing a signed document).
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warning',
  confirmPhrase,
  loading = false,
}) {
  const [typed, setTyped] = useState('')
  const meta = TONES[tone] ?? TONES.warning
  const Icon = meta.icon
  const blocked = confirmPhrase ? typed.trim().toLowerCase() !== confirmPhrase.toLowerCase() : false

  const handleClose = useCallback(() => {
    setTyped('')
    onClose?.()
  }, [onClose])

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : handleClose}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={meta.button}
            loading={loading}
            disabled={blocked}
            onClick={async () => {
              await onConfirm?.()
              setTyped('')
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${meta.wrap}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <div className="mt-1.5 text-sm text-slate-600">{message}</div>

          {confirmPhrase && (
            <Input
              className="mt-4"
              label={`Type “${confirmPhrase}” to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={confirmPhrase}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Hook so pages do not each re-implement open/close/loading state. */
export function useConfirm() {
  const [state, setState] = useState({ open: false })

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const dialog = (
    <ConfirmDialog
      {...state}
      onClose={() => {
        state.resolve?.(false)
        close()
      }}
      onConfirm={() => {
        state.resolve?.(true)
        close()
      }}
    />
  )

  return { confirm, dialog }
}
