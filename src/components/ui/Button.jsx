import { forwardRef } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'bg-navy-900 text-white shadow-xs hover:bg-navy-800 active:bg-navy-950 active:scale-[0.985]',
  secondary:
    'bg-white text-ink-700 border border-surface-border shadow-xs hover:bg-surface-muted hover:border-ink-300 active:scale-[0.985]',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:scale-[0.985]',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:scale-[0.985]',
  success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-[0.985]',
  outline: 'border border-navy-200 text-navy-800 hover:bg-navy-50 active:scale-[0.985]',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-[13px] gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9',
}

/**
 * `loading` disables the button as well as showing a spinner, which is the
 * cheapest possible guard against a double-submitted payment or client.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
      {size !== 'icon' && children}
      {IconRight && !loading && <IconRight className="h-4 w-4" />}
    </button>
  )
})

export default Button
