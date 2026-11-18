import { Link } from 'react-router-dom'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { SessionDetail } from '../../data/activePlan'
import { countLabel } from '../../lib/planList'
import '../../styles/plans.css'

interface SessionRowsProps {
  planId: string
  sessions: readonly SessionDetail[]
  /** A request is in flight: the move buttons are blocked. */
  busy: boolean
  onMove: (index: number, offset: -1 | 1) => void
}

/** Sessions of a plan in execution order: each opens its editor, with up/down buttons to reorder. */
export function SessionRows({ planId, sessions, busy, onMove }: SessionRowsProps) {
  if (sessions.length === 0) return <p className="plans-note">Questa scheda non ha ancora sessioni.</p>

  return (
    <ul className="plans-list">
      {sessions.map((session, index) => (
        <li key={session.id} className="plan-row">
          <Link to={`/plans/${planId}/sessions/${session.id}`} className="plan-row__main">
            <span className="row-link__title">{session.name}</span>
            <span className="row-link__detail">
              {[countLabel(session.exercises.length, 'esercizio', 'esercizi'), session.is_optional ? 'bonus' : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
          <ReorderButtons
            name={session.name}
            index={index}
            count={sessions.length}
            disabled={busy}
            onMove={(offset) => onMove(index, offset)}
          />
        </li>
      ))}
    </ul>
  )
}
