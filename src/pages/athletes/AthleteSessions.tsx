import type { AthleteSession } from './model'

/** Recent workouts as disclosure rows, like the athlete's own Storico but without links into it; notes are plain text. */
export function AthleteSessions({ sessions }: { sessions: readonly AthleteSession[] }) {
  return (
    <section>
      <h2 className="history-label">Ultime sessioni</h2>
      {sessions.length === 0 && <p className="history-note">Nessuna sessione registrata.</p>}
      {sessions.map((session) => (
        <details key={session.id} className="session-log">
          <summary className="session-log__summary">
            <span>
              <span className="row-link__title">
                <bdi>{session.title}</bdi>
              </span>
              <span className="row-link__detail">{session.detail}</span>
            </span>
            <span className="session-log__arrow" aria-hidden="true">
              ↓
            </span>
          </summary>
          {session.notes && (
            <p className="athlete-note">
              <bdi>{session.notes}</bdi>
            </p>
          )}
          <ul className="session-log__exercises">
            {session.exercises.map((exercise) => (
              <li key={exercise.exerciseId} className="session-log__exercise">
                <bdi>{exercise.name}</bdi>
                <span className="row-link__detail">{exercise.sets.join(', ')}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
