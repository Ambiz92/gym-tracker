import type { Equipment, LastSet, PlanExercise, TargetUnit } from '../types/db'
import { formatNumber } from './formatNumber'
import { toDisplayKg, toStoredKg } from './barbellLoad'
import { BAR_KG } from './plates'
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
  /** Prefill row for the set about to be logged; its weight is stored kg. */
  row: PrefillRow
  /** The set of this exercise confirmed just before, today. */
  previous: DraftSet | undefined
  /** Weight proposed by the progression rule, when last time was clean; stored kg. */
  suggestedKg: number | null
}

/**
 * Values the logger opens with, weight as the logger shows it (one side on a barbell). After a set
 * today, weight and equipment carry over from it (the user's decision of the day beats last
 * workout's); the first set takes the progression suggestion, then the prefill, both stored kg.
 * Reps always follow the prefill.
 */
export function startingValues({ row, previous, suggestedKg }: StartingValuesInput): SetValues {
  const equipment = previous?.equipment ?? row.equipment_used
  const storedKg = suggestedKg ?? row.weight_kg
  return {
    weight: previous?.weightKg ?? (storedKg === null ? 0 : toDisplayKg(equipment, storedKg)),
    reps: row.reps,
    equipment,
  }
}

/** "12,5 kg", or "15 kg per lato" on a barbell. */
const weightText = (kg: number, equipment: Equipment): string =>
  `${formatNumber(kg)} kg${equipment === 'barbell' ? ' per lato' : ''}`

/** "Ultima volta 12,5 kg × 10 · suggerito 15 ↑", or a first-time note; stored kg in, a barbell weight out as one side, "per lato". */
export function lastTimeHint(
  lastSets: readonly LastSet[],
  setNumber: number,
  unit: TargetUnit,
  suggestedKg: number | null,
): string {
  const sorted = [...lastSets].sort((a, b) => a.set_number - b.set_number)
  const reference = sorted.find((set) => set.set_number === setNumber) ?? sorted.at(-1)
  if (!reference) return 'Prima volta con questo esercizio'

  const equipment = reference.equipment_used
  const barbell = equipment === 'barbell'
  const last = `Ultima volta ${weightText(toDisplayKg(equipment, reference.weight_kg), equipment)} × ${reference.reps}${UNIT_SUFFIX[unit]}`
  if (suggestedKg === null) return last
  const suggested = toDisplayKg(equipment, suggestedKg)
  return `${last} · suggerito ${barbell ? weightText(suggested, equipment) : formatNumber(suggested)} ↑`
}

/** Under the giant number: "2 × 15 kg + sbarra 20 kg = 50 kg". Information only, the weight stays the one side. */
export const barbellTotalNote = (sideKg: number): string =>
  `2 × ${formatNumber(sideKg)} kg + sbarra ${BAR_KG} kg = ${formatNumber(toStoredKg('barbell', sideKg) + BAR_KG)} kg`

/** The set about to be saved, in caps for the save button: "62,5 KG × 8", "15 KG PER LATO × 8", "20 KG × 30 SEC", or just "30 SEC" without a weight. */
export function setSummary({ weight, reps, equipment }: SetValues, unit: TargetUnit): string {
  const repsText = `${reps} ${UNIT_LABEL[unit]}`.toUpperCase()
  if (weight === 0) return repsText
  const load = weightText(weight, equipment).toUpperCase()
  return unit === 'reps' ? `${load} × ${reps}` : `${load} × ${repsText}`
}

/** "3×8" or "3×30 s"; the weight lives in the set logger and in the history, not on the rows. */
export function targetLabel(target: Pick<PlanExercise, 'target_sets' | 'target_reps' | 'target_unit'>): string {
  return `${target.target_sets}×${target.target_reps}${UNIT_SUFFIX[target.target_unit]}`
}

/** "3 × 15 kg" or "2 × 30 kg totali · 1 × 25 kg totali": the stored weights of the sets, runs of the same weight collapsed. */
export function loadLabel(weightsKg: readonly number[], equipment: Equipment): string {
  const runs: { weightKg: number; count: number }[] = []
  for (const weightKg of weightsKg) {
    const last = runs.at(-1)
    if (last?.weightKg === weightKg) last.count += 1
    else runs.push({ weightKg, count: 1 })
  }
  const unit = equipment === 'barbell' ? ' totali' : ''
  return runs.map(({ weightKg, count }) => `${count} × ${formatNumber(weightKg)} kg${unit}`).join(' · ')
}

export interface SummaryRow {
  exerciseId: string
  name: string
  sets: number
  /** Stored kg of every set today, in set order. */
  weightsKg: number[]
  /** Heaviest stored weight of the session. */
  weightKg: number
  equipment: Equipment
  /** Against the heaviest weight of the last workout; null without one. */
  deltaKg: number | null
}

/** One row per exercise with sets today, in plan order. Weights are stored kg (a barbell's total), also in `lastSets`. */
export function buildSummary(
  draft: Draft,
  exercises: readonly { exerciseId: string; name: string; lastSets: readonly LastSet[] }[],
): SummaryRow[] {
  return exercises.flatMap(({ exerciseId, name, lastSets }) => {
    const sets = [...setsOf(draft, exerciseId)]
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((set) => ({ ...set, storedKg: toStoredKg(set.equipment, set.weightKg) }))
    const heaviest = sets.reduce<(typeof sets)[number] | undefined>((top, set) => (!top || set.storedKg > top.storedKg ? set : top), undefined)
    if (!heaviest) return []
    const before = lastSets.length > 0 ? Math.max(...lastSets.map((set) => set.weight_kg)) : null
    return [
      {
        exerciseId,
        name,
        sets: sets.length,
        weightsKg: sets.map((set) => set.storedKg),
        weightKg: heaviest.storedKg,
        equipment: heaviest.equipment,
        deltaKg: before === null ? null : Math.round((heaviest.storedKg - before) * 100) / 100,
      },
    ]
  })
}
