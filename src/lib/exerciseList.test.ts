import { describe, expect, it } from 'vitest'
import type { CatalogExercise, Exercise } from '../types/db'
import {
  exerciseDetail,
  exerciseFromCatalog,
  exerciseSections,
  exerciseUsageDetail,
  filterExercises,
  hasExactName,
  sortExercises,
  usageLabel,
} from './exerciseList'

function exercise(name: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: name,
    owner_id: 'u1',
    name,
    equipment: 'barbell',
    muscles: null,
    execution_steps: null,
    notes: null,
    starting_weight_kg: null,
    archived: false,
    catalog_id: null,
    ...overrides,
  }
}

function entry(id: string, overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id,
    slug: id,
    name_it: `Voce ${id}`,
    name_en: `Entry ${id}`,
    synonyms: [],
    equipment: 'barbell',
    primary_muscle: 'Petto',
    secondary_muscles: [],
    execution_steps: null,
    source: 'test',
    source_id: id,
    ...overrides,
  }
}

const deadlift = entry('deadlift', { name_it: 'Stacco da terra', name_en: 'Deadlift', synonyms: ['Stacco', 'Stacco classico'] })
const bench = entry('bench', {
  name_it: 'Distensioni su panca piana',
  name_en: 'Barbell bench press',
  synonyms: ['Panca piana', 'Panca'],
  primary_muscle: 'Petto',
  secondary_muscles: ['Tricipiti', 'Spalle'],
})
const lateral = entry('lateral', {
  name_it: 'Alzate laterali',
  name_en: 'Lateral raise',
  synonyms: ['Alzate'],
  equipment: 'dumbbell',
  primary_muscle: 'Spalle',
})
const catalog = [deadlift, bench, lateral]

describe('filterExercises', () => {
  const all = [exercise('Panca piana'), exercise('Stacco da terra'), exercise('Curl con bilanciere')]

  it('keeps everything for an empty or blank query', () => {
    expect(filterExercises(all, '')).toEqual(all)
    expect(filterExercises(all, '   ')).toEqual(all)
  })

  it('matches case-insensitively and by substring', () => {
    expect(filterExercises(all, 'PANCA').map((e) => e.name)).toEqual(['Panca piana'])
    expect(filterExercises(all, 'ter').map((e) => e.name)).toEqual(['Stacco da terra'])
  })

  it('ignores accents on both sides', () => {
    expect(filterExercises([exercise('Staccò')], 'stacco')).toHaveLength(1)
    expect(filterExercises([exercise('Stacco')], 'staccò')).toHaveLength(1)
  })

  it('requires every word, in any order', () => {
    expect(filterExercises(all, 'terra stacco').map((e) => e.name)).toEqual(['Stacco da terra'])
    expect(filterExercises(all, 'stacco panca')).toEqual([])
  })

  it('does not match on muscles or notes', () => {
    expect(filterExercises([exercise('Squat', { muscles: 'Panca', notes: 'panca' })], 'panca')).toEqual([])
  })
})

describe('filterExercises on catalog entries', () => {
  it('matches the Italian name, the English name and every synonym', () => {
    expect(filterExercises(catalog, 'alzate laterali')).toEqual([lateral])
    expect(filterExercises(catalog, 'deadlift')).toEqual([deadlift])
    expect(filterExercises(catalog, 'classico')).toEqual([deadlift])
  })

  it('ignores case and accents in the query and in the names', () => {
    expect(filterExercises([entry('a', { synonyms: ['Staccò'] })], 'STACCO')).toHaveLength(1)
    expect(filterExercises([entry('a', { name_it: 'Pressé' })], 'presse')).toHaveLength(1)
    expect(filterExercises(catalog, 'bENch')).toEqual([bench])
  })

  it('requires every word inside a single name, never across names', () => {
    expect(filterExercises(catalog, 'panca piana')).toEqual([bench])
    expect(filterExercises(catalog, 'stacco press')).toEqual([])
    expect(filterExercises(catalog, 'panca barbell')).toEqual([])
  })

  it('does not match on equipment or muscles, and keeps everything for an empty query', () => {
    expect(filterExercises(catalog, 'tricipiti')).toEqual([])
    expect(filterExercises(catalog, 'dumbbell')).toEqual([])
    expect(filterExercises(catalog, ' ')).toEqual(catalog)
  })

  it('handles entries without synonyms', () => {
    expect(filterExercises([entry('a')], 'voce')).toHaveLength(1)
  })
})

