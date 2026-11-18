import type { ReactNode } from 'react'

/** Failure announced to screen readers the moment it appears. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="field__message field__message--error">
      {message}
    </p>
  )
}

/** Spaces the submit and back buttons away from the fields. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 'var(--ds-space-3)', marginTop: 'var(--ds-space-6)' }}>{children}</div>
}
