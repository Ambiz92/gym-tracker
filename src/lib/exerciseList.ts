import type { CatalogExercise, Equipment, Exercise, ExerciseInsert } from '../types/db'
import { EQUIPMENT_LABELS } from './exerciseForm'

const collator = new Intl.Collator('it', { sensitivity: 'base' })

/** Lowercase without accents, so "stacco" finds "Staccò". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

type UserNames = Pick<Exercise, 'name'>
type CatalogNames = Pick<CatalogExercise, 'name_it' | 'name_en' | 'synonyms'>

/** Every name an entry answers to: a user exercise has one, a catalog entry has Italian name, English name and synonyms. */
function searchTerms(item: UserNames | CatalogNames): string[] {
  return 'name' in item
    ? [item.name]
    : [item.name_it, ...(item.name_en ? [item.name_en] : []), ...item.synonyms]
}

/** Keeps the entries with a name or synonym containing every word of the query; an empty query keeps all. */
export function filterExercises<T extends UserNames | CatalogNames>(exercises: readonly T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...exercises]
  return exercises.filter((exercise) => {
    const terms = searchTerms(exercise).map(normalize)
    return terms.some((term) => words.every((word) => term.includes(word)))
  })
}

/** True when an exercise or catalog entry is called exactly `name` (ignoring case, accents and spaces around it): the quick create is offered only when not. */
export function hasExactName(exercises: readonly UserNames[], name: string, catalog: readonly CatalogNames[] = []): boolean {
  const wanted = normalize(name.trim())
  return [...exercises, ...catalog].some((item) => searchTerms(item).some((term) => normalize(term.trim()) === wanted))
}

export interface ExerciseFilters {
  query?: string
  equipment?: Equipment
  /** Primary muscle of a catalog entry; matched as text inside the muscles of a user exercise. */
  muscle?: string
  /** Catalog ids already copied, for when `exercises` leaves archived copies out; adds to those of `exercises`. */
  adoptedCatalogIds?: ReadonlySet<string>
}

export interface ExerciseSections<T> {
  /** "I tuoi esercizi" */
  mine: T[]
  /** "Catalogo": the entries the user has not copied yet. */
  catalog: CatalogExercise[]
}

/** Splits a search into the user's exercises and the catalog entries not adopted yet (an archived copy counts as adopted). */
export function exerciseSections<T extends UserNames & Pick<Exercise, 'equipment' | 'muscles' | 'catalog_id'>>(
  exercises: readonly T[],
  catalog: readonly CatalogExercise[],
  { query = '', equipment, muscle, adoptedCatalogIds = new Set() }: ExerciseFilters = {},
): ExerciseSections<T> {
  const adopted = new Set([...adoptedCatalogIds, ...exercises.map((exercise) => exercise.catalog_id)])
  const wantedMuscle = muscle === undefined ? null : normalize(muscle.trim())
  const matchesEquipment = (item: { equipment: Equipment }) => equipment === undefined || item.equipment === equipment
  return {
    mine: filterExercises(exercises, query).filter(
      (exercise) =>
        matchesEquipment(exercise) && (wantedMuscle === null || normalize(exercise.muscles ?? '').includes(wantedMuscle)),
    ),
    catalog: filterExercises(catalog, query).filter(
      (entry) =>
        !adopted.has(entry.id) &&
        matchesEquipment(entry) &&
        (wantedMuscle === null || normalize(entry.primary_muscle) === wantedMuscle),
    ),
  }
}

/** The personal copy of a catalog entry, ready to insert. */
export function exerciseFromCatalog(entry: CatalogExercise): ExerciseInsert {
  return {
    name: entry.name_it,
    equipment: entry.equipment,
    muscles: [entry.primary_muscle, ...entry.secondary_muscles].join(', '),
    execution_steps: entry.execution_steps,
    catalog_id: entry.id,
  }
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
