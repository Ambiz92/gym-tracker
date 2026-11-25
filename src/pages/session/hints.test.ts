import { describe, expect, it } from 'vitest'
import type { LastSet, PlanExercise } from '../../types/db'
import { progressionChip, suggestedWeight } from './hints'

const target = { target_sets: 2, target_reps: 8 } as PlanExercise

function workout(weight: number, reps: number[], equipment: LastSet['equipment_used'] = 'barbell'): LastSet[] {
  return reps.map((count, index) => ({ set_number: index + 1, reps: count, weight_kg: weight, equipment_used: equipment }))
}

describe('suggestedWeight', () => {
  it('is null after a single clean workout', () => {
    expect(suggestedWeight([workout(30, [8, 8])], target)).toBeNull()
  })

  it('is the next weight, in stored kg, after two clean workouts at the same weight', () => {
    expect(suggestedWeight([workout(30, [8, 8]), workout(30, [8, 9])], target)).toBe(35)
  })
})

describe('progressionChip', () => {
  it('shows the per-side increment of a barbell stored as a total', () => {
    expect(progressionChip([workout(30, [8, 8]), workout(30, [8, 8])], target)).toEqual({
      label: '+2,5',
      description: 'Suggerito: 17,5 kg per lato, più 2,5',
    })
  })

  it('leaves a dumbbell as stored', () => {
    expect(progressionChip([workout(8, [8, 8], 'dumbbell'), workout(8, [8, 8], 'dumbbell')], target)).toEqual({
      label: '+1',
      description: 'Suggerito: 9 kg, più 1',
    })
  })

  it('is absent without a suggestion', () => {
    expect(progressionChip([workout(30, [8, 8])], target)).toBeUndefined()
    expect(progressionChip([], target)).toBeUndefined()
  })
})
