import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  validateExerciseForm,
  type ExerciseFormErrors,
  type ExerciseFormValues,
} from '../lib/exerciseForm'
import type { ExerciseInsert } from '../types/db'
import { EquipmentField, StepsEditor, TextAreaField } from './ExerciseFormParts'
import { Field } from './Field'
import { PrimaryButton } from './PrimaryButton'
import '../styles/exercises.css'

interface ExerciseFormProps {
  initial: ExerciseFormValues
  /** Request in flight: the submit button is blocked. */
  busy: boolean
  /** Failure of the last submit, announced to screen readers. */
  error: string | null
  submitLabel: string
  /** Buttons next to the submit one; on desktop they sit beside it. */
  extraActions?: ReactNode
  onSubmit: (exercise: ExerciseInsert) => void
}

/** Create/edit form for an exercise: validates against the database limits before calling `onSubmit`. */
export function ExerciseForm({ initial, busy, error, submitLabel, extraActions, onSubmit }: ExerciseFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<ExerciseFormErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  // Each failed submit stores a new errors object, so focus returns to the first invalid field every time.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  function update<K extends keyof ExerciseFormValues>(key: K, value: ExerciseFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateExerciseForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.exercise)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <Field
        label="Nome"
        required
        value={values.name}
        onChange={(value) => update('name', value)}
        enterKeyHint="next"
        autoComplete="off"
        error={errors.name}
      />
      <EquipmentField value={values.equipment} onChange={(value) => update('equipment', value)} />
      <Field
        label="Peso iniziale in kg (facoltativo)"
        value={values.startingWeight}
        onChange={(value) => update('startingWeight', value)}
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        hint="Per i manubri, il peso di un solo manubrio. Ad esempio 12,5."
        error={errors.startingWeight}
      />
      <Field
        label="Muscoli (facoltativo)"
        value={values.muscles}
        onChange={(value) => update('muscles', value)}
        enterKeyHint="next"
        autoComplete="off"
        placeholder="Quadricipiti, glutei"
        error={errors.muscles}
      />
      <StepsEditor
        steps={values.steps}
        onChange={(steps) => update('steps', steps)}
        hint="Un passo per riga, nell’ordine di esecuzione."
        error={errors.steps}
      />
      <TextAreaField
        label="Note (facoltativo)"
        value={values.notes}
        onChange={(value) => update('notes', value)}
        error={errors.notes}
      />
      <div className={extraActions ? 'exercise-form__actions exercise-form__actions--split' : 'exercise-form__actions'}>
        {error && (
          <p role="alert" className="field__message field__message--error">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" busy={busy}>
          {submitLabel}
        </PrimaryButton>
        {extraActions}
      </div>
    </form>
  )
}
