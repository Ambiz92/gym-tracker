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
