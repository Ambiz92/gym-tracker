import { describe, expect, it } from 'vitest'
import { isLongFigure } from './figureFit'

describe('isLongFigure', () => {
  it('keeps full size for the values a set usually has', () => {
    for (const text of ['0', '8', '62,5', '100', '999', '1000']) expect(isLongFigure(text)).toBe(false)
  })

  it('shrinks the values that would not fit next to their unit', () => {
    for (const text of ['100,25', '999,99', '12345']) expect(isLongFigure(text)).toBe(true)
  })

  it('counts a separator as half a digit, in either decimal mark', () => {
    expect(isLongFigure('10,5')).toBe(false)
    expect(isLongFigure('10.5')).toBe(false)
    expect(isLongFigure('100,5')).toBe(true)
    expect(isLongFigure('100.5')).toBe(true)
  })

  it('judges text being typed the same way', () => {
    expect(isLongFigure('')).toBe(false)
    expect(isLongFigure('1000,')).toBe(true)
  })
})
