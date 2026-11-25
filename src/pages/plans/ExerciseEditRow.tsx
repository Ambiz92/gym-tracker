import { useId, useState, type ReactNode } from 'react'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { PlanExerciseDetail } from '../../data/activePlan'
import { EQUIPMENT_LABELS } from '../../lib/exerciseForm'
import { nextUnit, type PlanTarget, type TargetFormErrors } from '../../lib/planForm'
import { unitLabel } from '../../lib/sessionProgress'
import type { AutosaveSnapshot } from '../../lib/targetAutosave'
import { repsWarning } from '../../lib/validation'
import { useTargetAutosave } from './useTargetAutosave'
import '../../styles/plans.css'
import '../../styles/builder.css'

interface ExerciseEditRowProps {
  row: PlanExerciseDetail
  index: number
  count: number
  /** A structural request (reorder, remove) is in flight: moving and removing are blocked. */
  busy: boolean
  /** The drag handle, owned by the list that reorders its rows. */
  grip: ReactNode
  /** Stores the target; rejects when the save fails (the row then offers a retry). */
  onSave: (id: string, target: PlanTarget) => Promise<void>
  /** A valid target is about to be saved: the screen's copy of the plan follows it. */
  onApply: (id: string, target: PlanTarget) => void
  onMove: (index: number, offset: -1 | 1) => void
  onRemove: (id: string) => void
}

function statusText({ status, errors }: AutosaveSnapshot): string {
  if (Object.keys(errors).length > 0) return ''
  if (status === 'saving') return 'Salvataggio…'
  if (status === 'saved') return '✓ salvato'
  return ''
}

/** One exercise of the session with its three always-editable numbers: serie, ripetizioni (or secondi, metri) and peso. */
export function ExerciseEditRow({ row, index, count, busy, grip, onSave, onApply, onMove, onRemove }: ExerciseEditRowProps) {
  const { name, equipment } = row.exercise
  const ids = useId()
  const [showMax] = useState(row.suggested_weight_max_kg !== null)
  const [snapshot, autosave] = useTargetAutosave(row, {
    save: (target) => onSave(row.id, target),
    apply: (target) => onApply(row.id, target),
  })
  const { values, errors, status, failure } = snapshot
  const messages = Object.values(errors)
  const reps = Number(values.reps)
  const warning = Number.isInteger(reps) ? repsWarning(reps, values.unit) : null
  const unit = unitLabel(values.unit)
  const weightUnit = equipment === 'barbell' ? 'kg per lato' : 'kg'

  /** What every number input of the row shares: its text, its error state and the autosave hooks. */
  const input = (key: keyof TargetFormErrors, label: string) => ({
    id: `${ids}-${key}`,
    label,
    value: values[key],
    invalid: key in errors,
    describedBy: messages.length > 0 ? `${ids}-errors` : undefined,
    onChange: (text: string) => autosave.change({ [key]: text }),
    onBlur: () => autosave.blur(),
  })

  return (
    <div className={status === 'failed' ? 'builder-row builder-row--failed' : 'builder-row'}>
      <div className="builder-row__head">
        {grip}
        <div className="builder-row__name">
          <span className="row-link__title">{name}</span>
          <span className="builder-row__meta">
            <span>{EQUIPMENT_LABELS[equipment]}</span>
            <span role="status" className="builder-row__saved">
              {statusText(snapshot)}
            </span>
          </span>
        </div>
        <ReorderButtons name={name} index={index} count={count} disabled={busy} onMove={(offset) => onMove(index, offset)} />
        <button type="button" className="plan-row__button" aria-label={`Rimuovi ${name}`} disabled={busy} onClick={() => onRemove(row.id)}>
          ✕
        </button>
      </div>
      <div className="builder-fields">
        <div className="builder-field">
          <label className="builder-field__label" htmlFor={`${ids}-sets`}>
            Serie
          </label>
          <NumberInput {...input('sets', `Serie di ${name}`)} inputMode="numeric" enterKeyHint="next" />
        </div>
        <div className="builder-field">
          <label className="builder-field__label" htmlFor={`${ids}-reps`}>
            {unit}
          </label>
          <div className="builder-field__unit">
            <NumberInput {...input('reps', `Ripetizioni, secondi o metri di ${name}`)} inputMode="numeric" enterKeyHint="next" />
            <button
              type="button"
              className="builder-field__unit-key"
              aria-label={`Unità di ${name}: ${unit}. Cambia`}
              onClick={() => autosave.change({ unit: nextUnit(values.unit) })}
            >
              ⇄
            </button>
          </div>
        </div>
        <div className="builder-field">
          <label className="builder-field__label" htmlFor={`${ids}-weight`}>
            {equipment === 'barbell' ? 'Kg per lato' : 'Peso kg'}
          </label>
          <NumberInput {...input('weight', `Peso suggerito di ${name} (${weightUnit})`)} inputMode="decimal" enterKeyHint={showMax ? 'next' : 'done'} />
        </div>
        {showMax && (
          <div className="builder-field builder-field--max">
            <label className="builder-field__label" htmlFor={`${ids}-weightMax`}>
              {equipment === 'barbell' ? 'Fino a, per lato' : 'Fino a kg'}
            </label>
            <NumberInput {...input('weightMax', `Peso suggerito massimo di ${name} (${weightUnit})`)} inputMode="decimal" enterKeyHint="done" />
          </div>
        )}
      </div>
      {messages.length > 0 && (
        <p id={`${ids}-errors`} role="alert" className="field__message field__message--error">
          {messages.join(' ')}
        </p>
      )}
      {warning && <p className="field__message">{warning}</p>}
      {status === 'failed' && (
        <div role="alert" className="builder-row__failure">
          <p className="field__message field__message--error">{failure}</p>
          <button type="button" className="plan-row__text-button" onClick={() => autosave.blur()}>
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}

interface NumberInputProps {
  id: string
  /** Accessible name: the visible label is short and the same on every row. */
  label: string
  value: string
  invalid: boolean
  describedBy: string | undefined
  inputMode: 'numeric' | 'decimal'
  enterKeyHint: 'next' | 'done'
  onChange: (text: string) => void
  onBlur: () => void
}

/** A number box of the row: tapping it selects its text, so typing replaces the value. */
function NumberInput({ id, label, value, invalid, describedBy, inputMode, enterKeyHint, onChange, onBlur }: NumberInputProps) {
  return (
    <input
      id={id}
      className="builder-field__input"
      autoComplete="off"
      placeholder="—"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      inputMode={inputMode}
      enterKeyHint={enterKeyHint}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={onBlur}
    />
  )
}
