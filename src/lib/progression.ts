import type { Equipment, LastSet, PlanExercise } from '../types/db'

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

function incrementFor(equipment: Equipment, currentKg: number): number | null {
  if (equipment === 'barbell') return BARBELL_INCREMENT_KG
  if (equipment === 'dumbbell') {
    return currentKg >= DUMBBELL_HEAVY_THRESHOLD_KG ? DUMBBELL_HEAVY_INCREMENT_KG : DUMBBELL_LIGHT_INCREMENT_KG
  }
  return null
}

/**
 * Suggests the next weight when last time was clean: every target set logged with at least
 * the target value (reps, seconds or meters), all at the same weight and equipment.
 */
export function suggestNextWeight(lastSets: readonly LastSet[], target: ProgressionTarget): ProgressionHint {
  if (lastSets.length === 0) {
    return { suggested: null, reason: 'Primo allenamento: nessun suggerimento' }
  }

  const targetSets: LastSet[] = []
  for (let setNumber = 1; setNumber <= target.target_sets; setNumber++) {
    const set = lastSets.find((candidate) => candidate.set_number === setNumber)
    if (!set || set.reps < target.target_reps) {
      return { suggested: null, reason: 'Ultima volta non tutte le serie completate' }
    }
    targetSets.push(set)
  }

  const [first] = targetSets
  if (!first || targetSets.some((set) => set.weight_kg !== first.weight_kg || set.equipment_used !== first.equipment_used)) {
    return { suggested: null, reason: 'Ultima volta serie con pesi o attrezzi diversi' }
  }

  const increment = incrementFor(first.equipment_used, first.weight_kg)
  if (increment === null) {
    return { suggested: null, reason: 'Nessun incremento previsto per questo attrezzo' }
  }

  return {
    suggested: Math.round((first.weight_kg + increment) * 100) / 100,
    reason: `Ultima volta tutte le serie completate: +${formatKg(increment)} kg`,
  }
}
