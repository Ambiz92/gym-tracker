import { afterEach, describe, expect, it } from 'vitest'
import {
  addDays,
  dayLabel,
  MAX_REPEAT_WEEKS,
  monthGrid,
  monthLabel,
  sameMonth,
  shiftMonth,
  weekDays,
  weekRange,
  weeklyDates,
} from './calendar'

const originalTz = process.env.TZ

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

const ZONES = ['Europe/Rome', 'Pacific/Auckland', 'America/Los_Angeles', 'UTC']

describe('addDays', () => {
  it('adds and subtracts days across month and year ends', () => {
    expect(addDays('2026-11-27', 1)).toBe('2026-11-28')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-11-27', 0)).toBe('2026-11-27')
  })

  it('handles the leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('steps across the Europe/Rome clock changes', () => {
    process.env.TZ = 'Europe/Rome'
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-03-25', 7)).toBe('2026-04-01')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-10-22', 7)).toBe('2026-10-29')
    expect(addDays('2026-04-01', -7)).toBe('2026-03-25')
  })

  it.each(ZONES)('is the same across a long span in %s', (zone) => {
    process.env.TZ = zone
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
    expect(addDays('2026-01-01', 200)).toBe('2026-07-20')
    expect(addDays('2026-11-17', -300)).toBe('2026-01-21')
  })

  it('rejects a malformed date', () => {
    expect(() => addDays('2026-1-5', 1)).toThrow(RangeError)
    expect(() => addDays('', 1)).toThrow(RangeError)
  })
})

