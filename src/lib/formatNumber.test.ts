import { expect, it } from 'vitest'
import { formatNumber } from './formatNumber'

it('uses a comma for decimals and drops trailing zeros', () => {
  expect(formatNumber(12.5)).toBe('12,5')
  expect(formatNumber(15)).toBe('15')
  expect(formatNumber(2.25)).toBe('2,25')
})

it('does not group thousands', () => {
  expect(formatNumber(1200)).toBe('1200')
})
