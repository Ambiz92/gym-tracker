import { useEffect, useRef } from 'react'
import type { PlanExerciseDetail, SessionDetail } from '../../data/activePlan'
import {
  removePlanExercise,
  removeSession,
  reorderPlanExercises,
  restorePlanExercise,
  type SessionRemoval,
  updateSession,
} from '../../data/plans'
import { useAction } from '../../hooks/useAction'
import { moveItem, moveTo } from '../../lib/reorder'
import type { PlanSessionUpdate } from '../../types/db'
import { describePlanError } from './errors'

export interface RemovedExercise {
  row: PlanExerciseDetail
  /** Where it was in the session, to put it back there. */
  index: number
}

/** What the session screens do to a session besides editing targets; each patches the parent's copy once its request succeeded. */
export function useSessionEdits(session: SessionDetail, setSession: (update: (session: SessionDetail) => SessionDetail) => void) {
  const details = useAction(describePlanError)
  const list = useAction(describePlanError)
  const removal = useAction(describePlanError)
  // An Undo can come long after the render that made it: it reads the exercises as they are now.
  const latest = useRef(session)
  useEffect(() => {
    latest.current = session
  })

  async function saveDetails(fields: PlanSessionUpdate) {
    const saved = await details.run(() => updateSession(session.id, fields), 'Salvataggio non riuscito. Riprova.')
    if (saved) setSession((current) => ({ ...current, ...fields }))
  }

  async function applyOrder(reordered: SessionDetail['exercises']) {
    const done = await list.run(() => reorderPlanExercises(reordered), 'Riordino non riuscito. Riprova.')
    if (done) setSession((current) => ({ ...current, exercises: reordered }))
  }

  /** Removes an exercise from the session; resolves what was removed (for an Undo), or null when the request failed. */
  async function removeExercise(id: string): Promise<RemovedExercise | null> {
    const index = session.exercises.findIndex((row) => row.id === id)
    const row = session.exercises[index]
    if (!row) return null
    const done = await list.run(() => removePlanExercise(id), 'Rimozione non riuscita. Riprova.')
    if (!done) return null
    setSession((current) => ({ ...current, exercises: current.exercises.filter((candidate) => candidate.id !== id) }))
    return { row, index }
  }

  /** Puts a removed exercise back where it was, with the same target. */
  function restoreExercise(removed: RemovedExercise): Promise<boolean> {
    return list.run(async () => {
      const ordered = await restorePlanExercise(removed.row, removed.index, latest.current.exercises)
      setSession((current) => ({ ...current, exercises: ordered }))
    }, 'Ripristino non riuscito. Riprova.')
  }

  /** Deletes or archives the session; resolves which, or null when the request failed. */
  async function removeThisSession(): Promise<SessionRemoval | null> {
    let removed: SessionRemoval | null = null
    await removal.run(async () => {
      removed = await removeSession(session.id)
    }, 'Rimozione non riuscita. Riprova.')
    return removed
  }

  return {
    details,
    list,
    removal,
    busy: details.busy || list.busy || removal.busy,
    saveDetails,
    move: (index: number, offset: -1 | 1) => applyOrder(moveItem(session.exercises, index, offset)),
    reorder: (from: number, to: number) => applyOrder(moveTo(session.exercises, from, to)),
    removeExercise,
    restoreExercise,
    removeThisSession,
  }
}
