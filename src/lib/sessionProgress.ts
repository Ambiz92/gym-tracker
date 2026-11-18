import type { Equipment, LastSet, PlanExercise, TargetUnit } from '../types/db'
import { formatNumber } from './formatNumber'
import type { PrefillRow } from './prefill'
import { setsOf, type Draft, type DraftSet } from './sessionDraft'
import type { SetValues } from './setFlow'

export type PlannedExercise = Pick<PlanExercise, 'exercise_id' | 'target_sets'>

const UNIT_LABEL: Record<TargetUnit, string> = { reps: 'rip', seconds: 'sec', meters: 'm' }

/** Label under the reps number: "rip", "sec" or "m". */
export const unitLabel = (unit: TargetUnit): string => UNIT_LABEL[unit]

const EQUIPMENT_LABEL: Record<Equipment, string> = { barbell: 'Bilanciere', dumbbell: 'Manubri', other: 'Altro' }

export const equipmentLabel = (equipment: Equipment): string => EQUIPMENT_LABEL[equipment]

/** Execution steps typed one per line; a leading "1." or "2)" is dropped because the list numbers them. */
export function splitSteps(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line !== '')
}

const UNIT_SUFFIX: Record<TargetUnit, string> = { reps: '', seconds: ' s', meters: ' m' }

export function loggedCount(draft: Draft | null, exerciseId: string): number {
  return draft ? setsOf(draft, exerciseId).length : 0
}

export function isExerciseDone(draft: Draft | null, exercise: PlannedExercise): boolean {
  return loggedCount(draft, exercise.exercise_id) >= exercise.target_sets
}

export function completedExercises(draft: Draft | null, exercises: readonly PlannedExercise[]): number {
  return exercises.filter((exercise) => isExerciseDone(draft, exercise)).length
}

interface StartingValuesInput {
  /** Prefill row for the set about to be logged. */
  row: PrefillRow
  /** The set of this exercise confirmed just before, today. */
  previous: DraftSet | undefined
  /** Weight proposed by the progression rule, when last time was clean. */
  suggestedKg: number | null
}

/**
 * Values the logger opens with. After a set today, weight and equipment carry over from it (the
 * user's decision of the day beats last workout's); the first set takes the progression
 * suggestion, then the prefill. Reps always follow the prefill.
 */
export function startingValues({ row, previous, suggestedKg }: StartingValuesInput): SetValues {
  return {
    weight: previous?.weightKg ?? suggestedKg ?? row.weight_kg ?? 0,
    reps: row.reps,
    equipment: previous?.equipment ?? row.equipment_used,
  }
}

/** "Ultima volta 12,5 kg × 10 · suggerito 15 ↑", or a first-time note. */
export function lastTimeHint(
  lastSets: readonly LastSet[],
  setNumber: number,
  unit: TargetUnit,
  suggestedKg: number | null,
): string {
  const sorted = [...lastSets].sort((a, b) => a.set_number - b.set_number)
  const reference = sorted.find((set) => set.set_number === setNumber) ?? sorted.at(-1)
  if (!reference) return 'Prima volta con questo esercizio'

  const last = `Ultima volta ${formatNumber(reference.weight_kg)} kg × ${reference.reps}${UNIT_SUFFIX[unit]}`
  return suggestedKg === null ? last : `${last} · suggerito ${formatNumber(suggestedKg)} ↑`
}

/** "3×8" or "3×30 s"; the weight lives in the set logger and in the history, not on the rows. */
export function targetLabel(target: Pick<PlanExercise, 'target_sets' | 'target_reps' | 'target_unit'>): string {
  return `${target.target_sets}×${target.target_reps}${UNIT_SUFFIX[target.target_unit]}`
}

/** "3 × 15 kg" or "2 × 15 kg · 1 × 12,5 kg": the weights of the sets, runs of the same weight collapsed. */
export function loadLabel(weightsKg: readonly number[]): string {
  const runs: { weightKg: number; count: number }[] = []
  for (const weightKg of weightsKg) {
    const last = runs.at(-1)
    if (last?.weightKg === weightKg) last.count += 1
    else runs.push({ weightKg, count: 1 })
  }
  return runs.map(({ weightKg, count }) => `${count} × ${formatNumber(weightKg)} kg`).join(' · ')
}

export interface SummaryRow {
  exerciseId: string
  name: string
  sets: number
  /** Weight of every set today, in set order. */
  weightsKg: number[]
  /** Heaviest weight of the session. */
  weightKg: number
  equipment: Equipment
  /** Against the heaviest weight of the last workout; null without one. */
  deltaKg: number | null
}

/** One row per exercise with sets today, in plan order. */
export function buildSummary(
  draft: Draft,
  exercises: readonly { exerciseId: string; name: string; lastSets: readonly LastSet[] }[],
): SummaryRow[] {
  return exercises.flatMap(({ exerciseId, name, lastSets }) => {
    const sets = [...setsOf(draft, exerciseId)].sort((a, b) => a.setNumber - b.setNumber)
    const heaviest = sets.reduce<DraftSet | undefined>((top, set) => (!top || set.weightKg > top.weightKg ? set : top), undefined)
    if (!heaviest) return []
    const before = lastSets.length > 0 ? Math.max(...lastSets.map((set) => set.weight_kg)) : null
    return [
      {
        exerciseId,
        name,
        sets: sets.length,
        weightsKg: sets.map((set) => set.weightKg),
        weightKg: heaviest.weightKg,
        equipment: heaviest.equipment,
        deltaKg: before === null ? null : Math.round((heaviest.weightKg - before) * 100) / 100,
      },
    ]
  })
}
