import { describe, expect, it } from 'vitest'
import { MAX_KG_PER_SIDE, MAX_WEIGHT_KG, maxWeightKg, parseDecimal, repsWarning, weightStep } from './validation'

describe('repsWarning', () => {
  it('warns above 10 reps', () => {
    expect(repsWarning(11, 'reps')).toBe('Sopra le 10 ripetizioni')
    expect(repsWarning(30, 'reps')).toBe('Sopra le 10 ripetizioni')
  })

  it('does not warn at or below 10 reps', () => {
    expect(repsWarning(10, 'reps')).toBeNull()
    expect(repsWarning(1, 'reps')).toBeNull()
    expect(repsWarning(0, 'reps')).toBeNull()
  })

  it('never warns for seconds and meters', () => {
    expect(repsWarning(60, 'seconds')).toBeNull()
    expect(repsWarning(40, 'meters')).toBeNull()
  })
})

describe('parseDecimal', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseDecimal('27,5')).toBe(27.5)
    expect(parseDecimal('27.5')).toBe(27.5)
  })

  it('accepts integers, zero and a missing leading zero', () => {
    expect(parseDecimal('8')).toBe(8)
    expect(parseDecimal('0')).toBe(0)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('.5')).toBe(0.5)
  })

  it('trims surrounding whitespace', () => {
    expect(parseDecimal('  12,5 ')).toBe(12.5)
  })

  it('returns null for invalid input', () => {
    for (const text of ['', '  ', 'abc', '12a', '1.2.3', '1,2,3', '1,2.3', '-5', '+5', '27,', '1e3', 'NaN', 'Infinity', '1 2']) {
      expect(parseDecimal(text), text).toBeNull()
    }
  })
})

describe('weightStep', () => {
  it('is 1.25 kg (the smallest plate) for barbell and 1 kg otherwise', () => {
    expect(weightStep('barbell')).toBe(1.25)
    expect(weightStep('dumbbell')).toBe(1)
    expect(weightStep('other')).toBe(1)
  })
})

describe('maxWeightKg', () => {
  it('limits a barbell to the load of one side', () => {
    expect(maxWeightKg('barbell')).toBe(MAX_KG_PER_SIDE)
    expect(MAX_KG_PER_SIDE).toBe(500)
  })

  it('leaves the other equipment at the general maximum', () => {
    expect(maxWeightKg('dumbbell')).toBe(MAX_WEIGHT_KG)
    expect(maxWeightKg('other')).toBe(MAX_WEIGHT_KG)
  })
})
