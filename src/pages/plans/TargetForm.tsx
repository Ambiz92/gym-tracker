import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import {
  UNIT_LABELS,
  UNIT_ORDER,
  validateTargetForm,
  type PlanTarget,
  type TargetFormErrors,
  type TargetFormValues,
} from '../../lib/planForm'
import { repsWarning } from '../../lib/validation'
import '../../styles/exercises.css'
import '../../styles/plans.css'

interface TargetFormProps {
  initial: TargetFormValues
  /** Request in flight: the submit button is blocked. */
  busy: boolean
  /** Failure of the last submit, announced to screen readers. */
  error: string | null
  onSubmit: (target: PlanTarget) => void
  onCancel: () => void
}

/** Sets, reps (or seconds, or meters) and suggested weight of one exercise in a session. */
export function TargetForm({ initial, busy, error, onSubmit, onCancel }: TargetFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<TargetFormErrors>({})
  const unitName = useId()
  const formRef = useRef<HTMLFormElement>(null)

  // Each failed submit stores a new errors object, so focus returns to the first invalid field every time.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  function update<K extends keyof TargetFormValues>(key: K, value: TargetFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateTargetForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.target)
  }

  const reps = Number(values.reps)
  const repsHint = Number.isInteger(reps) ? (repsWarning(reps, values.unit) ?? undefined) : undefined

  return (
    <form ref={formRef} className="plan-editor" onSubmit={handleSubmit} noValidate>
      <div className="plan-editor__numbers">
        <Field
          label="Serie"
          value={values.sets}
          onChange={(value) => update('sets', value)}
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete="off"
          error={errors.sets}
        />
        <Field
          label={UNIT_LABELS[values.unit]}
          value={values.reps}
          onChange={(value) => update('reps', value)}
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete="off"
          hint={repsHint}
          error={errors.reps}
        />
      </div>
      <fieldset className="plan-editor__fieldset">
        <legend className="field__label">Unità</legend>
        {/* Same segmented look as the equipment choice of the exercise form. */}
        <div className="equipment-field__options">
          {UNIT_ORDER.map((unit) => (
            <label key={unit} className="equipment-field__option">
              <input
                type="radio"
                name={unitName}
                value={unit}
                checked={values.unit === unit}
                onChange={() => update('unit', unit)}
              />
              <span>{UNIT_LABELS[unit]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="plan-editor__numbers">
        <Field
          label="Peso suggerito (kg)"
          value={values.weight}
          onChange={(value) => update('weight', value)}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="Facoltativo"
          error={errors.weight}
        />
        <Field
          label="Fino a (kg)"
          value={values.weightMax}
          onChange={(value) => update('weightMax', value)}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="Facoltativo"
          error={errors.weightMax}
        />
      </div>
      <div className="plans-actions">
        {error && (
          <p role="alert" className="field__message field__message--error">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" busy={busy}>
          Salva
        </PrimaryButton>
        <PrimaryButton variant="outline" disabled={busy} onClick={onCancel}>
          Annulla
        </PrimaryButton>
      </div>
    </form>
  )
}
