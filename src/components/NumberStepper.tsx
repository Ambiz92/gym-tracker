import { useId } from 'react'
import { formatNumber } from '../lib/formatNumber'

interface NumberStepperProps {
  /** Accessible name of the number, e.g. "Peso". */
  label: string
  /** Unit written next to the number: "kg", "rip", "sec", "m". */
  unit: string
  /** Unit spelled out for assistive tech: "chilogrammi", "ripetizioni", "secondi", "metri". */
  unitSpoken: string
  value: number
  step: number
  size: 'big' | 'medium'
  inputMode: 'decimal' | 'numeric'
  /** Text being typed, or null while the number is only stepped. */
  editing: string | null
  error: string | null
  onStep: (delta: number) => void
  onEditStart: () => void
  onEditText: (text: string) => void
  onCommit: () => void
}

/** Giant number you can step with − / + or tap to type (comma or dot). */
export function NumberStepper({
  label,
  unit,
  unitSpoken,
  value,
  step,
  size,
  inputMode,
  editing,
  error,
  onStep,
  onEditStart,
  onEditText,
  onCommit,
}: NumberStepperProps) {
  const errorId = useId()
  const stepText = formatNumber(step)

  return (
    <div className="number-stepper">
      <div className={`number-stepper__value number-stepper__value--${size}`}>
        {editing === null ? (
          <button type="button" className="number-stepper__number" onClick={onEditStart} aria-label={`${label}: ${formatNumber(value)} ${unitSpoken}. Tocca per scrivere`}>
            {formatNumber(value)}
          </button>
        ) : (
          <input
            className="number-stepper__number number-stepper__input"
            value={editing}
            inputMode={inputMode}
            enterKeyHint="done"
            autoComplete="off"
            aria-label={`${label} in ${unitSpoken}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => onEditText(event.target.value)}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              onCommit()
            }}
          />
        )}
        <span className="number-stepper__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
      {error && (
        <p id={errorId} className="number-stepper__error" role="alert">
          {error}
        </p>
      )}
      <div className="stepper-buttons">
        <button type="button" aria-label={`Diminuisci ${label.toLowerCase()} di ${stepText}`} onClick={() => onStep(-step)}>
          <span aria-hidden="true">−</span>
          <small aria-hidden="true">{stepText}</small>
        </button>
        <button type="button" aria-label={`Aumenta ${label.toLowerCase()} di ${stepText}`} onClick={() => onStep(step)}>
          <span aria-hidden="true">+</span>
          <small aria-hidden="true">{stepText}</small>
        </button>
      </div>
    </div>
  )
}
