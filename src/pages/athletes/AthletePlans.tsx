import type { PlanView } from './model'

/** The athlete's plans, read-only: each plan opens to its sessions and the target of each exercise. */
export function AthletePlans({ plans }: { plans: readonly PlanView[] }) {
  if (plans.length === 0) return null
  return (
    <section>
      <h2 className="history-label">Schede</h2>
      {plans.map((plan) => (
        <details key={plan.id} className="session-log">
          <summary className="session-log__summary">
            <span>
              <span className="row-link__title">
                <bdi>{plan.name}</bdi>
              </span>
              <span className="row-link__detail">{plan.active ? 'Attiva' : 'Non attiva'}</span>
            </span>
            <span className="session-log__arrow" aria-hidden="true">
              ↓
            </span>
          </summary>
          {plan.sessions.map((session) => (
            <div key={session.id}>
              <p className="coach-link__title">
                <bdi>{session.title}</bdi>
                {session.optional && <span className="row-link__detail"> · bonus</span>}
              </p>
              {session.subtitle && (
                <p className="history-note">
                  <bdi>{session.subtitle}</bdi>
                </p>
              )}
              <ul className="session-log__exercises">
                {session.exercises.map((exercise) => (
                  <li key={exercise.key} className="session-log__exercise">
                    <bdi>{exercise.name}</bdi>
                    <span className="row-link__detail">{exercise.target}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </section>
  )
}
