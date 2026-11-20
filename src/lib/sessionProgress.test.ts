import { describe, expect, it } from 'vitest'
import type { Equipment, LastSet } from '../types/db'
import { addSet, ackWorkout, newDraft, removeSet, type Draft } from './sessionDraft'
import {
  barbellTotalNote,
  buildSummary,
  completedExercises,
  equipmentLabel,
  isExerciseDone,
  lastTimeHint,
  loadLabel,
  loggedCount,
  setSummary,
  splitSteps,
  startingValues,
  targetLabel,
  unitLabel,
} from './sessionProgress'

const base = newDraft({ workoutId: 'w', date: '2026-11-17', sessionId: 's', sessionName: 'Upper', startedAt: 0 })
const logged = (draft: Draft, id: string, exerciseId: string, setNumber: number, weightKg = 20): Draft =>
  addSet(draft, { id, exerciseId, setNumber, reps: 8, weightKg, equipment: 'barbell' })
const last = (set_number: number, reps: number, weight_kg: number, equipment_used: LastSet['equipment_used'] = 'dumbbell'): LastSet => ({
  set_number,
  reps,
  weight_kg,
  equipment_used,
})

describe('exercise progress', () => {
  const draft = logged(logged(logged(base, 'a', 'e1', 1), 'b', 'e1', 2), 'c', 'e2', 1)

  it('counts logged sets and treats no draft as nothing done', () => {
    expect(loggedCount(draft, 'e1')).toBe(2)
    expect(loggedCount(null, 'e1')).toBe(0)
  })

  it('marks an exercise done once every target set is logged', () => {
    expect(isExerciseDone(draft, { exercise_id: 'e1', target_sets: 2 })).toBe(true)
    expect(isExerciseDone(draft, { exercise_id: 'e2', target_sets: 3 })).toBe(false)
    expect(completedExercises(draft, [{ exercise_id: 'e1', target_sets: 2 }, { exercise_id: 'e2', target_sets: 3 }])).toBe(1)
  })

  it('does not count an undone set', () => {
    const undone = removeSet(ackWorkout(logged(base, 'a', 'e1', 1)), 'a')
    expect(loggedCount(undone, 'e1')).toBe(0)
  })
})

describe('startingValues', () => {
  const row = { set_number: 2, reps: 8, weight_kg: 12.5, equipment_used: 'barbell' as const }

  it('takes the progression suggestion for the first set', () => {
    expect(startingValues({ row, previous: undefined, suggestedKg: 15 })).toEqual({ weight: 15, reps: 8, equipment: 'barbell' })
  })

  it('opens a barbell on the last weight as it was saved, which is the load of one side', () => {
    const lastTime = { set_number: 1, reps: 10, weight_kg: 15, equipment_used: 'barbell' as const }
    expect(startingValues({ row: lastTime, previous: undefined, suggestedKg: null })).toEqual({ weight: 15, reps: 10, equipment: 'barbell' })
  })

  it('falls back to the prefill weight, then to zero', () => {
    expect(startingValues({ row, previous: undefined, suggestedKg: null }).weight).toBe(12.5)
    expect(startingValues({ row: { ...row, weight_kg: null }, previous: undefined, suggestedKg: null }).weight).toBe(0)
  })

  it('carries weight and equipment over from the previous set of today', () => {
    const previous = { id: 'a', exerciseId: 'e1', setNumber: 1, reps: 6, weightKg: 17.5, equipment: 'dumbbell' as const, sync: 'pending' as const }
    expect(startingValues({ row, previous, suggestedKg: 15 })).toEqual({ weight: 17.5, reps: 8, equipment: 'dumbbell' })
  })
})

describe('barbellTotalNote', () => {
  it('spells out the total of the two sides and the bar, which is only information', () => {
    expect(barbellTotalNote(15)).toBe('2 × 15 kg + sbarra 20 kg = 50 kg')
    expect(barbellTotalNote(62.5)).toBe('2 × 62,5 kg + sbarra 20 kg = 145 kg')
    expect(barbellTotalNote(0)).toBe('2 × 0 kg + sbarra 20 kg = 20 kg')
  })
})

describe('lastTimeHint', () => {
  it('shows the same set of last time and the suggestion', () => {
    expect(lastTimeHint([last(1, 10, 12.5), last(2, 9, 12.5)], 2, 'reps', 15)).toBe('Ultima volta 12,5 kg × 9 · suggerito 15 ↑')
  })

  it('uses the last set when the number does not exist, without a suggestion', () => {
    expect(lastTimeHint([last(1, 10, 12.5)], 3, 'reps', null)).toBe('Ultima volta 12,5 kg × 10')
  })

  it('writes the unit of timed and distance sets', () => {
    expect(lastTimeHint([last(1, 30, 0)], 1, 'seconds', null)).toBe('Ultima volta 0 kg × 30 s')
    expect(lastTimeHint([last(1, 20, 40)], 1, 'meters', null)).toBe('Ultima volta 40 kg × 20 m')
  })

  it('says "per lato" on a barbell weight, which is the load of one side', () => {
    expect(lastTimeHint([last(1, 10, 15, 'barbell')], 1, 'reps', 17.5)).toBe(
      'Ultima volta 15 kg per lato × 10 · suggerito 17,5 kg per lato ↑',
    )
    expect(lastTimeHint([last(1, 10, 15, 'barbell')], 1, 'reps', null)).toBe('Ultima volta 15 kg per lato × 10')
  })

  it('says so on the first time', () => {
    expect(lastTimeHint([], 1, 'reps', null)).toBe('Prima volta con questo esercizio')
  })
})

