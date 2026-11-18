import { describe, expect, it } from 'vitest'
import type { LastSet, PlanExercise } from '../../types/db'
import { progressionChip, suggestedWeight } from './hints'

const target = { target_sets: 2, target_reps: 8 } as PlanExercise

function workout(weight: number, reps: number[]): LastSet[] {
  return reps.map((count, index) => ({ set_number: index + 1, reps: count, weight_kg: weight, equipment_used: 'barbell' }))
}

describe('suggestedWeight', () => {
  it('is null after a single clean workout', () => {
    expect(suggestedWeight([workout(15, [8, 8])], target)).toBeNull()
  })

  it('is the next weight after two clean workouts at the same weight', () => {
    expect(suggestedWeight([workout(15, [8, 8]), workout(15, [8, 9])], target)).toBe(17.5)
  })
})

describe('progressionChip', () => {
  it('shows the increment over the latest workout', () => {
    expect(progressionChip([workout(15, [8, 8]), workout(15, [8, 8])], target)).toEqual({
      label: '+2,5',
      description: 'Suggerito: 17,5 kg, più 2,5',
    })
  })

  it('is absent without a suggestion', () => {
    expect(progressionChip([workout(15, [8, 8])], target)).toBeUndefined()
    expect(progressionChip([], target)).toBeUndefined()
  })
})
