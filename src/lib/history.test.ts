import { describe, expect, it } from 'vitest'
import { buildHistory } from './history'

const set = (date: string, weight_kg: number) => ({ date, weight_kg })

describe('buildHistory', () => {
  it('handles empty input', () => {
    expect(buildHistory([])).toEqual({ points: [], startingWeightKg: null, lastWeightKg: null, variationPct: null })
  })

  it('keeps the exercise starting weight when there is no history', () => {
    expect(buildHistory([], 15).startingWeightKg).toBe(15)
  })

  it('handles a single week', () => {
    const history = buildHistory([set('2026-11-17', 15), set('2026-11-19', 17.5)])
    expect(history.points).toEqual([{ week: 1, weekStart: '2026-11-16', maxWeightKg: 17.5 }])
    expect(history.lastWeightKg).toBe(17.5)
    expect(history.variationPct).toBe(0)
  })

  it('takes the max weight per week and numbers weeks from the first logged one', () => {
    const history = buildHistory([
      set('2026-11-03', 15),
      set('2026-11-05', 15),
      set('2026-11-10', 17.5),
      set('2026-11-12', 15),
      set('2026-11-24', 20),
    ])
    expect(history.points).toEqual([
      { week: 1, weekStart: '2026-11-02', maxWeightKg: 15 },
      { week: 2, weekStart: '2026-11-09', maxWeightKg: 17.5 },
      { week: 4, weekStart: '2026-11-23', maxWeightKg: 20 },
    ])
  })

  it('computes the percentage variation versus the first week', () => {
    const history = buildHistory([set('2026-11-03', 20), set('2026-11-10', 25)])
    expect(history.lastWeightKg).toBe(25)
    expect(history.variationPct).toBe(25)
  })

  it('reports a negative variation and rounds to one decimal', () => {
    expect(buildHistory([set('2026-11-03', 30), set('2026-11-10', 20)]).variationPct).toBe(-33.3)
  })

  it('uses the first week max as starting weight when the exercise has none', () => {
    const history = buildHistory([set('2026-11-03', 12), set('2026-11-04', 15), set('2026-11-10', 20)])
    expect(history.startingWeightKg).toBe(15)
  })

  it('prefers the exercise starting weight', () => {
    const history = buildHistory([set('2026-11-03', 20), set('2026-11-10', 25)], 12.5)
    expect(history.startingWeightKg).toBe(12.5)
    expect(history.variationPct).toBe(25)
  })

  it('has no variation when the first week max is 0', () => {
    expect(buildHistory([set('2026-11-03', 0), set('2026-11-10', 5)]).variationPct).toBeNull()
  })

  it('does not depend on input order', () => {
    const history = buildHistory([set('2026-11-24', 20), set('2026-11-03', 15), set('2026-11-10', 17.5)])
    expect(history.points.map((point) => point.week)).toEqual([1, 2, 4])
    expect(history.lastWeightKg).toBe(20)
  })

  describe('week boundaries', () => {
    it('puts Sunday in the same week as the preceding Monday', () => {
      // 2026-11-15 is a Sunday, 2026-11-16 a Monday
      const history = buildHistory([set('2026-11-15', 10), set('2026-11-16', 12)])
      expect(history.points).toEqual([
        { week: 1, weekStart: '2026-11-09', maxWeightKg: 10 },
        { week: 2, weekStart: '2026-11-16', maxWeightKg: 12 },
      ])
    })

    it('groups Monday to Sunday together', () => {
      const history = buildHistory([set('2026-11-16', 10), set('2026-11-22', 12)])
      expect(history.points).toEqual([{ week: 1, weekStart: '2026-11-16', maxWeightKg: 12 }])
    })

    it('handles a year change inside one week', () => {
      // 2026-12-31 is a Thursday, 2027-01-03 a Sunday: same ISO week
      const history = buildHistory([set('2026-12-31', 10), set('2027-01-03', 12)])
      expect(history.points).toEqual([{ week: 1, weekStart: '2026-12-28', maxWeightKg: 12 }])
    })

    it('numbers weeks across a year change', () => {
      const history = buildHistory([set('2026-12-28', 10), set('2027-01-04', 12), set('2027-01-11', 14)])
      expect(history.points.map((point) => [point.week, point.weekStart])).toEqual([
        [1, '2026-12-28'],
        [2, '2027-01-04'],
        [3, '2027-01-11'],
      ])
    })

    it('handles leap days', () => {
      const history = buildHistory([set('2028-02-29', 10), set('2028-03-06', 12)])
      expect(history.points.map((point) => point.weekStart)).toEqual(['2028-02-28', '2028-03-06'])
    })

    it('is not affected by daylight saving changes', () => {
      // Europe/Rome switches to summer time on 2027-03-28
      const history = buildHistory([set('2027-03-22', 10), set('2027-03-29', 12), set('2027-04-05', 14)])
      expect(history.points.map((point) => point.week)).toEqual([1, 2, 3])
    })
  })

  describe('invalid dates', () => {
    it('rejects malformed strings', () => {
      expect(() => buildHistory([set('17/11/2026', 10)])).toThrow('Invalid date')
      expect(() => buildHistory([set('2026-11-17T10:00:00Z', 10)])).toThrow('Invalid date')
    })

    it('rejects dates that do not exist', () => {
      expect(() => buildHistory([set('2026-02-30', 10)])).toThrow('Invalid date')
      expect(() => buildHistory([set('2026-13-01', 10)])).toThrow('Invalid date')
    })
  })
})
