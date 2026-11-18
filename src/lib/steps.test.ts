import { describe, expect, it } from 'vitest'
import { addStep, joinSteps, removeStep, setStep, splitSteps } from './steps'

describe('splitSteps / joinSteps', () => {
  it('round-trips one step per line', () => {
    expect(splitSteps('Stacca\nSpingi\nControlla')).toEqual(['Stacca', 'Spingi', 'Controlla'])
    expect(joinSteps(['Stacca', 'Spingi'])).toBe('Stacca\nSpingi')
  })

  it('trims lines and drops blank ones', () => {
    expect(splitSteps('  uno \n\n   \ndue')).toEqual(['uno', 'due'])
    expect(joinSteps(['  uno ', '', '   ', 'due'])).toBe('uno\ndue')
  })

  it('treats null, empty and blank-only as no steps', () => {
    expect(splitSteps(null)).toEqual([])
    expect(splitSteps('')).toEqual([])
    expect(joinSteps([])).toBeNull()
    expect(joinSteps(['', '  '])).toBeNull()
  })
})

describe('step list edits', () => {
  it('sets one step without touching the input', () => {
    const steps = ['a', 'b']
    expect(setStep(steps, 1, 'x')).toEqual(['a', 'x'])
    expect(steps).toEqual(['a', 'b'])
  })

  it('appends an empty step', () => {
    expect(addStep(['a'])).toEqual(['a', ''])
    expect(addStep([])).toEqual([''])
  })

  it('removes the step at the index', () => {
    expect(removeStep(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })
})
