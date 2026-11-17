import { Link } from 'react-router-dom'

export interface ProgressionChip {
  /** Short text, e.g. "+2,5". */
  label: string
  /** The same for assistive tech. */
  description: string
}

interface ExerciseCardProps {
  to: string
  name: string
  detail: string
  done: boolean
  chip?: ProgressionChip
}

/** Row of an exercise in the session: tick, name, target and progression hint; opens the set logger. */
export function ExerciseCard({ to, name, detail, done, chip }: ExerciseCardProps) {
  return (
    <Link to={to} className={done ? 'exercise-card exercise-card--done' : 'exercise-card'}>
      <span className="exercise-card__tick" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      <span>
        <span className="exercise-card__name">{name}</span>
        <small className="exercise-card__detail">
          {done && <span className="session-vh">Completato. </span>}
          {detail}
        </small>
      </span>
      {chip ? (
        <span className="exercise-card__chip">
          <span aria-hidden="true">{chip.label}</span>
          <span className="session-vh">{chip.description}</span>
        </span>
      ) : (
        <span aria-hidden="true">→</span>
      )}
    </Link>
  )
}
