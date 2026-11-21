import { expect, test } from 'vitest'
import { sessionPath, slotStartPath, summaryPath } from './paths'

test('the session route opens the list, or the logger of one exercise', () => {
  expect(sessionPath('s1')).toBe('/session/s1')
  expect(sessionPath('s1', 'e 1')).toBe('/session/s1?es=e%201')
  expect(summaryPath('s1')).toBe('/session/s1?fine=1')
})

test('starting from a slot carries the slot id and nothing else', () => {
  expect(slotStartPath('s1', 'slot-9')).toBe('/session/s1?slot=slot-9')
  expect(slotStartPath('s1', 'a&b')).toBe('/session/s1?slot=a%26b')
})
