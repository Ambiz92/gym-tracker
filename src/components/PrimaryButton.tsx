import type { ReactNode } from 'react'

interface PrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Request in flight: announces aria-busy and blocks further clicks. */
  busy?: boolean
  variant?: 'solid' | 'outline'
}

/** Full-width action bar with a trailing arrow. */
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  busy = false,
  variant = 'solid',
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`primary-button primary-button--${variant}`}
    >
      <span>{children}</span>
      <span className="primary-button__arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}