describe('hasExactName', () => {
  const library = [{ name: 'Stacco da terra' }, { name: 'Curl' }]

  it('matches the whole name, ignoring case, accents and edge spaces', () => {
    expect(hasExactName(library, ' stacco DA terra ')).toBe(true)
    expect(hasExactName(library, 'Staccó da terra')).toBe(true)
  })

  it('does not match a part of a name or a longer one', () => {
    expect(hasExactName(library, 'Stacco')).toBe(false)
    expect(hasExactName(library, 'Curl a martello')).toBe(false)
  })
})

describe('hasExactName with a catalog', () => {
  it('sees the Italian name, the English name and the synonyms of catalog entries', () => {
    expect(hasExactName([], 'stacco da terra', catalog)).toBe(true)
    expect(hasExactName([], ' DEADLIFT ', catalog)).toBe(true)
    expect(hasExactName([], 'Staccó', catalog)).toBe(true)
    expect(hasExactName([], 'panca', catalog)).toBe(true)
  })

  it('still sees the user exercises and does not match a part of a catalog name', () => {
    expect(hasExactName([{ name: 'Curl' }], 'curl', catalog)).toBe(true)
    expect(hasExactName([{ name: 'Curl' }], 'Alzate laterali con elastico', catalog)).toBe(false)
    expect(hasExactName([], 'Distensioni', catalog)).toBe(false)
  })

  it('ignores the catalog when none is given', () => {
    expect(hasExactName([], 'Stacco da terra')).toBe(false)
  })
})

describe('exerciseSections', () => {
  const mine = [
    exercise('Panca piana', { id: 'm1', catalog_id: 'bench', muscles: 'Petto, Tricipiti' }),
    exercise('Curl personale', { id: 'm2', equipment: 'dumbbell', muscles: 'Bicipiti' }),
    exercise('Senza muscoli', { id: 'm3', equipment: 'other', muscles: null }),
  ]

  it('returns everything, with the adopted catalog entries hidden, for no filters', () => {
    const sections = exerciseSections(mine, catalog)
    expect(sections.mine).toEqual(mine)
    expect(sections.catalog).toEqual([deadlift, lateral])
  })

  it('hides the entry of an archived copy too, since a second copy would be refused', () => {
    const archived = [exercise('Stacco', { catalog_id: 'deadlift', archived: true })]
    expect(exerciseSections(archived, catalog).catalog).toEqual([bench, lateral])
  })

  it('keeps entries whose name matches a personal exercise that is not linked to them', () => {
    const unlinked = [exercise('Stacco da terra')]
    expect(exerciseSections(unlinked, catalog).catalog).toEqual(catalog)
  })

  it('searches both sections by name and synonym, ignoring accents', () => {
    const sections = exerciseSections(mine, catalog, { query: 'STACCÒ' })
    expect(sections.mine).toEqual([])
    expect(sections.catalog).toEqual([deadlift])
    expect(exerciseSections(mine, catalog, { query: 'panca' })).toEqual({ mine: [mine[0]], catalog: [] })
  })

  it('does not return an adopted entry even when the query matches its synonym', () => {
    expect(exerciseSections(mine, catalog, { query: 'bench' }).catalog).toEqual([])
  })

  it('filters by equipment in both sections', () => {
    const sections = exerciseSections(mine, catalog, { equipment: 'dumbbell' })
    expect(sections.mine.map((e) => e.name)).toEqual(['Curl personale'])
    expect(sections.catalog).toEqual([lateral])
  })

  it('filters by muscle: the primary muscle of catalog entries, the muscles text of user exercises', () => {
    expect(exerciseSections(mine, catalog, { muscle: 'spalle' }).catalog).toEqual([lateral])
    expect(exerciseSections(mine, catalog, { muscle: ' SPALLE ' }).catalog).toEqual([lateral])
    expect(exerciseSections(mine, catalog, { muscle: 'bicipiti' }).mine.map((e) => e.name)).toEqual(['Curl personale'])
    expect(exerciseSections(mine, catalog, { muscle: 'tricipiti' }).mine.map((e) => e.name)).toEqual(['Panca piana'])
  })

  it('matches the muscle filter on the primary muscle only, not on the secondary ones', () => {
    expect(exerciseSections([], [bench], { muscle: 'Tricipiti' }).catalog).toEqual([])
    expect(exerciseSections([], [bench], { muscle: 'Petto' }).catalog).toEqual([bench])
  })

  it('ignores accents in the muscle filter and drops exercises without muscles', () => {
    const entries = [entry('a', { primary_muscle: 'Quadricipiti' }), entry('b', { primary_muscle: 'Glúteo' })]
    expect(exerciseSections([], entries, { muscle: 'gluteo' }).catalog.map((e) => e.id)).toEqual(['b'])
    expect(exerciseSections(mine, [], { muscle: 'petto' }).mine.map((e) => e.name)).toEqual(['Panca piana'])
  })

  it('combines query, equipment and muscle', () => {
    const entries = [lateral, entry('l2', { name_it: 'Alzate frontali', equipment: 'barbell', primary_muscle: 'Spalle' })]
    expect(exerciseSections([], entries, { query: 'alzate', equipment: 'barbell', muscle: 'Spalle' }).catalog.map((e) => e.id)).toEqual(['l2'])
    expect(exerciseSections([], entries, { query: 'alzate', equipment: 'other' }).catalog).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const input = [...mine]
    exerciseSections(input, catalog, { query: 'x' })
    expect(input).toEqual(mine)
  })
})

