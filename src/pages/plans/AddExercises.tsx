import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PlanExerciseDetail, SessionDetail } from '../../data/activePlan'
import { createExercise, listExercises } from '../../data/exercises'
import { addPlanExercise, removePlanExercise } from '../../data/plans'
import { useAsync } from '../../hooks/useAsync'
import { sortExercises } from '../../lib/exerciseList'
import { SheetController, type SheetAction } from '../../lib/exerciseSheet'
import { targetOf } from '../../lib/planForm'
import type { Exercise } from '../../types/db'
import { AddExercisesSheet } from './AddExercisesSheet'
import { describePlanError } from './errors'

const FAILURES: Record<SheetAction, string> = {
  add: 'Aggiunta non riuscita. Controlla la connessione e riprova.',
  remove: 'Rimozione non riuscita. Riprova.',
  create: 'Creazione non riuscita. Controlla la connessione e riprova: i dati nel modulo sono ancora qui.',
}

interface AddExercisesProps {
  session: SessionDetail
  /** The exercise is stored in the session: the parent adds the row to its copy. */
  onAdded: (row: PlanExerciseDetail) => void
  onRemoved: (rowId: string) => void
  onClose: () => void
}

/** Loads the library and wires the sheet to the session: each tap is a stored change, so closing the sheet has nothing to save. */
export function AddExercises({ session, onAdded, onRemoved, onClose }: AddExercisesProps) {
  const library = useAsync(listExercises, [])
  const [created, setCreated] = useState<Exercise[]>([])
  const latest = useRef({ onAdded, onRemoved })
  useEffect(() => {
    latest.current = { onAdded, onRemoved }
  })
  const [controller] = useState(
    () =>
      new SheetController(
        session.exercises.map((row) => ({ rowId: row.id, exerciseId: row.exercise_id, target: targetOf(row) })),
        {
          add: async (exercise, target) => {
            const row = await addPlanExercise(session.id, { exercise_id: exercise.id, ...target })
            latest.current.onAdded({ ...row, exercise })
            return { rowId: row.id }
          },
          remove: async (rowId) => {
            await removePlanExercise(rowId)
            latest.current.onRemoved(rowId)
          },
          create: createExercise,
          onCreated: (exercise) => setCreated((current) => [...current, exercise]),
          describeFailure: (cause, action) => describePlanError(cause, FAILURES[action]),
        },
      ),
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const merged = library.status === 'ready' ? { ...library, data: sortExercises([...library.data, ...created]) } : library

  return (
    <AddExercisesSheet
      sessionName={session.name}
      library={merged}
      state={state}
      onToggle={(exercise) => void controller.toggle(exercise)}
      onCreate={(values) => controller.createAndAdd(values)}
      onClose={onClose}
    />
  )
}
