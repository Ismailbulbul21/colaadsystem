import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null)

  // Callers pass an inline arrow for onClose, so it is a new function on every
  // render. Keeping it in a ref stops that from re-running the effects below —
  // which previously stole focus out of the form on every keystroke.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.()
    document.addEventListener('keydown', onKey)
    // Stop the page behind the modal from scrolling under it
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // Focus the panel only as the dialog opens, never on subsequent renders.
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 no-print">
      <div
        className="fixed inset-0 bg-navy-950/40 backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 my-auto w-full rounded-xl bg-white shadow-panel animate-slide-up outline-none',
          SIZES[size],
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
            <div>
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        )}

        <div className="px-5 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-surface-border bg-surface-muted px-5 py-3.5 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
