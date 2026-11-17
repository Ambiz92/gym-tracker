type Equipment = 'barbell' | 'dumbbell' | 'other'

export interface LastSet {
  set_number: number
  reps: number
  weight_kg: number
  equipment_used: Equipment
}

export interface PrefillTarget {
  target_sets: number
  target_reps: number
  suggested_weight_kg: number | null
}

export interface PrefillExercise {
  equipment: Equipment
  starting_weight_kg: number | null
}

export interface PrefillRow {
  set_number: number
  reps: number
  weight_kg: number | null
  equipment_used: Equipment
}

/**
 * Proposes today's rows: one per target set, copying the same set of the last workout.
 * Sets missing from the last workout fall back to target reps, then the suggested weight
 * (lower bound of the range), then the exercise starting weight (null when none is known).
 */
export function prefillSets(
  lastSets: readonly LastSet[],
  target: PrefillTarget,
  exercise: PrefillExercise,
): PrefillRow[] {
  const lastBySetNumber = new Map(lastSets.map((set) => [set.set_number, set]))
  const fallbackWeight = target.suggested_weight_kg ?? exercise.starting_weight_kg

  return Array.from({ length: target.target_sets }, (_, index) => {
    const setNumber = index + 1
    const last = lastBySetNumber.get(setNumber)
    return {
      set_number: setNumber,
      reps: last?.reps ?? target.target_reps,
      weight_kg: last?.weight_kg ?? fallbackWeight,
      equipment_used: last?.equipment_used ?? exercise.equipment,
    }
  })
}
