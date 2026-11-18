import { useEffect, useId, useRef } from 'react'
import { EQUIPMENT_LABELS, EQUIPMENT_ORDER } from '../lib/exerciseForm'
import { moveItem } from '../lib/reorder'
import { addStep, removeStep, setStep } from '../lib/steps'
import type { Equipment } from '../types/db'
import '../styles/exercises.css'

interface EquipmentFieldProps {
  value: Equipment
  onChange: (value: Equipment) => void
}

/** Equipment as native radios (arrow keys work), drawn as three segments. */
export function EquipmentField({ value, onChange }: EquipmentFieldProps) {
  const name = useId()
  return (
    <fieldset className="exercise-form__fieldset">
      <legend className="field__label">Attrezzo</legend>
      <div className="equipment-field__options">
        {EQUIPMENT_ORDER.map((option) => (
          <label key={option} className="equipment-field__option">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{EQUIPMENT_LABELS[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}

/** Multi-line twin of Field: persistent label, hint and error linked via aria-describedby. */
export function TextAreaField({ label, value, onChange, hint, error }: TextAreaFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="field__input exercise-form__textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
      />
      {message && (
        <p id={messageId} className={error ? 'field__message field__message--error' : 'field__message'}>
          {message}
        </p>
      )}
    </div>
  )
}

interface StepsEditorProps {
  steps: readonly string[]
  onChange: (steps: string[]) => void
  hint: string
  error?: string
}

/** Ordered list of one-line steps: edit, reorder, remove, append. */
export function StepsEditor({ steps, onChange, hint, error }: StepsEditorProps) {
  const id = useId()
  const messageId = `${id}-message`
  const lastInput = useRef<HTMLInputElement>(null)
  const focusLastOnNextRender = useRef(false)

  useEffect(() => {
    if (!focusLastOnNextRender.current) return
    focusLastOnNextRender.current = false
    lastInput.current?.focus()
  }, [steps.length])

  function append() {
    focusLastOnNextRender.current = true
    onChange(addStep(steps))
  }

  return (
    <fieldset className="exercise-form__fieldset" aria-describedby={messageId}>
      <legend className="field__label">Come si esegue (facoltativo)</legend>
      <ol className="exercise-steps">
        {steps.map((step, index) => {
          const number = index + 1
          return (
            <li key={index} className="exercise-steps__row">
              <span className="exercise-steps__number" aria-hidden="true">
                {number}
              </span>
              <input
                ref={index === steps.length - 1 ? lastInput : undefined}
                className="field__input exercise-steps__input"
                type="text"
                aria-label={`Passo ${number}`}
                aria-invalid={error && index === 0 ? true : undefined}
                value={step}
                onChange={(event) => onChange(setStep(steps, index, event.target.value))}
              />
              <button
                type="button"
                className="exercise-steps__button"
                aria-label={`Sposta su il passo ${number}`}
                disabled={index === 0}
                onClick={() => onChange(moveItem(steps, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                className="exercise-steps__button"
                aria-label={`Sposta giù il passo ${number}`}
                disabled={index === steps.length - 1}
                onClick={() => onChange(moveItem(steps, index, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className="exercise-steps__button"
                aria-label={`Rimuovi il passo ${number}`}
                onClick={() => onChange(removeStep(steps, index))}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className="exercise-steps__add" onClick={append}>
        + Aggiungi un passo
      </button>
      <p id={messageId} className={error ? 'field__message field__message--error' : 'field__message'}>
        {error ?? hint}
      </p>
    </fieldset>
  )
}
