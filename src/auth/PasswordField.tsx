import { useId } from 'react'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password'
  enterKeyHint?: 'next' | 'done' | 'go' | 'send'
  required?: boolean
}

/** Masked twin of the shared Field (which has no password type), using the same classes. */
export function PasswordField({ label, value, onChange, autoComplete, enterKeyHint, required = false }: PasswordFieldProps) {
  const id = useId()

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="field__input"
        type="password"
        enterKeyHint={enterKeyHint}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  )
}
