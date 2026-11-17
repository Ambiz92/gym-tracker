import { describe, expect, it } from 'vitest'
import { prefillSets, type LastSet, type PrefillExercise, type PrefillTarget } from './prefill'

const target: PrefillTarget = { target_sets: 3, target_reps: 8, suggested_weight_kg: 20 }
const exercise: PrefillExercise = { equipment: 'barbell', starting_weight_kg: 15 }

const last = (set_number: number, reps: number, weight_kg: number, equipment_used: LastSet['equipment_used'] = 'barbell'): LastSet => ({
  set_number,
  reps,
  weight_kg,
  equipment_used,
})

describe('prefillSets', () => {
  it('copies reps and weight per set from the last workout', () => {
    const rows = prefillSets([last(1, 8, 22.5), last(2, 7, 22.5), last(3, 6, 20)], target, exercise)
    expect(rows).toEqual([
      { set_number: 1, reps: 8, weight_kg: 22.5, equipment_used: 'barbell' },
      { set_number: 2, reps: 7, weight_kg: 22.5, equipment_used: 'barbell' },
      { set_number: 3, reps: 6, weight_kg: 20, equipment_used: 'barbell' },
    ])
  })

  it('matches sets by set number regardless of input order', () => {
    const rows = prefillSets([last(3, 6, 30), last(1, 8, 10), last(2, 7, 20)], target, exercise)
    expect(rows.map((row) => row.weight_kg)).toEqual([10, 20, 30])
  })

  it('uses the suggested weight and target reps without history', () => {
    expect(prefillSets([], target, exercise)).toEqual([
      { set_number: 1, reps: 8, weight_kg: 20, equipment_used: 'barbell' },
      { set_number: 2, reps: 8, weight_kg: 20, equipment_used: 'barbell' },
      { set_number: 3, reps: 8, weight_kg: 20, equipment_used: 'barbell' },
    ])
  })

  it('falls back to the starting weight without history and without a suggestion', () => {
    const rows = prefillSets([], { ...target, suggested_weight_kg: null }, exercise)
    expect(rows.map((row) => row.weight_kg)).toEqual([15, 15, 15])
  })

  it('leaves the weight empty when nothing is known', () => {
    const rows = prefillSets([], { ...target, suggested_weight_kg: null }, { ...exercise, starting_weight_kg: null })
    expect(rows.map((row) => row.weight_kg)).toEqual([null, null, null])
  })

  it('keeps a logged weight of 0 instead of falling back', () => {
    const rows = prefillSets([last(1, 8, 0)], target, exercise)
    expect(rows[0]).toMatchObject({ reps: 8, weight_kg: 0 })
  })

  it('fills only the missing sets from the plan when the last workout was partial', () => {
    const rows = prefillSets([last(1, 6, 25)], target, exercise)
    expect(rows).toEqual([
      { set_number: 1, reps: 6, weight_kg: 25, equipment_used: 'barbell' },
      { set_number: 2, reps: 8, weight_kg: 20, equipment_used: 'barbell' },
      { set_number: 3, reps: 8, weight_kg: 20, equipment_used: 'barbell' },
    ])
  })

  it('produces exactly target_sets rows, ignoring extra logged sets', () => {
    const rows = prefillSets([last(1, 8, 20), last(2, 8, 20), last(3, 8, 20), last(4, 8, 20)], target, exercise)
    expect(rows).toHaveLength(3)
  })

  it('adds rows when the target has more sets than the last workout', () => {
    const rows = prefillSets([last(1, 8, 20)], { ...target, target_sets: 4 }, exercise)
    expect(rows.map((row) => row.set_number)).toEqual([1, 2, 3, 4])
  })

  it('returns no rows for a target without sets', () => {
    expect(prefillSets([last(1, 8, 20)], { ...target, target_sets: 0 }, exercise)).toEqual([])
  })

  it('keeps the equipment used last time and defaults to the exercise equipment', () => {
    const rows = prefillSets([last(1, 10, 12, 'dumbbell')], target, exercise)
    expect(rows.map((row) => row.equipment_used)).toEqual(['dumbbell', 'barbell', 'barbell'])
  })

  it('copies the target value for timed and distance exercises', () => {
    const rows = prefillSets([], { target_sets: 2, target_reps: 40, suggested_weight_kg: null }, { equipment: 'other', starting_weight_kg: null })
    expect(rows).toEqual([
      { set_number: 1, reps: 40, weight_kg: null, equipment_used: 'other' },
      { set_number: 2, reps: 40, weight_kg: null, equipment_used: 'other' },
    ])
  })
})
