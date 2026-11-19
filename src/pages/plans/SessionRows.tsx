import { Link, useParams } from 'react-router-dom'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { SessionDetail } from '../../data/activePlan'
import { useDragReorder } from '../../hooks/useDragReorder'
import { countLabel } from '../../lib/planList'
import '../../styles/plans.css'

interface SessionRowsProps {
  planId: string
  sessions: readonly SessionDetail[]
  /** A request is in flight: the move buttons and the drag handles are blocked. */
  busy: boolean
  onMove: (index: number, offset: -1 | 1) => void
  /** A row was dragged onto another one. */
  onReorder: (from: number, to: number) => void
}

/** Sessions of a plan in execution order: each opens its editor (the open one is marked); reorder by dragging the handle or with the buttons. */
export function SessionRows({ planId, sessions, busy, onMove, onReorder }: SessionRowsProps) {
  const drag = useDragReorder({ disabled: busy, onReorder })
  const { sessionId } = useParams()
  if (sessions.length === 0) return <p className="plans-note empty-state">Questa scheda non ha ancora sessioni.</p>

  return (
    <ul ref={drag.listRef} className="plans-list">
      {sessions.map((session, index) => (
        <li key={session.id} className={session.id === sessionId ? 'plan-row plan-row--selected' : 'plan-row'} {...drag.rowProps(index)}>
          <span {...drag.gripProps(index)}>⋮⋮</span>
          <Link
            to={`/plans/${planId}/sessions/${session.id}`}
            className="plan-row__main"
            aria-current={session.id === sessionId ? 'true' : undefined}
          >
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