describe('weekDays and weekRange', () => {
  it('runs Monday to Sunday', () => {
    expect(weekDays('2026-11-18')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
  })

  it('keeps Monday and Sunday inside their own week', () => {
    expect(weekRange('2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(weekRange('2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
  })

  it('crosses month and year boundaries', () => {
    expect(weekRange('2026-12-31')).toEqual({ from: '2026-12-28', to: '2027-01-03' })
    expect(weekRange('2026-03-01')).toEqual({ from: '2026-02-23', to: '2026-03-01' })
  })

  it('covers the weeks of the Europe/Rome clock changes', () => {
    process.env.TZ = 'Europe/Rome'
    expect(weekDays('2026-03-29')).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ])
    expect(weekRange('2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })
})

describe('monthGrid', () => {
  it('pads a month with the neighbouring days, weeks starting on Monday', () => {
    // November 2026 starts on a Sunday and ends on a Monday: 6 rows.
    const grid = monthGrid('2026-11-17')
    expect(grid).toHaveLength(6)
    expect(grid[0]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(grid[5]![0]).toBe('2026-11-30')
    expect(grid[5]![6]).toBe('2026-12-06')
  })

  it('uses four rows for a Monday-starting February of 28 days', () => {
    // February 2027 starts on a Monday.
    const grid = monthGrid('2027-02-10')
    expect(grid).toHaveLength(4)
    expect(grid[0]![0]).toBe('2027-02-01')
    expect(grid[3]![6]).toBe('2027-02-28')
  })

  it('handles the leap February', () => {
    // February 2028 starts on a Tuesday and has 29 days.
    const grid = monthGrid('2028-02-01')
    expect(grid).toHaveLength(5)
    expect(grid[0]![0]).toBe('2028-01-31')
    expect(grid.flat()).toContain('2028-02-29')
    expect(grid[4]![6]).toBe('2028-03-05')
  })

  it.each([
    ['2026-02-15', 28],
    ['2028-02-15', 29],
    ['2026-04-15', 30],
    ['2026-01-15', 31],
  ])('contains every day of the month once, in order (%s has %i days)', (date, count) => {
    const inMonth = monthGrid(date)
      .flat()
      .filter((day) => sameMonth(day, date))
    expect(inMonth).toHaveLength(count)
    expect(inMonth.map((day) => Number(day.slice(8)))).toEqual(Array.from({ length: count }, (_, i) => i + 1))
  })

  it('always has full weeks of consecutive days starting on Monday', () => {
    for (let month = 1; month <= 12; month++) {
      const grid = monthGrid(`2026-${String(month).padStart(2, '0')}-01`)
      const flat = grid.flat()
      expect(grid.every((week) => week.length === 7)).toBe(true)
      flat.forEach((day, index) => {
        if (index > 0) expect(day).toBe(addDays(flat[index - 1]!, 1))
      })
      expect(weekRange(flat[0]!).from).toBe(flat[0])
    }
  })

  it('includes the clock-change days exactly once in Europe/Rome', () => {
    process.env.TZ = 'Europe/Rome'
    const march = monthGrid('2026-03-15').flat()
    expect(march.filter((day) => day === '2026-03-29')).toHaveLength(1)
    expect(march.filter((day) => day === '2026-03-30')).toHaveLength(1)
    const october = monthGrid('2026-10-15').flat()
    expect(october.filter((day) => day === '2026-10-25')).toHaveLength(1)
    expect(october.filter((day) => day === '2026-10-26')).toHaveLength(1)
  })

  it.each(ZONES)('is identical in %s', (zone) => {
    process.env.TZ = zone
    const grid = monthGrid('2026-03-15')
    expect(grid[0]![0]).toBe('2026-02-23')
    expect(grid.flat()).toHaveLength(42)
    expect(grid[4]![6]).toBe('2026-03-29')
    expect(grid[5]![6]).toBe('2026-04-05')
  })
})

describe('shiftMonth', () => {
  it('moves to the first day of the previous and next month', () => {
    expect(shiftMonth('2026-11-17', 1)).toBe('2026-12-01')
    expect(shiftMonth('2026-11-17', -1)).toBe('2026-10-01')
  })

  it('crosses the year, even from the 31st into a shorter month', () => {
    expect(shiftMonth('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftMonth('2027-01-31', -1)).toBe('2026-12-01')
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-01')
  })

  it('moves several months', () => {
    expect(shiftMonth('2026-11-17', 14)).toBe('2028-01-01')
    expect(shiftMonth('2026-11-17', 0)).toBe('2026-11-01')
  })
})

describe('sameMonth', () => {
  it('compares year and month', () => {
    expect(sameMonth('2026-11-01', '2026-11-30')).toBe(true)
    expect(sameMonth('2026-11-30', '2026-12-01')).toBe(false)
    expect(sameMonth('2026-11-15', '2025-11-15')).toBe(false)
  })
})

describe('labels', () => {
  it('names the month and year', () => {
    expect(monthLabel('2026-11-17')).toBe('novembre 2026')
    expect(monthLabel('2027-01-01')).toBe('gennaio 2027')
    expect(monthLabel('2026-12-31')).toBe('dicembre 2026')
  })

  it('names the day with its weekday', () => {
    expect(dayLabel('2026-11-26')).toBe('giovedì 26 novembre')
    expect(dayLabel('2026-11-22')).toBe('domenica 22 novembre')
    expect(dayLabel('2026-11-16')).toBe('lunedì 16 novembre')
    expect(dayLabel('2028-02-29')).toBe('martedì 29 febbraio')
  })
})

describe('weeklyDates', () => {
  it('starts at the given date and steps a week at a time', () => {
    expect(weeklyDates('2026-11-17', 1)).toEqual(['2026-11-17'])
    expect(weeklyDates('2026-11-17', 4)).toEqual(['2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08'])
  })

  it('keeps the same weekday across both Europe/Rome clock changes', () => {
    process.env.TZ = 'Europe/Rome'
    expect(weeklyDates('2026-03-24', 3)).toEqual(['2026-03-24', '2026-03-31', '2026-04-07'])
    expect(weeklyDates('2026-10-20', 3)).toEqual(['2026-10-20', '2026-10-27', '2026-11-03'])
    expect(weeklyDates('2026-03-22', 2)).toEqual(['2026-03-22', '2026-03-29'])
  })

  it.each(ZONES)('gives the same dates in %s', (zone) => {
    process.env.TZ = zone
    expect(weeklyDates('2026-03-24', 12).at(-1)).toBe('2026-06-09')
    expect(weeklyDates('2026-10-01', 6)).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-29',
      '2026-11-05',
    ])
  })

  it('crosses the leap day and the year end', () => {
    expect(weeklyDates('2028-02-22', 2)).toEqual(['2028-02-22', '2028-02-29'])
    expect(weeklyDates('2026-12-24', 2)).toEqual(['2026-12-24', '2026-12-31'])
  })

  it('accepts up to the cap and rejects anything outside it', () => {
    expect(weeklyDates('2026-11-17', MAX_REPEAT_WEEKS)).toHaveLength(MAX_REPEAT_WEEKS)
    expect(() => weeklyDates('2026-11-17', MAX_REPEAT_WEEKS + 1)).toThrow(RangeError)
    expect(() => weeklyDates('2026-11-17', 0)).toThrow(RangeError)
    expect(() => weeklyDates('2026-11-17', -2)).toThrow(RangeError)
    expect(() => weeklyDates('2026-11-17', 2.5)).toThrow(RangeError)
  })
})
