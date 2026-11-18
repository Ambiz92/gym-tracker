import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { validateName } from '../../lib/planForm'
import '../../styles/plans.css'

interface NameFormProps {
  noun: 'scheda' | 'sessione'
  initial?: string
  submitLabel: string
  /** Request in flight: the submit button is blocked. */
  busy: boolean
  /** Failure of the last submit, announced to screen readers. */
  error: string | null
  onSubmit: (name: string) => void
  onCancel: () => void
}

/** One name field with save and cancel: creates or renames a plan, adds a session. */
export function NameForm({ noun, initial = '', submitLabel, busy, error, onSubmit, onCancel }: NameFormProps) {
  const [text, setText] = useState(initial)
  const [invalid, setInvalid] = useState<string>()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateName(text, noun)
    if (!result.ok) {
      setInvalid(result.error)
      return
    }
    setInvalid(undefined)
    onSubmit(result.name)
  }

  return (
    <form ref={formRef} className="plans-form" onSubmit={handleSubmit} noValidate>
      <Field
        label="Nome"
        required
        value={text}
        onChange={setText}
        enterKeyHint="done"
        autoComplete="off"
        error={invalid}
      />
      {error && (
        <p role="alert" className="field__message field__message--error">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" busy={busy}>
        {submitLabel}
      </PrimaryButton>
      <PrimaryButton variant="outline" disabled={busy} onClick={onCancel}>
        Annulla
      </PrimaryButton>
    </form>
  )
}
