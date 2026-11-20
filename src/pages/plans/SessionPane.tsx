import { useState } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { ReorderButtons } from '../../components/ReorderButtons'
import type { SessionDetail } from '../../data/activePlan'
import { duplicateSession, type SessionRemoval, updatePlanExercise } from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { duplicateSessionName } from '../../lib/planBuilder'
import { sessionFormFrom, type PlanTarget } from '../../lib/planForm'
import { AddExercises } from './AddExercises'
import { describePlanError } from './errors'
import { ExerciseEditRows } from './ExerciseEditRows'
import { SessionFields } from './SessionFields'
import { SessionRemove } from './SessionRemove'
import { useSessionEdits } from './useSessionEdits'
import '../../styles/plans.css'
import '../../styles/builder.css'

interface SessionPaneProps {
  session: SessionDetail
  /** Names of every live session of the plan: a duplicate takes the next free one. */
  sessionNames: readonly string[]
  /** Place of the session among the plan's sessions, for the buttons that move it. */
  position: { index: number; count: number }
  /** A plan request is in flight: the session move buttons wait. */
  planBusy: boolean
  /** Patches the session held by the parent; called once a request succeeded. */
  onChange: (update: (session: SessionDetail) => SessionDetail) => void
  onRemoved: (removal: SessionRemoval) => void
  /** The session was copied: the parent adds the copy to its plan and opens it. */
  onDuplicated: (copy: SessionDetail) => void
  onMoveSession: (offset: -1 | 1) => void
  /** Shows the Undo toast of a removed exercise. */
  onUndoable: (message: string, onUndo: () => void) => void
}

/** The exercises of the open session, edited in place, with the ways to add more, copy the session and change its details. */
export function SessionPane({ session, sessionNames, position, planBusy, onChange, onRemoved, onDuplicated, onMoveSession, onUndoable }: SessionPaneProps) {
  const [adding, setAdding] = useState(false)
  const edits = useSessionEdits(session, onChange)
  const duplication = useAction(describePlanError)
  const { details, list, removal, busy } = edits

  const save = (id: string, target: PlanTarget) => updatePlanExercise(id, target)
  const apply = (id: string, target: PlanTarget) =>
    onChange((current) => ({ ...current, exercises: current.exercises.map((row) => (row.id === id ? { ...row, ...target } : row)) }))

  async function handleRemove(id: string) {
    const removed = await edits.removeExercise(id)
    if (removed) onUndoable(`«${removed.row.exercise.name}» rimosso`, () => void edits.restoreExercise(removed))
  }

  async function handleDuplicate() {
    await duplication.run(async () => {
      onDuplicated(await duplicateSession(session, duplicateSessionName(session.name, sessionNames)))
    }, 'Duplicazione non riuscita. Controlla la connessione e riprova.')
  }

  async function handleRemoveSession() {
    const removed = await edits.removeThisSession()
    if (removed) onRemoved(removed)
  }

  return (
    <>
      {(list.error || duplication.error) && (
        <p role="alert" className="plans-error">
          {list.error ?? duplication.error}
        </p>
      )}
      <ExerciseEditRows
        exercises={session.exercises}
        busy={busy}
        onSave={save}
        onApply={apply}
        onMove={edits.move}
        onReorder={edits.reorder}
        onRemove={(id) => void handleRemove(id)}
      />
      <div className="plans-actions">
        <PrimaryButton disabled={busy} onClick={() => setAdding(true)}>
          + Aggiungi esercizi
        </PrimaryButton>
      </div>
      <button type="button" className="builder-ghost" disabled={busy || duplication.busy} aria-busy={duplication.busy || undefined} onClick={() => void handleDuplicate()}>
        Duplica sessione
      </button>

      <details className="builder-details">
        <summary>Dettagli sessione</summary>
        <SessionFields initial={sessionFormFrom(session)} busy={details.busy} error={details.error} onSubmit={edits.saveDetails} />
        <h2 className="plans-label">Posizione</h2>
        <p className="plans-note">Sposta «{session.name}» prima o dopo le altre sessioni.</p>
        <div className="builder-position">
          <ReorderButtons name={session.name} index={position.index} count={position.count} disabled={planBusy || busy} onMove={onMoveSession} />
        </div>
        <SessionRemove name={session.name} busy={removal.busy} error={removal.error} onRemove={() => void handleRemoveSession()} />
      </details>

      {adding && (
        <AddExercises
          session={session}
          onAdded={(row) => onChange((current) => ({ ...current, exercises: [...current.exercises, row] }))}
          onRemoved={(rowId) => onChange((current) => ({ ...current, exercises: current.exercises.filter((row) => row.id !== rowId) }))}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
