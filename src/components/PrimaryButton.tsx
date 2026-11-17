import type { ReactNode } from 'react'

interface PrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  variant?: 'solid' | 'outline'
}

/** Full-width action bar with a trailing arrow. */
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'solid',
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`primary-button primary-button--${variant}`}
    >
      <span>{children}</span>
      <span className="primary-button__arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}
