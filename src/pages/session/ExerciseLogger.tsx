import type { ReactNode } from 'react'
import type { LoadedSession } from './loadSession'
import { SetLogger } from '../../components/SetLogger'
import { prefillSets } from '../../lib/prefill'
import { nextSetNumber, setsOf, type Draft } from '../../lib/sessionDraft'
import { lastTimeHint, startingValues } from '../../lib/sessionProgress'
import type { SetValues } from '../../lib/setFlow'
import { suggestedWeight } from './hints'
import { sessionPath } from './paths'
import { sessionStore } from './sessionStore'

/** Values to bring back after an undo, so the user can correct the set instead of retyping it. */
export interface RestoredSet {
  exerciseId: string
  setNumber: number
  values: SetValues
}

interface ExerciseLoggerProps {
  loaded: LoadedSession
  exerciseId: string
  draft: Draft | null
  restored: RestoredSet | null
  toast: ReactNode
  onConfirm: (exerciseId: string, values: SetValues) => void
}

/** Opens the logger on the next set of an exercise with its starting values; renders nothing for an unknown exercise. */
export function ExerciseLogger({ loaded, exerciseId, draft, restored, toast, onConfirm }: ExerciseLoggerProps) {
  const { session, lastSets, recentSets } = loaded
  const index = session.exercises.findIndex((candidate) => candidate.exercise_id === exerciseId)
  const planExercise = session.exercises[index]
  if (!planExercise) return null

  const { exercise } = planExercise
  const last = lastSets.get(exerciseId) ?? []
  const setNumber = draft ? nextSetNumber(draft, exerciseId) : 1
  const previous = draft ? setsOf(draft, exerciseId).at(-1) : undefined
  // Prefill rows run 1..setNumber, so the last one is the set about to be logged.
  const [row] = prefillSets(last, { ...planExercise, target_sets: setNumber }, exercise).slice(-1)
  const suggestedKg = suggestedWeight(recentSets.get(exerciseId) ?? [], planExercise)
  const restoredHere = restored?.exerciseId === exerciseId && restored.setNumber === setNumber ? restored : null
  const initial = restoredHere?.values ?? startingValues({ row, previous, suggestedKg })

  return (
    <SetLogger
      key={`${exerciseId}-${setNumber}${restoredHere ? '-restored' : ''}`}
      exercise={{ name: exercise.name, muscles: exercise.muscles, executionSteps: exercise.execution_steps }}
      unit={planExercise.target_unit}
      setNumber={setNumber}
      targetSets={planExercise.target_sets}
      position={{ current: index + 1, total: session.exercises.length }}
      initial={initial}
      hint={lastTimeHint(last, setNumber, planExercise.target_unit, suggestedKg)}
      backTo={sessionPath(session.id)}
      onBack={() => sessionStore.setCurrentExercise(null)}
      toast={toast}
      onConfirm={(values) => onConfirm(exerciseId, values)}
    />
  )
}
