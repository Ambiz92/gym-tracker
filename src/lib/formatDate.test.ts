import { expect, it } from 'vitest'
import { dayMonth, weekdayDayMonth } from './formatDate'

it('shortens an ISO date to day and month', () => {
  expect(dayMonth('2026-11-03')).toBe('03.11')
})

it('names the weekday of a local date', () => {
  expect(weekdayDayMonth(new Date(2026, 10, 17))).toBe('Mar 17.11')
  expect(weekdayDayMonth(new Date(2026, 0, 4))).toBe('Dom 04.01')
})