describe('exerciseFromCatalog', () => {
  it('copies name, equipment, steps and link, with primary and secondary muscles as text', () => {
    expect(exerciseFromCatalog(entry('bench', { ...bench, execution_steps: 'Scendi\nSpingi' }))).toEqual({
      name: 'Distensioni su panca piana',
      equipment: 'barbell',
      muscles: 'Petto, Tricipiti, Spalle',
      execution_steps: 'Scendi\nSpingi',
      catalog_id: 'bench',
    })
  })

  it('writes only the primary muscle when there are no secondary ones and keeps null steps', () => {
    const copy = exerciseFromCatalog(lateral)
    expect(copy.muscles).toBe('Spalle')
    expect(copy.execution_steps).toBeNull()
    expect(copy.equipment).toBe('dumbbell')
  })

  it('leaves the per-user fields to the database defaults', () => {
    expect(Object.keys(exerciseFromCatalog(deadlift)).sort()).toEqual(['catalog_id', 'equipment', 'execution_steps', 'muscles', 'name'])
  })
})

describe('sortExercises', () => {
  it('puts active exercises first, then archived, each by name', () => {
    const sorted = sortExercises([
      exercise('Zercher', { archived: true }),
      exercise('Squat'),
      exercise('Alzate', { archived: true }),
      exercise('Curl'),
    ])
    expect(sorted.map((e) => e.name)).toEqual(['Curl', 'Squat', 'Alzate', 'Zercher'])
  })

  it('sorts by name ignoring case and does not mutate the input', () => {
    const input = [exercise('squat'), exercise('Curl')]
    expect(sortExercises(input).map((e) => e.name)).toEqual(['Curl', 'squat'])
    expect(input.map((e) => e.name)).toEqual(['squat', 'Curl'])
  })
})

describe('exerciseDetail', () => {
  it('shows the equipment label alone or followed by the muscles', () => {
    expect(exerciseDetail({ equipment: 'dumbbell', muscles: null })).toBe('Manubri')
    expect(exerciseDetail({ equipment: 'barbell', muscles: 'Dorsali' })).toBe('Bilanciere · Dorsali')
    expect(exerciseDetail({ equipment: 'other', muscles: '' })).toBe('Altro')
  })
})

describe('usage labels', () => {
  it('counts plans in Italian, with a plain label for an unused exercise', () => {
    expect(usageLabel(0)).toBe('non usato')
    expect(usageLabel(1)).toBe('in 1 scheda')
    expect(usageLabel(3)).toBe('in 3 schede')
  })

  it('replaces the muscles with the usage in the desktop row detail', () => {
    expect(exerciseUsageDetail(exercise('Step-up', { equipment: 'dumbbell', muscles: 'Quadricipiti' }), 0)).toBe('Manubri · non usato')
  })
})
