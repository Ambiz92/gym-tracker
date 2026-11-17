import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LoadedSession } from './loadSession'
import { ExerciseCard } from '../../components/ExerciseCard'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionDock } from '../../components/SessionDock'
import { SessionHeader } from '../../components/SessionHeader'
import { SessionProgress } from '../../components/SessionProgress'
import { SyncBanner } from '../../components/SyncBanner'
import { WarmUp } from '../../components/WarmUp'
import type { Draft } from '../../lib/sessionDraft'
import { completedExercises, isExerciseDone, loggedCount, targetLabel } from '../../lib/sessionProgress'
import { progressionChip } from './hints'
import { sessionPath, summaryPath } from './paths'
import { useSyncStatus } from './sessionStore'

interface SessionListProps {
  loaded: LoadedSession
  draft: Draft | null
  toast: ReactNode
}

/** Ordered exercises of the session with ticks, progress and the way to the summary. */
export function SessionList({ loaded, draft, toast }: SessionListProps) {
  const { plan, session, lastSets } = loaded
  const navigate = useNavigate()
  const sync = useSyncStatus()
  const done = completedExercises(draft, session.exercises)

  return (
    <>
      <SessionHeader
        backTo="/"
        back={`‹ ${plan.name}`}
        backLabel="Torna a Oggi"
        end={`${done} / ${session.exercises.length}`}
        title={session.name}
        subtitle={session.subtitle ?? undefined}
      />
      <SessionProgress done={done} total={session.exercises.length} />
      <SyncBanner {...sync} />
      <WarmUp items={session.warmup} />
      {session.exercises.length === 0 ? (
        <p className="session-note">Questa sessione non ha ancora esercizi: aggiungili dalla scheda.</p>
      ) : (
        <ul className="session-list">
          {session.exercises.map((planExercise) => {
            const logged = loggedCount(draft, planExercise.exercise_id)
            const partial = logged > 0 && !isExerciseDone(draft, planExercise)
            const target = targetLabel(planExercise)
            return (
              <li key={planExercise.id}>
                <ExerciseCard
                  to={sessionPath(session.id, planExercise.exercise_id)}
                  name={planExercise.exercise.name}
                  detail={partial ? `${target} · ${logged}/${planExercise.target_sets} serie` : target}
                  done={isExerciseDone(draft, planExercise)}
                  chip={progressionChip(lastSets.get(planExercise.exercise_id) ?? [], planExercise)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <SessionDock toast={toast}>
        <PrimaryButton onClick={() => navigate(summaryPath(session.id))}>Termina sessione</PrimaryButton>
      </SessionDock>
    </>
  )
}
