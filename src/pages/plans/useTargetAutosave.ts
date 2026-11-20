import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { targetFormFrom, type PlanTarget } from '../../lib/planForm'
import { TargetAutosave, type AutosaveSnapshot } from '../../lib/targetAutosave'
import type { PlanExercise } from '../../types/db'
import { describePlanError } from './errors'

interface Handlers {
  save: (target: PlanTarget) => Promise<void>
  apply: (target: PlanTarget) => void
}

/** The autosave of one exercise row: its typed values and save status, and the controller to feed. */
export function useTargetAutosave(row: PlanExercise, handlers: Handlers): [AutosaveSnapshot, TargetAutosave] {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })
  const [autosave] = useState(
    () =>
      new TargetAutosave(targetFormFrom(row), {
        save: (target) => latest.current.save(target),
        apply: (target) => latest.current.apply(target),
        describeFailure: (cause) => describePlanError(cause, 'Salvataggio non riuscito. Riprova.'),
      }),
  )
  // A row that goes away with an edit still waiting saves it first.
  useEffect(() => () => autosave.flush(), [autosave])
  return [useSyncExternalStore(autosave.subscribe, autosave.getSnapshot, autosave.getSnapshot), autosave]
}
