import type { ScheduledSession, Workout } from '../types/db'

/** What the calendar shows for a slot: "to_recover" is a past `planned` slot without a workout. */
export type SlotState = 'upcoming' | 'to_recover' | 'done' | 'skipped'

/** Dot of a day cell: full = done, empty = still to do, struck = skipped. */
export type DotKind = 'full' | 'empty' | 'struck'

export type SlotRow = Pick<ScheduledSession, 'id' | 'date' | 'status' | 'plan_session_id'>

export interface SlotView<Slot extends SlotRow = SlotRow> {
  slot: Slot
  state: SlotState
  /** False when the session is archived or deleted: shown greyed out, without a start button. */
  startable: boolean
}

export interface DayGroup<Slot extends SlotRow = SlotRow> {
  views: SlotView<Slot>[]
  dot: DotKind
}

export interface ScheduleContext {
  /** Local date, YYYY-MM-DD. */
  today: string
  workouts: readonly Pick<Workout, 'session_id' | 'date'>[]
  /** Sessions of the active plan that are not archived. */
  startableSessionIds: ReadonlySet<string>
}

const workoutKey = (sessionId: string, date: string): string => `${sessionId}@${date}`

/**
 * Derives the state of each slot, keeping input order. A `planned` slot whose session has a workout on
 * its date counts as done: that is the fallback when the explicit slot-workout link failed to save.
 * A skipped slot stays skipped.
 */
export function resolveSlots<Slot extends SlotRow>(slots: readonly Slot[], context: ScheduleContext): SlotView<Slot>[] {
  const worked = new Set<string>()
  for (const workout of context.workouts) {
    if (workout.session_id !== null) worked.add(workoutKey(workout.session_id, workout.date))
  }

  return slots.map((slot) => {
    const state = slotState(slot, context.today, worked)
    const startable =
      state !== 'done' && state !== 'skipped' && slot.plan_session_id !== null && context.startableSessionIds.has(slot.plan_session_id)
    return { slot, state, startable }
  })
}

function slotState(slot: SlotRow, today: string, worked: ReadonlySet<string>): SlotState {
  if (slot.status !== 'planned') return slot.status
  if (slot.plan_session_id !== null && worked.has(workoutKey(slot.plan_session_id, slot.date))) return 'done'
  // ISO dates compare as text.
  return slot.date < today ? 'to_recover' : 'upcoming'
}

// Anything still to do wins over done, and done over skipped.
function dayDot(views: readonly SlotView[]): DotKind {
  if (views.some((view) => view.state === 'upcoming' || view.state === 'to_recover')) return 'empty'
  return views.some((view) => view.state === 'done') ? 'full' : 'struck'
}

/** Groups resolved slots by date for the month grid; days without slots are absent. */
export function groupByDay<Slot extends SlotRow>(views: readonly SlotView<Slot>[]): Map<string, DayGroup<Slot>> {
  const byDate = new Map<string, SlotView<Slot>[]>()
  for (const view of views) {
    const day = byDate.get(view.slot.date)
    if (day) day.push(view)
    else byDate.set(view.slot.date, [view])
  }
  return new Map([...byDate].map(([date, dayViews]) => [date, { views: dayViews, dot: dayDot(dayViews) }]))
}
