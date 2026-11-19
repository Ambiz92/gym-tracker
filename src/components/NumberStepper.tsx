import { useId } from 'react'
import { isLongFigure } from '../lib/figureFit'
import { formatNumber } from '../lib/formatNumber'

interface StepperNumberProps {
  /** Accessible name of the number, e.g. "Peso". */
  label: string
  /** Unit written next to the number: "kg", "rip", "sec", "m". */
  unit: string
  /** Unit spelled out for assistive tech: "chilogrammi", "ripetizioni", "secondi", "metri". */
  unitSpoken: string
  value: number
  size: 'big' | 'medium'
  inputMode: 'decimal' | 'numeric'
  /** Text being typed, or null while the number is only stepped. */
  editing: string | null
  error: string | null
  onEditStart: () => void
  onEditText: (text: string) => void
  onCommit: () => void
}

/** Giant number you can tap to type (comma or dot), with its unit and the error of what was typed. */
export function StepperNumber({
  label,
  unit,
  unitSpoken,
  value,
  size,
  inputMode,
  editing,
  error,
  onEditStart,
  onEditText,
  onCommit,
}: StepperNumberProps) {
  const errorId = useId()
  const shown = editing ?? formatNumber(value)
  const fit = size === 'big' && isLongFigure(shown) ? ' number-stepper__value--long' : ''

  return (
    <div className="number-stepper">
      <div className={`number-stepper__value number-stepper__value--${size}${fit}`}>
        {editing === null ? (
          <button type="button" className="number-stepper__number" onClick={onEditStart} aria-label={`${label}: ${shown} ${unitSpoken}. Tocca per scrivere`}>
            {shown}
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
    </div>
  )
}

interface StepButtonProps {
  /** Name of the number the button moves, e.g. "Peso". */
  label: string
  /** How far one press moves the number. */
  step: number
  direction: 'down' | 'up'
  /** "pair" shows the step next to the sign; "flank" sits beside a number and shows the sign only. */
  variant: 'pair' | 'flank'
  /** What one press moves, spelled out for assistive tech: "1,25 chili per lato". Defaults to the label and the step. */
  stepSpoken?: string
  onStep: (delta: number) => void
}

/** Rubber button that lowers or raises a number by its step. */
export function StepButton({ label, step, direction, variant, stepSpoken, onStep }: StepButtonProps) {
  const stepText = formatNumber(step)
  const down = direction === 'down'

  return (
    <button
      type="button"
      className={`step-button step-button--${variant}`}
      aria-label={stepSpoken ? `${down ? 'Meno' : 'Più'} ${stepSpoken}` : `${down ? 'Diminuisci' : 'Aumenta'} ${label.toLowerCase()} di ${stepText}`}
      onClick={() => onStep(down ? -step : step)}
    >
      <span aria-hidden="true">{down ? '−' : '+'}</span>
      {variant === 'pair' && <small aria-hidden="true">{stepText}</small>}
    </button>
  )
}

interface NumberStepperProps extends Omit<StepperNumberProps, 'size'> {
  step: number
  stepSpoken?: string
  onStep: (delta: number) => void
}

/** A number between its − and + buttons. */
export function NumberStepper({ step, stepSpoken, onStep, ...number }: NumberStepperProps) {
  return (
    <div className="number-stepper-row">
      <StepButton label={number.label} step={step} stepSpoken={stepSpoken} direction="down" variant="flank" onStep={onStep} />
      <StepperNumber {...number} size="medium" />
      <StepButton label={number.label} step={step} stepSpoken={stepSpoken} direction="up" variant="flank" onStep={onStep} />
    </div>
  )
}
