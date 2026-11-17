import { describe, expect, it } from 'vitest'
import type { Exercise } from '../types/db'
import { exerciseDetail, filterExercises, sortExercises } from './exerciseList'

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
