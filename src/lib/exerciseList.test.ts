import { describe, expect, it } from 'vitest'
import type { Exercise } from '../types/db'
import { exerciseDetail, exerciseUsageDetail, filterExercises, hasExactName, sortExercises, usageLabel } from './exerciseList'

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
    ...overrides,
  }
}

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
