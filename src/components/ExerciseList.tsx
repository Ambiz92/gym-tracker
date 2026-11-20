import type { ReactNode } from 'react'
import { exerciseDetail, exerciseUsageDetail } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import '../styles/exercises.css'

interface ExerciseListProps {
  exercises: readonly Exercise[]
  onSelect: (exercise: Exercise) => void
  /** The exercise open next to the list (desktop); its row is highlighted. */
  selectedId?: string
  /** Plans using each exercise (missing: none); when given, replaces the muscles in the detail line. */
  usage?: ReadonlyMap<string, number> | null
  /** Shown instead of the list when there are no exercises. */
  empty: ReactNode
}

/** Tappable exercise rows: name, equipment and muscles (or plan usage); archived ones are tagged. Text only, never HTML. */
export function ExerciseList({ exercises, onSelect, selectedId, usage, empty }: ExerciseListProps) {
  if (exercises.length === 0) return <div className="exercises__empty">{empty}</div>

  return (
    <ul className="exercise-list">
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <button
            type="button"
            className="exercise-row"
            aria-current={exercise.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(exercise)}
          >
            <span>
              <span className="exercise-row__name">{exercise.name}</span>
              <span className="exercise-row__detail">
                {usage ? exerciseUsageDetail(exercise, usage.get(exercise.id) ?? 0) : exerciseDetail(exercise)}
              </span>
            </span>
            {exercise.archived ? (
              <span className="exercise-row__tag">Archiviato</span>
            ) : (
              <span className="exercise-row__glyph" aria-hidden="true">
                →
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
