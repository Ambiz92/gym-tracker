import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { validateSessionForm, type SessionFormErrors, type SessionFormResult, type SessionFormValues } from '../../lib/planForm'
import '../../styles/plans.css'

type ValidSession = Extract<SessionFormResult, { ok: true }>['session']

interface SessionFieldsProps {
  initial: SessionFormValues
  busy: boolean
  /** Failure of the last submit, announced to screen readers. */
  error: string | null
  onSubmit: (session: ValidSession) => void
}

/** Name, subtitle and bonus flag of a session. */
export function SessionFields({ initial, busy, error, onSubmit }: SessionFieldsProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<SessionFormErrors>({})

  function update<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateSessionForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.session)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field
        label="Nome"
        required
        value={values.name}
        onChange={(value) => update('name', value)}
        enterKeyHint="next"
        autoComplete="off"
        error={errors.name}
      />
      <Field
        label="Sottotitolo (facoltativo)"
        value={values.subtitle}
        onChange={(value) => update('subtitle', value)}
        enterKeyHint="done"
        autoComplete="off"
        error={errors.subtitle}
      />
      <label className="plans-check">
        <input
          type="checkbox"
          checked={values.isOptional}
          onChange={(event) => update('isOptional', event.target.checked)}
        />
        <span>
          Sessione bonus
          <small>Facoltativa nella settimana</small>
        </span>
      </label>
      <div className="plans-actions">
        {error && (
          <p role="alert" className="field__message field__message--error">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" busy={busy}>
          Salva sessione
        </PrimaryButton>
      </div>
    </form>
  )
}
