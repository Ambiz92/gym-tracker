import { localDateString } from './localDate'

/** Upper bound of "repeat for N weeks". */
export const MAX_REPEAT_WEEKS = 12

/** Monday first, matching the calendar grid. */
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const
const WEEKDAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'] as const
const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// Dates are local calendar days as YYYY-MM-DD strings; the Date built here is only a calculator.
function toDate(date: string): Date {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`Invalid date: ${date}`)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Adds (or subtracts) whole calendar days. The date rolls over in local fields, so daylight saving cannot skew it. */
export function addDays(date: string, days: number): string {
  const day = toDate(date)
  return localDateString(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days))
}

/** 0 for Monday to 6 for Sunday. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** The seven days (Monday to Sunday) of the week containing `date`. */
export function weekDays(date: string): string[] {
  const monday = addDays(date, -weekdayIndex(toDate(date)))
  return Array.from({ length: 7 }, (_, offset) => addDays(monday, offset))
}

/** First (Monday) and last (Sunday) day of the week containing `date`. */
export function weekRange(date: string): { from: string; to: string } {
  const days = weekDays(date)
  return { from: days[0]!, to: days[6]! }
}

/** Month grid as full Monday-to-Sunday weeks; days of the neighbouring months pad the first and last row. */
export function monthGrid(date: string): string[][] {
  const first = toDate(date)
  const year = first.getFullYear()
  const month = first.getMonth()
  const lead = weekdayIndex(new Date(year, month, 1))
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const start = localDateString(new Date(year, month, 1 - lead))
  const weeks = Math.ceil((lead + daysInMonth) / 7)
  return Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)))
}

/** First day of the month `months` away from the one containing `date` (negative for earlier). */
export function shiftMonth(date: string, months: number): string {
  const day = toDate(date)
  return localDateString(new Date(day.getFullYear(), day.getMonth() + months, 1))
}

/** True when both dates fall in the same month and year. */
export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** "novembre 2026". */
export function monthLabel(date: string): string {
  const day = toDate(date)
  return `${MONTH_NAMES[day.getMonth()]} ${day.getFullYear()}`
}

/** "giovedì 27 novembre", for accessible names. */
export function dayLabel(date: string): string {
  const day = toDate(date)
  return `${WEEKDAY_NAMES[weekdayIndex(day)]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`
}

/** `weeks` consecutive weekly dates starting at `start`, for "repeat for N weeks" (the start itself included). */
export function weeklyDates(start: string, weeks: number): string[] {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_REPEAT_WEEKS) {
    throw new RangeError(`Weeks must be an integer between 1 and ${MAX_REPEAT_WEEKS}, got ${weeks}`)
  }
  return Array.from({ length: weeks }, (_, week) => addDays(start, week * 7))
}
