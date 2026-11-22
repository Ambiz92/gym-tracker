import { summaryDetail } from '../history/model'
import type { AthleteExerciseRow } from './model'

/** Every logged exercise with its last weight and the athlete's note on it. */
export function AthleteExercises({ exercises }: { exercises: readonly AthleteExerciseRow[] }) {
  if (exercises.length === 0) return null
  return (
    <section>
      <h2 className="history-label">Esercizi</h2>
      <ul className="coach-links">
        {exercises.map((exercise) => (
          <li key={exercise.id} className="coach-link">
            <p className="coach-link__title">
              <bdi>{exercise.name}</bdi>
            </p>
            <p className="history-note">{summaryDetail(exercise)}</p>
            {exercise.notes && (
              <p className="athlete-note">
                <bdi>{exercise.notes}</bdi>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
