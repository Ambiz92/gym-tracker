import { expect, it } from 'vitest'
import { dayMonth, dayMonthName, weekdayDayMonth } from './formatDate'

it('shortens an ISO date to day and month', () => {
  expect(dayMonth('2026-11-03')).toBe('03.11')
})

it('names the weekday of a local date', () => {
  expect(weekdayDayMonth(new Date(2026, 10, 17))).toBe('Mar 17.11')
  expect(weekdayDayMonth(new Date(2026, 0, 4))).toBe('Dom 04.01')
})

it('spells the month out in Italian, without a leading zero on the day', () => {
  expect(dayMonthName('2026-11-13')).toBe('13 nov')
  expect(dayMonthName('2026-01-03')).toBe('3 gen')
})
