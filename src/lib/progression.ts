import type { Equipment, LastSet, PlanExercise } from '../types/db'
import { toDisplayKg, toStoredKg } from './barbellLoad'

/** Per side: the weights compared here are stored totals, see incrementFor. */
export const BARBELL_INCREMENT_KG = 2.5
export const DUMBBELL_HEAVY_THRESHOLD_KG = 10
export const DUMBBELL_HEAVY_INCREMENT_KG = 2
export const DUMBBELL_LIGHT_INCREMENT_KG = 1

export type ProgressionTarget = Pick<PlanExercise, 'target_sets' | 'target_reps'>

export interface ProgressionHint {
  suggested: number | null
  reason: string
}

function formatKg(kg: number): string {
  return String(kg).replace('.', ',')
}

/** Increment in stored kg, the unit of `LastSet.weight_kg`: on a barbell the per-side step on both sides. */
function incrementFor(equipment: Equipment, currentKg: number): number | null {
  if (equipment === 'barbell') return toStoredKg(equipment, BARBELL_INCREMENT_KG)
  if (equipment === 'dumbbell') {
    return currentKg >= DUMBBELL_HEAVY_THRESHOLD_KG ? DUMBBELL_HEAVY_INCREMENT_KG : DUMBBELL_LIGHT_INCREMENT_KG
  }
  return null
}

/** Consecutive clean workouts at the same weight and equipment before an increase is suggested. */
export const CLEAN_WORKOUTS_REQUIRED = 2

type Load = Pick<LastSet, 'weight_kg' | 'equipment_used'>

/** The single load of a clean workout (every target set logged with at least the target value), else null. */
function cleanLoad(sets: readonly LastSet[], target: ProgressionTarget): Load | null {
  const targetSets: LastSet[] = []
  for (let setNumber = 1; setNumber <= target.target_sets; setNumber++) {
    const set = sets.find((candidate) => candidate.set_number === setNumber)
    if (!set || set.reps < target.target_reps) return null
    targetSets.push(set)
  }

  const [first] = targetSets
  if (!first || targetSets.some((set) => !sameLoad(set, first))) return null
  return first
}

function sameLoad(a: Load, b: Load): boolean {
  return a.weight_kg === b.weight_kg && a.equipment_used === b.equipment_used
}

/**
 * Suggests the next weight once the last `CLEAN_WORKOUTS_REQUIRED` workouts were all clean at the
 * same weight and equipment. `recentWorkouts` holds the sets of each workout, newest first.
 * Weights in and out are stored kg (a barbell's total of both sides).
 */
export function suggestNextWeight(
  recentWorkouts: readonly (readonly LastSet[])[],
  target: ProgressionTarget,
): ProgressionHint {
  const [latest] = recentWorkouts
  if (!latest) {
    return { suggested: null, reason: 'Primo allenamento: nessun suggerimento' }
  }

  const load = cleanLoad(latest, target)
  if (!load) return { suggested: null, reason: 'Ripeti questo peso' }

  const increment = incrementFor(load.equipment_used, load.weight_kg)
  if (increment === null) {
    return { suggested: null, reason: 'Nessun incremento previsto per questo attrezzo' }
  }

  const lastWorkouts = recentWorkouts.slice(0, CLEAN_WORKOUTS_REQUIRED)
  const streakComplete =
    lastWorkouts.length === CLEAN_WORKOUTS_REQUIRED &&
    lastWorkouts.every((sets) => {
      const candidate = cleanLoad(sets, target)
      return candidate !== null && sameLoad(candidate, load)
    })
  if (!streakComplete) {
    return { suggested: null, reason: 'Ancora un allenamento pulito a questo peso prima di aumentare' }
  }

  const step = `${formatKg(toDisplayKg(load.equipment_used, increment))} kg${load.equipment_used === 'barbell' ? ' per lato' : ''}`
  return {
    suggested: Math.round((load.weight_kg + increment) * 100) / 100,
    reason: `Ultimi ${CLEAN_WORKOUTS_REQUIRED} allenamenti puliti a questo peso: +${step}`,
  }
}
