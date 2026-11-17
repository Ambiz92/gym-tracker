import { afterEach, describe, expect, it } from 'vitest'
import { localDateString } from './localDate'

const originalTz = process.env.TZ

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

describe('localDateString', () => {
  it('formats the local date with zero padding', () => {
    expect(localDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(localDateString(new Date(2026, 10, 17, 12))).toBe('2026-11-17')
  })

  it('stays on the same day at the edges of the local day', () => {
    expect(localDateString(new Date(2026, 10, 17, 0, 0, 0))).toBe('2026-11-17')
    expect(localDateString(new Date(2026, 10, 17, 23, 59, 59, 999))).toBe('2026-11-17')
  })

  it('rolls over at local midnight, across month and year ends', () => {
    expect(localDateString(new Date(2026, 10, 17, 24, 0, 0))).toBe('2026-11-18')
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
    expect(localDateString(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01')
  })

  it('uses the local day in a zone ahead of UTC (toISOString would give the previous day)', () => {
    process.env.TZ = 'Pacific/Auckland'
    const justAfterLocalMidnight = new Date(2026, 10, 17, 0, 30)
    expect(justAfterLocalMidnight.toISOString().slice(0, 10)).toBe('2026-11-16')
    expect(localDateString(justAfterLocalMidnight)).toBe('2026-11-17')
  })

  it('uses the local day in a zone behind UTC (toISOString would give the next day)', () => {
    process.env.TZ = 'America/Los_Angeles'
    const lateEvening = new Date(2026, 10, 17, 22, 30)
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-11-18')
    expect(localDateString(lateEvening)).toBe('2026-11-17')
  })
})
