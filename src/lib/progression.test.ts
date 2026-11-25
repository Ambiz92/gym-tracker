import { describe, expect, it } from 'vitest'
import type { LastSet } from '../types/db'
import {
  BARBELL_INCREMENT_KG,
  CLEAN_WORKOUTS_REQUIRED,
  DUMBBELL_HEAVY_INCREMENT_KG,
  DUMBBELL_HEAVY_THRESHOLD_KG,
  DUMBBELL_LIGHT_INCREMENT_KG,
  suggestNextWeight,
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
    expect(CLEAN_WORKOUTS_REQUIRED).toBe(2)
    expect(BARBELL_INCREMENT_KG).toBe(2.5)
    expect(DUMBBELL_HEAVY_THRESHOLD_KG).toBe(10)
    expect(DUMBBELL_HEAVY_INCREMENT_KG).toBe(2)
    expect(DUMBBELL_LIGHT_INCREMENT_KG).toBe(1)
  })
})

/** Two clean workouts at the same load, newest first: the minimal input that fires the rule. */
function twoClean(equipment: LastSet['equipment_used'], weight: number, reps = [8, 8, 8]): LastSet[][] {
  return [sets(equipment, weight, reps), sets(equipment, weight, reps)]
}

describe('suggestNextWeight', () => {
  it('never suggests on the first workout', () => {
    const hint = suggestNextWeight([], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Primo allenamento: nessun suggerimento')
  })

  it('does not suggest after a single clean workout', () => {
    const hint = suggestNextWeight([sets('barbell', 30, [8, 8, 8])], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ancora un allenamento pulito a questo peso prima di aumentare')
  })

  it('adds 2.5 kg per side, so 5 stored kg, after two clean barbell workouts at the same weight', () => {
    const hint = suggestNextWeight(twoClean('barbell', 30), target)
    expect(hint.suggested).toBe(35)
    expect(hint.reason).toContain('+2,5 kg per lato')
  })

  it('does not suggest when the two clean workouts used different weights', () => {
    const hint = suggestNextWeight([sets('barbell', 35, [8, 8, 8]), sets('barbell', 30, [8, 8, 8])], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ancora un allenamento pulito a questo peso prima di aumentare')
  })

  it('does not suggest when the two clean workouts used different equipment', () => {
    const hint = suggestNextWeight([sets('barbell', 30, [8, 8, 8]), sets('dumbbell', 15, [8, 8, 8])], target)
    expect(hint.suggested).toBeNull()
  })

  it('does not suggest when the latest workout is clean but the one before is not', () => {
    const hint = suggestNextWeight([sets('barbell', 30, [8, 8, 8]), sets('barbell', 30, [8, 8, 7])], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ancora un allenamento pulito a questo peso prima di aumentare')
  })

  it('asks to repeat the weight when the latest workout is not clean, even after a clean one', () => {
    const hint = suggestNextWeight([sets('barbell', 30, [8, 8, 7]), sets('barbell', 30, [8, 8, 8])], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ripeti questo peso')
  })

  it('treats reps above the target as clean', () => {
    expect(suggestNextWeight(twoClean('barbell', 40, [10, 9, 8]), target).suggested).toBe(45)
  })

  it('adds 1 kg for dumbbells below 10 kg', () => {
    expect(suggestNextWeight(twoClean('dumbbell', 8), target).suggested).toBe(9)
    expect(suggestNextWeight(twoClean('dumbbell', 9.5), target).suggested).toBe(10.5)
  })

  it('adds 2 kg for dumbbells from 10 kg', () => {
    expect(suggestNextWeight(twoClean('dumbbell', 10), target).suggested).toBe(12)
    expect(suggestNextWeight(twoClean('dumbbell', 14), target).suggested).toBe(16)
  })

  it('suggests nothing for other equipment', () => {
    const hint = suggestNextWeight(twoClean('other', 15), target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Nessun incremento previsto per questo attrezzo')
  })

  it('suggests nothing when the latest workout is partial', () => {
    const hint = suggestNextWeight([sets('barbell', 30, [8, 8]), sets('barbell', 30, [8, 8, 8])], target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ripeti questo peso')
  })

  it('suggests nothing when the previous workout is partial', () => {
    expect(suggestNextWeight([sets('barbell', 30, [8, 8, 8]), sets('barbell', 30, [8, 8])], target).suggested).toBeNull()
  })

  it('suggests nothing when a set in the middle is missing', () => {
    const [first, , third] = sets('barbell', 30, [8, 8, 8])
    expect(suggestNextWeight([[first!, third!], sets('barbell', 30, [8, 8, 8])], target).suggested).toBeNull()
  })

  it('suggests nothing when a workout mixes weights', () => {
    const mixed = [...sets('barbell', 30, [8, 8]), ...sets('barbell', 25, [8]).map((set) => ({ ...set, set_number: 3 }))]
    expect(suggestNextWeight([mixed, sets('barbell', 30, [8, 8, 8])], target).suggested).toBeNull()
  })

  it('suggests nothing when a workout mixes equipment', () => {
    const mixed = sets('barbell', 30, [8, 8, 8])
    mixed[2] = { ...mixed[2]!, equipment_used: 'dumbbell' }
    expect(suggestNextWeight([mixed, sets('barbell', 30, [8, 8, 8])], target).suggested).toBeNull()
  })

  it('keeps suggesting through a longer streak', () => {
    const streak = [...twoClean('barbell', 30), sets('barbell', 30, [8, 8, 8])]
    expect(suggestNextWeight(streak, target).suggested).toBe(35)
  })

  it('keeps the suggestion when the previous one was not followed', () => {
    const stayed = [sets('barbell', 30, [9, 8, 8]), sets('barbell', 30, [8, 8, 8]), sets('barbell', 30, [8, 8, 8])]
    expect(suggestNextWeight(stayed, target).suggested).toBe(35)
  })

  it('waits for two clean workouts at the new weight after an increase', () => {
    const wentUpMissed = [sets('barbell', 35, [8, 8, 6]), ...twoClean('barbell', 30)]
    expect(suggestNextWeight(wentUpMissed, target).suggested).toBeNull()

    const wentUpClean = [sets('barbell', 35, [8, 8, 8]), ...twoClean('barbell', 30)]
    expect(suggestNextWeight(wentUpClean, target).suggested).toBeNull()
  })

  it('never suggests a decrease', () => {
    const wentDown = [sets('barbell', 25, [8, 8, 5]), sets('barbell', 30, [8, 8, 8])]
    const hint = suggestNextWeight(wentDown, target)
    expect(hint.suggested).toBeNull()
    expect(hint.reason).toBe('Ripeti questo peso')
  })

  it('ignores logged sets beyond the target', () => {
    const extra = [...sets('barbell', 30, [8, 8, 8]), { set_number: 4, reps: 3, weight_kg: 20, equipment_used: 'barbell' as const }]
    expect(suggestNextWeight([extra, extra], target).suggested).toBe(35)
  })

  it('does not depend on the order of the sets within a workout', () => {
    const shuffled = sets('barbell', 30, [8, 8, 8]).reverse()
    expect(suggestNextWeight([shuffled, sets('barbell', 30, [8, 8, 8])], target).suggested).toBe(35)
  })

  it('compares seconds and meters against the target value', () => {
    const timed = { target_sets: 2, target_reps: 40 }
    expect(suggestNextWeight(twoClean('dumbbell', 20, [40, 45]), timed).suggested).toBe(22)
    expect(suggestNextWeight(twoClean('dumbbell', 20, [40, 35]), timed).suggested).toBeNull()
  })

  it('avoids floating point noise', () => {
    expect(suggestNextWeight(twoClean('dumbbell', 9.1), target).suggested).toBe(10.1)
  })
})
