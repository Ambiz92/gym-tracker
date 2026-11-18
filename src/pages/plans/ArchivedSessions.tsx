import type { SessionDetail } from '../../data/activePlan'
import { countLabel } from '../../lib/planList'
import '../../styles/plans.css'

interface ArchivedSessionsProps {
  sessions: readonly SessionDetail[]
  busy: boolean
  onRestore: (id: string) => void
}

/** Archived sessions of a plan (their workouts stay in the history), each with a restore button. */
export function ArchivedSessions({ sessions, busy, onRestore }: ArchivedSessionsProps) {
  if (sessions.length === 0) return null

  return (
    <section aria-labelledby="archived-sessions-heading">
      <h2 id="archived-sessions-heading" className="plans-label">
        Sessioni archiviate
      </h2>
      <p className="plans-note">Nascoste dalla scheda e da Oggi: i loro allenamenti restano nello storico. Se le ripristini tornano in fondo.</p>
      <ul className="plans-list">
        {sessions.map((session) => (
          <li key={session.id} className="plan-row plan-row--plain">
            <span className="plan-row__main">
              <span className="row-link__title">{session.name}</span>
              <span className="row-link__detail">{countLabel(session.exercises.length, 'esercizio', 'esercizi')}</span>
            </span>
            <button
              type="button"
              className="plan-row__text-button"
              aria-label={`Ripristina ${session.name}`}
              disabled={busy}
              onClick={() => onRestore(session.id)}
            >
              Ripristina
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
