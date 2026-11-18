import { Link, Navigate, useSearchParams } from 'react-router-dom'
import type { LoadedSession } from './loadSession'
import { ExerciseDetail } from '../../components/ExerciseDetail'
import { SessionHeader } from '../../components/SessionHeader'
import { targetLabel } from '../../lib/sessionProgress'
import type { WarmupItem } from '../../types/db'
import { progressionChip } from './hints'
import { sessionPath } from './paths'

// Selection key of the warm-up item in the list; exercise ids are uuids, so no clash.
const WARM_UP = 'riscaldamento'

/** Read-only session for the desktop: the exercises on the left, the selected one on the right. Sets are logged on the phone. */
export function DesktopSession({ loaded }: { loaded: LoadedSession }) {
  const { plan, session, lastSets, recentSets } = loaded
  const [params] = useSearchParams()
  // The summary ends a workout, which only the phone does.
  if (params.has('fine')) return <Navigate to={sessionPath(session.id)} replace />

  const hasWarmUp = session.warmup.length > 0
  const keys = [...(hasWarmUp ? [WARM_UP] : []), ...session.exercises.map((entry) => entry.exercise_id)]
  const requested = params.get('es')
  const selected = requested && keys.includes(requested) ? requested : session.exercises[0]?.exercise_id ?? keys[0]
  const selectedExercise = session.exercises.find((entry) => entry.exercise_id === selected)

  return (
    <>
      <SessionHeader
        backTo="/"
        back={`‹ ${plan.name}`}
        backLabel="Torna a Oggi"
        end="Sola lettura"
        title={session.name}
        subtitle={session.subtitle ?? undefined}
      />
      {keys.length === 0 ? (
        <p className="session-note">Questa sessione non ha ancora esercizi: aggiungili dalla scheda.</p>
      ) : (
        <div className="desktop-session">
          <ul className="desktop-session__list">
            {hasWarmUp && (
              <li>
                <ItemLink
                  to={sessionPath(session.id, WARM_UP)}
                  active={selected === WARM_UP}
                  name="Riscaldamento"
                  detail={session.warmup.length === 1 ? '1 movimento' : `${session.warmup.length} movimenti`}
                />
              </li>
            )}
            {session.exercises.map((entry) => (
              <li key={entry.id}>
                <ItemLink
                  to={sessionPath(session.id, entry.exercise_id)}
                  active={selected === entry.exercise_id}
                  name={entry.exercise.name}
                  detail={targetLabel(entry)}
                />
              </li>
            ))}
          </ul>
          <div className="desktop-session__detail">
            {selectedExercise ? (
              <ExerciseDetail
                name={selectedExercise.exercise.name}
                equipment={selectedExercise.exercise.equipment}
                muscles={selectedExercise.exercise.muscles}
                executionSteps={selectedExercise.exercise.execution_steps}
                unit={selectedExercise.target_unit}
                lastSets={lastSets.get(selectedExercise.exercise_id) ?? []}
                suggestion={progressionChip(recentSets.get(selectedExercise.exercise_id) ?? [], selectedExercise)?.description}
              />
            ) : (
              <WarmUpDetail items={session.warmup} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

interface ItemLinkProps {
  to: string
  active: boolean
  name: string
  detail: string
}

function ItemLink({ to, active, name, detail }: ItemLinkProps) {
  return (
    <Link to={to} replace className="desktop-session__item" aria-current={active ? 'true' : undefined}>
      <span className="exercise-card__name">{name}</span>
      <small className="exercise-card__detail">{detail}</small>
    </Link>
  )
}

function WarmUpDetail({ items }: { items: readonly Pick<WarmupItem, 'id' | 'name' | 'reps_text' | 'note'>[] }) {
  return (
    <section aria-labelledby="warm-up-title">
      <h2 id="warm-up-title" className="exercise-detail__title">
        Riscaldamento
      </h2>
      <ul className="warm-up__list">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <small>{[item.reps_text, item.note].filter(Boolean).join(' · ')}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
