import { forwardRef, useId } from 'react'
import clsx from 'clsx'

const base =
  'w-full rounded-lg border bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 ' +
  'transition-colors focus:border-navy-500 disabled:cursor-not-allowed disabled:bg-slate-50 ' +
  'disabled:text-slate-500'

function wrapperClasses(error) {
  return clsx(base, error ? 'border-red-300 focus:border-red-500' : 'border-surface-border')
}

export function FieldShell({ label, required, error, hint, htmlFor, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="error-text">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef(function Input(
  { label, error, hint, required, className, wrapperClassName, ...props },
  ref,
) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={wrapperClassName}
    >
      <input
        id={id}
        ref={ref}
        aria-invalid={!!error}
        className={clsx(wrapperClasses(error), 'h-10', className)}
        {...props}
      />
    </FieldShell>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, rows = 3, className, wrapperClassName, ...props },
  ref,
) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={wrapperClassName}
    >
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        aria-invalid={!!error}
        className={clsx(wrapperClasses(error), 'py-2 resize-y', className)}
        {...props}
      />
    </FieldShell>
  )
})

export const Select = forwardRef(function Select(
  { label, error, hint, required, options = [], placeholder, className, wrapperClassName, children, ...props },
  ref,
) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={id}
      className={wrapperClassName}
    >
      <select
        id={id}
        ref={ref}
        aria-invalid={!!error}
        className={clsx(wrapperClasses(error), 'h-10 pr-8', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  )
})

export const Checkbox = forwardRef(function Checkbox({ label, hint, className, ...props }, ref) {
  const id = useId()
  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        id={id}
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
        {...props}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-700 cursor-pointer">
          {label}
        </label>
        {hint && <p className="hint">{hint}</p>}
      </div>
    </div>
  )
})

/**
 * Read-only money display used wherever a price must be visible but
 * untouchable. There is no `input` here at all, so there is nothing for a
 * curious employee to re-enable in DevTools.
 */
export function ReadOnlyMoney({ label, value, symbol = '$', tone = 'default', note }) {
  const tones = {
    default: 'bg-slate-50 border-surface-border text-slate-800',
    locked: 'bg-navy-50 border-navy-200 text-navy-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div
        className={clsx(
          'flex h-10 items-center rounded-lg border px-3 text-sm font-semibold tabular',
          tones[tone],
        )}
      >
        {symbol}
        {Number(value ?? 0).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
      {note && <p className="hint">{note}</p>}
    </div>
  )
}
