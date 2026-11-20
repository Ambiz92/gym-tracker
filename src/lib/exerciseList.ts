import type { Exercise } from '../types/db'
import { EQUIPMENT_LABELS } from './exerciseForm'

const collator = new Intl.Collator('it', { sensitivity: 'base' })

/** Lowercase without accents, so "stacco" finds "Staccò". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Keeps the exercises whose name contains every word of the query; an empty query keeps all. */
export function filterExercises<T extends Pick<Exercise, 'name'>>(exercises: readonly T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...exercises]
  return exercises.filter((exercise) => {
    const name = normalize(exercise.name)
    return words.every((word) => name.includes(word))
  })
}

/** True when an exercise is called exactly `name` (ignoring case, accents and spaces around it): the quick create is offered only when not. */
export function hasExactName(exercises: readonly Pick<Exercise, 'name'>[], name: string): boolean {
  const wanted = normalize(name.trim())
  return exercises.some((exercise) => normalize(exercise.name.trim()) === wanted)
}

/** Active exercises first, then archived ones, each group by name. */
export function sortExercises(exercises: readonly Exercise[]): Exercise[] {
  return [...exercises].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || collator.compare(a.name, b.name),
  )
}

/** Second line of a list row: equipment and muscles. */
export function exerciseDetail(exercise: Pick<Exercise, 'equipment' | 'muscles'>): string {
  const label = EQUIPMENT_LABELS[exercise.equipment]
  return exercise.muscles ? `${label} · ${exercise.muscles}` : label
}

/** "in 2 schede", "in 1 scheda" or "non usato": how many plans use an exercise. */
export function usageLabel(planCount: number): string {
  if (planCount === 0) return 'non usato'
  return planCount === 1 ? 'in 1 scheda' : `in ${planCount} schede`
}

/** Second line of a library row on desktop: equipment and plan usage. */
export function exerciseUsageDetail(exercise: Pick<Exercise, 'equipment'>, planCount: number): string {
  return `${EQUIPMENT_LABELS[exercise.equipment]} · ${usageLabel(planCount)}`
}
