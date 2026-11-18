import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SessionHeader } from '../../components/SessionHeader'
import type { SessionDetail } from '../../data/activePlan'
import { createExercise } from '../../data/exercises'
import {
  addPlanExercise,
  removePlanExercise,
  removeSession,
  reorderPlanExercises,
  type SessionRemoval,
  updatePlanExercise,
  updateSession,
} from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { countLabel } from '../../lib/planList'
import { defaultTarget, sessionFormFrom, type PlanTarget } from '../../lib/planForm'
import { moveItem, moveTo } from '../../lib/reorder'
import type { Exercise, ExerciseInsert, PlanSessionUpdate } from '../../types/db'
import { AddExercise } from './AddExercise'
import { describePlanError } from './errors'
import { ExerciseGrid } from './ExerciseGrid'
import { ExerciseRows } from './ExerciseRows'
import { SessionFields } from './SessionFields'
import { SessionRemove } from './SessionRemove'
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

/** One session of a plan: its name and bonus flag, and its exercises with sets, reps, unit and weight. */
export function SessionScreen({ planId, planName, session, onChange: setSession, onRemoved }: SessionScreenProps) {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const details = useAction(describePlanError)
  const list = useAction(describePlanError)
  const target = useAction(describePlanError)
  const removal = useAction(describePlanError)
  const busy = details.busy || list.busy || target.busy || removal.busy

  async function handleDetails(fields: PlanSessionUpdate) {
    const saved = await details.run(() => updateSession(session.id, fields), 'Salvataggio non riuscito. Riprova.')
    if (saved) setSession((current) => ({ ...current, ...fields }))
  }

  async function appendExercise(exercise: Exercise) {
    const row = await addPlanExercise(session.id, { exercise_id: exercise.id, ...defaultTarget(exercise) })
    setSession((current) => ({ ...current, exercises: [...current.exercises, { ...row, exercise }] }))
    setNotice(`«${exercise.name}» aggiunto.`)
  }

  async function handlePick(exercise: Exercise) {
    setNotice(null)
    await list.run(() => appendExercise(exercise), 'Aggiunta non riuscita. Controlla la connessione e riprova.')
  }

  async function handleCreate(values: ExerciseInsert) {
    const created = await list.run(
      async () => appendExercise(await createExercise(values)),
      'Salvataggio non riuscito. Controlla la connessione e riprova: i dati nel modulo sono ancora qui.',
    )
    if (created) setAdding(false)
  }

  async function handleSaveTarget(id: string, changes: PlanTarget): Promise<boolean> {
    const saved = await target.run(() => updatePlanExercise(id, changes), 'Salvataggio non riuscito. Riprova.')
    if (!saved) return false
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    }))
    setEditingId(null)
    return true
  }

  async function applyOrder(reordered: SessionDetail['exercises']) {
    const done = await list.run(() => reorderPlanExercises(reordered), 'Riordino non riuscito. Riprova.')
    if (done) setSession((current) => ({ ...current, exercises: reordered }))
  }

  const handleMove = (index: number, offset: -1 | 1) => applyOrder(moveItem(session.exercises, index, offset))
  const handleReorder = (from: number, to: number) => applyOrder(moveTo(session.exercises, from, to))

  async function handleRemoveExercise(id: string) {
    const done = await list.run(() => removePlanExercise(id), 'Rimozione non riuscita. Riprova.')
    if (!done) return
    setSession((current) => ({ ...current, exercises: current.exercises.filter((row) => row.id !== id) }))
    setEditingId((current) => (current === id ? null : current))
  }

  async function handleRemoveSession() {
    let removed: SessionRemoval = 'deleted'
    const done = await removal.run(async () => {
      removed = await removeSession(session.id)
    }, 'Rimozione non riuscita. Riprova.')
    if (!done) return
    // One transition: the session route is left in the same render that drops the session from the plan.
    startTransition(() => {
      navigate(`/plans/${planId}`)
      onRemoved(removed)
    })
  }

  if (adding) {
    return (
      <AddExercise
        sessionName={session.name}
        excludeIds={session.exercises.map((row) => row.exercise_id)}
        busy={list.busy}
        error={list.error}
        notice={notice}
        onPick={handlePick}
        onCreate={handleCreate}
        onClose={() => setAdding(false)}
      />
    )
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
      <SessionFields initial={sessionFormFrom(session)} busy={details.busy} error={details.error} onSubmit={handleDetails} />

      <h2 className="plans-label">Esercizi</h2>
      {list.error && (
        <p role="alert" className="plans-error">
          {list.error}
        </p>
      )}
      {isDesktop ? (
        <ExerciseGrid
          exercises={session.exercises}
          busy={busy}
          error={target.error}
          onSave={handleSaveTarget}
          onMove={handleMove}
          onRemove={handleRemoveExercise}
        />
      ) : (
        <ExerciseRows
          exercises={session.exercises}
          editingId={editingId}
          busy={busy}
          error={target.error}
          onEdit={setEditingId}
          onSave={handleSaveTarget}
          onMove={handleMove}
          onReorder={handleReorder}
          onRemove={handleRemoveExercise}
        />
      )}
      <div className="plans-actions">
        <PrimaryButton
          variant="outline"
          disabled={busy}
          onClick={() => {
            setNotice(null)
            setAdding(true)
          }}
        >
          Aggiungi esercizio
        </PrimaryButton>
      </div>

      <SessionRemove name={session.name} busy={busy} error={removal.error} onRemove={handleRemoveSession} />
    </>
  )
}
