import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionHeader } from '../../components/SessionHeader'
import type { SessionDetail } from '../../data/activePlan'
import { type SessionRemoval, updatePlanExercise } from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { countLabel } from '../../lib/planList'
import { sessionFormFrom, type PlanTarget } from '../../lib/planForm'
import { AddExercises } from './AddExercises'
import { describePlanError } from './errors'
import { ExerciseGrid } from './ExerciseGrid'
import { SessionFields } from './SessionFields'
import { SessionRemove } from './SessionRemove'
import { useSessionEdits } from './useSessionEdits'
import '../../styles/plans.css'

interface SessionScreenProps {
  planId: string
  planName: string
  session: SessionDetail
  /** Patches the session held by the parent; called only once a request succeeded, so nothing reloads under the user's finger. */
  onChange: (update: (session: SessionDetail) => SessionDetail) => void
  /** The session was deleted or archived: the parent drops it from its plan. */
  onRemoved: (removal: SessionRemoval) => void
}

/** Desktop: one session of a plan, its name and bonus flag, and its exercises with sets, reps, unit and weight edited in place. */
export function SessionScreen({ planId, planName, session, onChange: setSession, onRemoved }: SessionScreenProps) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const target = useAction(describePlanError)
  const edits = useSessionEdits(session, setSession)
  const { details, list, removal } = edits
  const busy = edits.busy || target.busy

  async function handleSaveTarget(id: string, changes: PlanTarget): Promise<boolean> {
    const saved = await target.run(() => updatePlanExercise(id, changes), 'Salvataggio non riuscito. Riprova.')
    if (!saved) return false
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    }))
    return true
  }

  async function handleRemoveSession() {
    const removed = await edits.removeThisSession()
    if (!removed) return
    // One transition: the session route is left in the same render that drops the session from the plan.
    startTransition(() => {
      navigate(`/plans/${planId}`)
      onRemoved(removed)
    })
  }

  return (
    <>
      <SessionHeader
        backTo={`/plans/${planId}`}
        back={`‹ ${planName}`}
        backLabel="Torna alla scheda"
        end={countLabel(session.exercises.length, 'esercizio', 'esercizi')}
        title={session.name}
        subtitle={session.is_optional ? 'Bonus' : undefined}
      />
      <SessionFields initial={sessionFormFrom(session)} busy={details.busy} error={details.error} onSubmit={edits.saveDetails} />

      <h2 className="plans-label">Esercizi</h2>
      {list.error && (
        <p role="alert" className="plans-error">
          {list.error}
        </p>
      )}
      <ExerciseGrid
        exercises={session.exercises}
        busy={busy}
        error={target.error}
        onSave={handleSaveTarget}
        onMove={edits.move}
        onRemove={(id) => void edits.removeExercise(id)}
      />
      <div className="plans-actions">
        <PrimaryButton variant="outline" disabled={busy} onClick={() => setAdding(true)}>
          Aggiungi esercizi
        </PrimaryButton>
      </div>
      {adding && (
        <AddExercises
          session={session}
          onAdded={(row) => setSession((current) => ({ ...current, exercises: [...current.exercises, row] }))}
          onRemoved={(rowId) => setSession((current) => ({ ...current, exercises: current.exercises.filter((row) => row.id !== rowId) }))}
          onClose={() => setAdding(false)}
        />
      )}

      <SessionRemove name={session.name} busy={busy} error={removal.error} onRemove={() => void handleRemoveSession()} />
    </>
  )
}
