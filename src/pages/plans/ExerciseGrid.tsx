import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { PlanExerciseDetail } from '../../data/activePlan'
import {
  targetFormFrom,
  UNIT_ORDER,
  validateTargetForm,
  type PlanTarget,
  type TargetFormErrors,
  type TargetFormValues,
} from '../../lib/planForm'
import { unitLabel } from '../../lib/sessionProgress'
import { repsWarning } from '../../lib/validation'
import { RemoveConfirm } from './RemoveConfirm'
import '../../styles/plans.css'

interface ExerciseGridProps {
  exercises: readonly PlanExerciseDetail[]
  /** A request is in flight: saving, moving and removing are blocked. */
  busy: boolean
  /** Failure of the last save, announced to screen readers. */
  error: string | null
  /** Resolves true once the target is stored. */
  onSave: (id: string, target: PlanTarget) => Promise<boolean>
  onMove: (index: number, offset: -1 | 1) => void
  onRemove: (id: string) => void
}

/** Desktop exercises of a session: sets, reps, unit and weight are edited in place, one line per exercise. */
export function ExerciseGrid({ exercises, busy, error, onSave, onMove, onRemove }: ExerciseGridProps) {
  const [removingId, setRemovingId] = useState<string | null>(null)

  if (exercises.length === 0) return <p className="plans-note empty-state">Questa sessione non ha ancora esercizi.</p>

  return (
    <>
      {error && (
        <p role="alert" className="plans-error">
          {error}
        </p>
      )}
      <ul className="plans-list">
        {exercises.map((row, index) => (
          <li key={row.id} className="plan-grid__row">
            <GridRow
              row={row}
              index={index}
              count={exercises.length}
              busy={busy}
              onSave={onSave}
              onMove={onMove}
              onRemove={() => setRemovingId(row.id)}
            />
            {row.id === removingId && (
              <RemoveConfirm
                name={row.exercise.name}
                busy={busy}
                onRemove={() => onRemove(row.id)}
                onCancel={() => setRemovingId(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

interface GridRowProps {
  row: PlanExerciseDetail
  index: number
  count: number
  busy: boolean
  onSave: ExerciseGridProps['onSave']
  onMove: ExerciseGridProps['onMove']
  onRemove: () => void
}

function GridRow({ row, index, count, busy, onSave, onMove, onRemove }: GridRowProps) {
  const { name, equipment } = row.exercise
  const stored = targetFormFrom(row, equipment)
  const [values, setValues] = useState(stored)
  const [errors, setErrors] = useState<TargetFormErrors>({})
  const edited = (Object.keys(stored) as (keyof TargetFormValues)[]).some((key) => values[key] !== stored[key])

  function update<K extends keyof TargetFormValues>(key: K, value: TargetFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (busy || !edited) return
    const result = validateTargetForm(values, equipment)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    if (await onSave(row.id, result.target)) setValues(targetFormFrom(result.target, equipment))
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    void save()
  }

  const reps = Number(values.reps)
  const warning = Number.isInteger(reps) ? repsWarning(reps, values.unit) : null
  const messages = Object.values(errors)
  const weightUnit = equipment === 'barbell' ? 'kg per lato' : 'kg'

  return (
    <>
      {/* The inputs sit in one flex line that wraps under the name when the pane is narrow. */}
      <div className="plan-grid__line" onKeyDown={handleKeyDown}>
        <span className="row-link__title plan-grid__name">{name}</span>
        <div className="plan-grid__fields">
          <Cell label="Serie">
            <input
              className="plan-grid__input"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Serie di ${name}`}
              aria-invalid={errors.sets ? true : undefined}
              value={values.sets}
              onChange={(event) => update('sets', event.target.value)}
            />
          </Cell>
          <Cell label={unitLabel(values.unit)}>
            <input
              className="plan-grid__input"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Ripetizioni, secondi o metri di ${name}`}
              aria-invalid={errors.reps ? true : undefined}
              value={values.reps}
              onChange={(event) => update('reps', event.target.value)}
            />
          </Cell>
          <Cell label="Unità">
            <select
              className="plan-grid__input plan-grid__input--unit"
              aria-label={`Unità di ${name}`}
              value={values.unit}
              onChange={(event) => update('unit', UNIT_ORDER.find((unit) => unit === event.target.value) ?? values.unit)}
            >
              {UNIT_ORDER.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabel(unit)}
                </option>
              ))}
            </select>
          </Cell>
          <Cell label={equipment === 'barbell' ? 'Kg per lato' : 'Kg'}>
            <span className="plan-grid__kg">
              <input
                className="plan-grid__input"
                inputMode="decimal"
                autoComplete="off"
                aria-label={`Peso suggerito di ${name} (${weightUnit})`}
                aria-invalid={errors.weight ? true : undefined}
                value={values.weight}
                onChange={(event) => update('weight', event.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                className="plan-grid__input"
                inputMode="decimal"
                autoComplete="off"
                aria-label={`Peso suggerito massimo di ${name} (${weightUnit})`}
                aria-invalid={errors.weightMax ? true : undefined}
                value={values.weightMax}
                onChange={(event) => update('weightMax', event.target.value)}
              />
            </span>
          </Cell>
        </div>
        <div className="plan-grid__actions">
          <button
            type="button"
            className="plan-row__text-button"
            aria-label={`Salva ${name}`}
            disabled={busy || !edited}
            onClick={() => void save()}
          >
            Salva
          </button>
          <ReorderButtons name={name} index={index} count={count} disabled={busy} onMove={(offset) => onMove(index, offset)} />
          <button type="button" className="plan-row__button" aria-label={`Rimuovi ${name}`} disabled={busy} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>
      {messages.length > 0 && (
        <p role="alert" className="field__message field__message--error">
          {messages.join(' ')}
        </p>
      )}
      {warning && <p className="field__message">{warning}</p>}
    </>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="plan-grid__cell">
      <span className="plan-grid__label" aria-hidden="true">
        {label}
      </span>
      {children}
    </label>
  )
}
