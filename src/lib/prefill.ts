import type { Equipment, Exercise, LastSet, PlanExercise } from '../types/db'

export type PrefillTarget = Pick<PlanExercise, 'target_sets' | 'target_reps' | 'suggested_weight_kg'>
export type PrefillExercise = Pick<Exercise, 'equipment' | 'starting_weight_kg'>

export interface PrefillRow {
  set_number: number
  reps: number
  weight_kg: number | null
  equipment_used: Equipment
}

/**
 * Proposes today's rows: one per target set, copying the same set of the last workout.
 * A set missing from the last workout takes the target reps and the weight and equipment of the
 * highest earlier logged set, then the suggested weight (lower bound of the range), then the
 * exercise starting weight (null when none is known).
 */
export function prefillSets(
  lastSets: readonly LastSet[],
  target: PrefillTarget,
  exercise: PrefillExercise,
): PrefillRow[] {
  const bySetNumber = [...lastSets].sort((a, b) => a.set_number - b.set_number)
  const fallbackWeight = target.suggested_weight_kg ?? exercise.starting_weight_kg

  return Array.from({ length: target.target_sets }, (_, index) => {
    const setNumber = index + 1
    const logged = bySetNumber.find((set) => set.set_number === setNumber)
    const source = logged ?? bySetNumber.filter((set) => set.set_number < setNumber).at(-1)
    return {
      set_number: setNumber,
      reps: logged?.reps ?? target.target_reps,
      weight_kg: source?.weight_kg ?? fallbackWeight,
      equipment_used: source?.equipment_used ?? exercise.equipment,
    }
  })
}
