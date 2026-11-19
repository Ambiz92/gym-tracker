import { describe, expect, it } from 'vitest'
import { snapToStep, valueAfterKey } from './slider'

describe('slider helpers', () => {
  const range = { min: 5, max: 55, step: 5 }

  it('snaps to the step inside the range', () => {
    expect(snapToStep(22, range)).toBe(20)
    expect(snapToStep(-10, range)).toBe(5)
    expect(snapToStep(300, range)).toBe(55)
  })

  it('moves by one step with the arrows and jumps with Home and End', () => {
    expect(valueAfterKey('ArrowRight', 25, range, false)).toBe(30)
    expect(valueAfterKey('ArrowLeft', 25, range, false)).toBe(20)
    expect(valueAfterKey('Home', 25, range, false)).toBe(5)
    expect(valueAfterKey('End', 25, range, false)).toBe(55)
  })

  it('stays inside the range', () => {
    expect(valueAfterKey('ArrowLeft', 5, range, false)).toBe(5)
    expect(valueAfterKey('ArrowRight', 55, range, false)).toBe(55)
  })

  it('treats up as increasing, or down on a stack where the pin moves down with the load', () => {
    expect(valueAfterKey('ArrowUp', 25, range, false)).toBe(30)
    expect(valueAfterKey('ArrowDown', 25, range, false)).toBe(20)
    expect(valueAfterKey('ArrowDown', 25, range, true)).toBe(30)
    expect(valueAfterKey('ArrowUp', 25, range, true)).toBe(20)
  })

  it('ignores other keys', () => {
    expect(valueAfterKey('Enter', 25, range, false)).toBeNull()
    expect(valueAfterKey('toString', 25, range, false)).toBeNull()
  })
})
