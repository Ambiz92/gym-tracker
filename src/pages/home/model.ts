import { addDays } from '../../lib/calendar'
import type { SlotView } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'

/** How far back Oggi looks for overdue slots; older ones stay reachable from the calendar. */
export const OVERDUE_LOOKBACK_DAYS = 60

/** First day Oggi reads slots from. */
export const lookbackStart = (today: string): string => addDays(today, -OVERDUE_LOOKBACK_DAYS)

export interface TodayBlock {
  today: SlotView<ScheduledSession>[]
  /** "Da recuperare", oldest first (the input order). */
  overdue: SlotView<ScheduledSession>[]
}

/** The slots Oggi shows: what is still to do today and what is overdue; done and skipped ones are history. */
export function todayBlock(views: readonly SlotView<ScheduledSession>[], today: string): TodayBlock {
  return {
    today: views.filter(({ slot, state }) => state === 'upcoming' && slot.date === today),
    overdue: views.filter(({ state }) => state === 'to_recover'),
  }
}