describe('labels', () => {
  const target = { target_sets: 3, target_reps: 8, target_unit: 'reps' as const }

  it('writes the target as sets and reps, without the weight', () => {
    expect(targetLabel(target)).toBe('3×8')
    expect(targetLabel({ ...target, target_unit: 'seconds', target_reps: 30 })).toBe('3×30 s')
  })

  it('names the unit under the reps number', () => {
    expect([unitLabel('reps'), unitLabel('seconds'), unitLabel('meters')]).toEqual(['rip', 'sec', 'm'])
  })
})

describe('setSummary', () => {
  const values = (weight: number, reps: number, equipment: Equipment = 'dumbbell') => ({ weight, reps, equipment })

  it('writes the weight and the reps in caps', () => {
    expect(setSummary(values(62.5, 8), 'reps')).toBe('62,5 KG × 8')
  })

  it('says "per lato" on a barbell weight', () => {
    expect(setSummary(values(15, 10, 'barbell'), 'reps')).toBe('15 KG PER LATO × 10')
    expect(setSummary(values(15, 30, 'barbell'), 'seconds')).toBe('15 KG PER LATO × 30 SEC')
  })

  it('names the unit of a timed or distance set', () => {
    expect(setSummary(values(20, 30), 'seconds')).toBe('20 KG × 30 SEC')
    expect(setSummary(values(15, 40), 'meters')).toBe('15 KG × 40 M')
  })

  it('leaves the weight out when there is none', () => {
    expect(setSummary(values(0, 30), 'seconds')).toBe('30 SEC')
    expect(setSummary(values(0, 12, 'barbell'), 'reps')).toBe('12 RIP')
  })
})

describe('loadLabel', () => {
  it('collapses runs of the same weight', () => {
    expect(loadLabel([15, 15, 12.5], 'dumbbell')).toBe('2 × 15 kg · 1 × 12,5 kg')
    expect(loadLabel([30, 30, 30], 'other')).toBe('3 × 30 kg')
    expect(loadLabel([20, 22.5, 20], 'dumbbell')).toBe('1 × 20 kg · 1 × 22,5 kg · 1 × 20 kg')
  })

  it('says "per lato" on a barbell, whose weights are the load of one side', () => {
    expect(loadLabel([15, 15, 12.5], 'barbell')).toBe('2 × 15 kg per lato · 1 × 12,5 kg per lato')
  })
})

describe('buildSummary', () => {
  const exercises = [
    { exerciseId: 'e1', name: 'Panca', lastSets: [last(1, 8, 15)] },
    { exerciseId: 'e2', name: 'Rematore', lastSets: [last(1, 8, 25)] },
    { exerciseId: 'e3', name: 'Curl', lastSets: [] },
    { exerciseId: 'e4', name: 'Squat', lastSets: [] },
  ]
  const draft = logged(logged(logged(logged(logged(base, 'a', 'e1', 1, 15), 'b', 'e2', 1, 25), 'c', 'e2', 2, 27.5), 'd', 'e3', 1, 10), 'e', 'e1', 2, 15)

  it('keeps plan order, skips untouched exercises and compares the heaviest weights', () => {
    expect(buildSummary(draft, exercises).map(({ name, sets, weightKg, deltaKg }) => ({ name, sets, weightKg, deltaKg }))).toEqual([
      { name: 'Panca', sets: 2, weightKg: 15, deltaKg: 0 },
      { name: 'Rematore', sets: 2, weightKg: 27.5, deltaKg: 2.5 },
      { name: 'Curl', sets: 1, weightKg: 10, deltaKg: null },
    ])
  })

  it('lists the weight of every set in set order', () => {
    const unordered = logged(logged(base, 'a', 'e2', 2, 27.5), 'b', 'e2', 1, 25)
    expect(buildSummary(unordered, exercises)[0]?.weightsKg).toEqual([25, 27.5])
  })
})

describe('splitSteps', () => {
  it('returns one step per non-empty line without the typed numbering', () => {
    expect(splitSteps('1. In piedi\n\n2) Gomiti fermi\n  Scendi piano  ')).toEqual(['In piedi', 'Gomiti fermi', 'Scendi piano'])
  })

  it('returns nothing without text', () => {
    expect(splitSteps(null)).toEqual([])
    expect(splitSteps('  \n ')).toEqual([])
  })
})

it('labels the equipment in Italian', () => {
  expect([equipmentLabel('barbell'), equipmentLabel('dumbbell'), equipmentLabel('other')]).toEqual(['Bilanciere', 'Manubri', 'Altro'])
})
