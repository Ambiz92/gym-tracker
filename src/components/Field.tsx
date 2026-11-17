import { useId } from 'react'

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email'
  /** Soft-keyboard layout; use "decimal" for weights instead of type="number". */
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email'
  enterKeyHint?: 'next' | 'done' | 'go' | 'send'
  required?: boolean
  autoComplete?: string
  placeholder?: string
  hint?: string
  error?: string
}

/** Underline input with a persistent label; hint and error are linked via aria-describedby. */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  enterKeyHint,
  required = false,
  autoComplete,
  placeholder,
  hint,
  error,
}: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="field__input"
        type={type}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
      />
      {message && (
        <p
          id={messageId}
          className={error ? 'field__message field__message--error' : 'field__message'}
        >
          {message}
        </p>
      )}
    </div>
  )
}
