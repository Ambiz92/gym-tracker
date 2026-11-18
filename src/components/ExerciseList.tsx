import type { ReactNode } from 'react'
import { exerciseDetail } from '../lib/exerciseList'
import type { Exercise } from '../types/db'
import '../styles/exercises.css'

interface ExerciseListProps {
  exercises: readonly Exercise[]
  onSelect: (exercise: Exercise) => void
  /** "open" rows lead to the exercise (arrow); "add" rows pick it (plus). */
  variant?: 'open' | 'add'
  /** The exercise open next to the list (desktop); its row is highlighted. */
  selectedId?: string
  /** Shown instead of the list when there are no exercises. */
  empty: ReactNode
}

/** Tappable exercise rows: name, equipment and muscles; archived ones are tagged. Text only, never HTML. */
export function ExerciseList({ exercises, onSelect, variant = 'open', selectedId, empty }: ExerciseListProps) {
  if (exercises.length === 0) return <div className="exercises__empty">{empty}</div>

  return (
    <ul className="exercise-list">
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <button
            type="button"
            className={variant === 'add' ? 'exercise-row exercise-row--add' : 'exercise-row'}
            aria-current={exercise.id === selectedId ? 'true' : undefined}
            aria-label={variant === 'add' ? `Aggiungi ${exercise.name}` : undefined}
            onClick={() => onSelect(exercise)}
          >
            <span>
              <span className="exercise-row__name">{exercise.name}</span>
              <span className="exercise-row__detail">{exerciseDetail(exercise)}</span>
            </span>
            {exercise.archived ? (
              <span className="exercise-row__tag">Archiviato</span>
            ) : (
              <span className="exercise-row__glyph" aria-hidden="true">
                {variant === 'add' ? '+' : '→'}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
