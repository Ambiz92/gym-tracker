import { describe, expect, it } from 'vitest'
import {
  BARBELL_INCREMENT_KG,
  DUMBBELL_HEAVY_INCREMENT_KG,
  DUMBBELL_HEAVY_THRESHOLD_KG,
  DUMBBELL_LIGHT_INCREMENT_KG,
  suggestNextWeight,
  type LastSet,
} from './progression'

const target = { target_sets: 3, target_reps: 8 }

function sets(equipment: LastSet['equipment_used'], weight: number, reps: number[]): LastSet[] {
  return reps.map((count, index) => ({
    set_number: index + 1,
    reps: count,
    weight_kg: weight,
    equipment_used: equipment,
  }))
}

describe('increment constants', () => {
  it('keep the documented values', () => {
    expect(BARBELL_INCREMENT_KG).toBe(2.5)
    expect(DUMBBELL_HEAVY_THRESHOLD_KG).toBe(10)
    expect(DUMBBELL_HEAVY_INCREMENT_KG).toBe(2)
    expect(DUMBBELL_LIGHT_INCREMENT_KG).toBe(1)
  })
})

describe('suggestNextWeight', () => {
  it('never suggests on the first workout', () => {
    const hint = suggestNextWeight([], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Primo allenamento: nessun suggerimento')
  })

  it('adds 2.5 kg for a clean barbell workout', () => {
    const hint = suggestNextWeight(sets('barbell', 15, [8, 8, 8]), target)
    expect(hint.suggested).toBe(17.5)
    expect(hint.reason).toContain('+2,5 kg')
  })

  it('treats reps above the target as clean', () => {
    expect(suggestNextWeight(sets('barbell', 20, [10, 9, 8]), target).suggested).toBe(22.5)
  })

  it('adds 1 kg for dumbbells below 10 kg', () => {
    expect(suggestNextWeight(sets('dumbbell', 8, [8, 8, 8]), target).suggested).toBe(9)
    expect(suggestNextWeight(sets('dumbbell', 9.5, [8, 8, 8]), target).suggested).toBe(10.5)
  })

  it('adds 2 kg for dumbbells from 10 kg', () => {
    expect(suggestNextWeight(sets('dumbbell', 10, [8, 8, 8]), target).suggested).toBe(12)
    expect(suggestNextWeight(sets('dumbbell', 14, [8, 8, 8]), target).suggested).toBe(16)
  })

  it('suggests nothing for other equipment', () => {
    const hint = suggestNextWeight(sets('other', 15, [8, 8, 8]), target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Nessun incremento previsto per questo attrezzo')
  })

  it('suggests nothing when a set is below the target reps', () => {
    const hint = suggestNextWeight(sets('barbell', 15, [8, 8, 7]), target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ultima volta non tutte le serie completate')
  })

  it('suggests nothing when sets are missing (partial workout)', () => {
    expect(suggestNextWeight(sets('barbell', 15, [8, 8]), target).suggested).toBeNull()
  })

  it('suggests nothing when a set in the middle is missing', () => {
    const [first, , third] = sets('barbell', 15, [8, 8, 8])
    expect(suggestNextWeight([first!, third!], target).suggested).toBeNull()
  })

  it('suggests nothing when the sets used different weights', () => {
    const mixed = [...sets('barbell', 15, [8, 8]), ...sets('barbell', 12.5, [8]).map((set) => ({ ...set, set_number: 3 }))]
    const hint = suggestNextWeight(mixed, target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ultima volta serie con pesi o attrezzi diversi')
  })

  it('suggests nothing when the sets used different equipment', () => {
    const mixed = sets('barbell', 15, [8, 8, 8])
    mixed[2] = { ...mixed[2]!, equipment_used: 'dumbbell' }
    expect(suggestNextWeight(mixed, target).suggested).toBeNull()
  })

  it('ignores logged sets beyond the target', () => {
    const extra = [...sets('barbell', 15, [8, 8, 8]), { set_number: 4, reps: 3, weight_kg: 10, equipment_used: 'barbell' as const }]
    expect(suggestNextWeight(extra, target).suggested).toBe(17.5)
  })

  it('does not depend on input order', () => {
    const shuffled = sets('barbell', 15, [8, 8, 8]).reverse()
    expect(suggestNextWeight(shuffled, target).suggested).toBe(17.5)
  })

  it('compares seconds and meters against the target value', () => {
    const timed = { target_sets: 2, target_reps: 40 }
    expect(suggestNextWeight(sets('dumbbell', 20, [40, 45]), timed).suggested).toBe(22)
    expect(suggestNextWeight(sets('dumbbell', 20, [40, 35]), timed).suggested).toBeNull()
  })

  it('avoids floating point noise', () => {
    expect(suggestNextWeight(sets('dumbbell', 9.1, [8, 8, 8]), target).suggested).toBe(10.1)
  })
})
