import { addDays, dayLabel, monthGrid, monthLabel, sameMonth, shiftMonth, weekDays } from '../../lib/calendar'
import { dayMonthName } from '../../lib/formatDate'
import type { SlotState, SlotView } from '../../lib/scheduleStatus'

export type CalendarView = 'month' | 'week'

/** Day-cell states in the order they are spelled out; the plural applies from two slots on. */
const STATE_WORDS: readonly { state: SlotState; one: string; many: string }[] = [
  { state: 'upcoming', one: 'in programma', many: 'in programma' },
  { state: 'to_recover', one: 'da recuperare', many: 'da recuperare' },
  { state: 'done', one: 'fatta', many: 'fatte' },
  { state: 'skipped', one: 'saltata', many: 'saltate' },
]

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
const MONTH_STEPS: Readonly<Record<string, number>> = { PageUp: -1, PageDown: 1 }

/** Weeks shown for `selected`: the whole month grid, or just its week. */
export function gridWeeks(view: CalendarView, selected: string): string[][] {
  return view === 'month' ? monthGrid(selected) : [weekDays(selected)]
}

/** First and last day shown, the range to load (neighbouring-month padding days included). */
export function visibleRange(weeks: readonly string[][]): { from: string; to: string } {
  return { from: weeks[0]![0]!, to: weeks[weeks.length - 1]![6]! }
}

/** Heading of the visible period: "novembre 2026" or "16 nov – 22 nov". */
export function periodLabel(view: CalendarView, selected: string): string {
  if (view === 'month') return monthLabel(selected)
  const days = weekDays(selected)
  return `${dayMonthName(days[0]!)} – ${dayMonthName(days[6]!)}`
}

/** Previous (-1) or next (+1) month or week; landing on the period of `today` selects today itself. */
export function shiftPeriod(view: CalendarView, selected: string, direction: -1 | 1, today: string): string {
  const target = view === 'month' ? shiftMonth(selected, direction) : addDays(selected, 7 * direction)
  const containsToday = view === 'month' ? sameMonth(target, today) : weekDays(target).includes(today)
  return containsToday ? today : target
}

/** Same day of the month `months` away, or its last day when that month is shorter. */
function sameDayInMonth(date: string, months: number): string {
  const first = shiftMonth(date, months)
  const lastDay = Number(addDays(shiftMonth(date, months + 1), -1).slice(8))
  return `${first.slice(0, 8)}${String(Math.min(Number(date.slice(8)), lastDay)).padStart(2, '0')}`
}

/**
 * The day a key moves the selection to: arrows by a day or a week, PageUp/PageDown by a month, Home/End to
 * the Monday/Sunday of the week; null for any other key.
 */
export function keyTarget(date: string, key: string): string | null {
  const step = ARROW_STEPS[key]
  if (step !== undefined) return addDays(date, step)
  const months = MONTH_STEPS[key]
  if (months !== undefined) return sameDayInMonth(date, months)
  if (key === 'Home') return weekDays(date)[0]!
  if (key === 'End') return weekDays(date)[6]!
  return null
}

/** "fatta", "da recuperare": the label of one slot's state. */
export function stateLabel(state: SlotState): string {
  return STATE_WORDS.find((words) => words.state === state)!.one
}

/** True for a slot still to do whose session is archived or gone: greyed out, not startable. */
export function isArchived({ state, startable }: SlotView): boolean {
  return !startable && (state === 'upcoming' || state === 'to_recover')
}

/** Accessible name of a day cell: "giovedì 27 novembre, 1 sessione, fatta". */
export function dayAriaLabel(date: string, views: readonly SlotView[] = []): string {
  const day = dayLabel(date)
  if (views.length === 0) return `${day}, nessuna sessione`
  if (views.length === 1) return `${day}, 1 sessione, ${stateLabel(views[0]!.state)}`

  const counts = STATE_WORDS.flatMap(({ state, one, many }) => {
    const count = views.filter((view) => view.state === state).length
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`]
  })
  return `${day}, ${views.length} sessioni: ${counts.join(', ')}`
}

export interface SlotActions {
  move: boolean
  skip: boolean
  remove: boolean
}

/**
 * Which actions a slot offers. Done and skipped slots are history and offer none; an overdue one
 * can be moved to today or skipped, never deleted; only one still to come can be deleted.
 */
export function slotActions({ slot, state }: SlotView, today: string): SlotActions {
  if (state === 'upcoming') return { move: slot.date !== today, skip: true, remove: true }
  if (state === 'to_recover') return { move: true, skip: true, remove: false }
  return { move: false, skip: false, remove: false }
}
