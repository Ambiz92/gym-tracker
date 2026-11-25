import { toDisplayKg } from '../lib/barbellLoad'
import { dayMonthName } from '../lib/formatDate'
import { formatNumber } from '../lib/formatNumber'
import { equipmentLabel, splitSteps, unitLabel } from '../lib/sessionProgress'
import type { Equipment, LastSet, TargetUnit } from '../types/db'

interface ExerciseDetailProps {
  name: string
  equipment: Equipment
  muscles: string | null
  executionSteps: string | null
  unit: TargetUnit
  lastSets: readonly LastSet[]
  /** Date (YYYY-MM-DD) of the workout the last sets come from. */
  lastDate?: string
  /** Text of the progression hint, when the rule fired. */
  suggestion?: string
}

/** Read-only view of an exercise: how to do it, the progression hint and the sets of the last workout (a barbell weight as one side). */
export function ExerciseDetail({ name, equipment, muscles, executionSteps, unit, lastSets, lastDate, suggestion }: ExerciseDetailProps) {
  const steps = splitSteps(executionSteps)
  const sets = [...lastSets].sort((a, b) => a.set_number - b.set_number)

  return (
    <article className="exercise-detail" aria-labelledby="exercise-detail-title">
      <p className="page-header__subtitle">{[equipmentLabel(equipment), muscles].filter(Boolean).join(' · ')}</p>
      <h2 id="exercise-detail-title" className="exercise-detail__title">
        {name}
      </h2>
      {suggestion && <p className="exercise-detail__suggestion">{suggestion}</p>}
      {steps.length > 0 ? (
        <ol className="exercise-detail__steps">
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : (
        <p className="exercise-detail__empty">Nessuna indicazione scritta per questo esercizio.</p>
      )}
      <h3 className="exercise-detail__label">{lastDate ? `Ultima volta · ${dayMonthName(lastDate)}` : 'Ultima volta'}</h3>
      {sets.length === 0 ? (
        <p className="exercise-detail__empty">Prima volta con questo esercizio.</p>
      ) : (
        <table className="exercise-detail__sets">
          <thead>
            <tr>
              <th scope="col">Serie</th>
              <th scope="col">{unitLabel(unit)}</th>
              <th scope="col">{equipment === 'barbell' ? 'Kg per lato' : 'Kg'}</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set) => (
              <tr key={set.set_number}>
                <td>{set.set_number}</td>
                <td>{set.reps}</td>
                <td>{formatNumber(toDisplayKg(set.equipment_used, set.weight_kg))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  )
}
