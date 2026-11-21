import { useRef } from 'react'
import { getActivePlan } from '../../data/activePlan'
import { listWorkoutDays, type WorkoutDay } from '../../data/history'
import { healReconciledSlots, listSlots } from '../../data/schedule'
import { useAsync } from '../../hooks/useAsync'
import { groupByDay, resolveSlots, type DayGroup } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'
import type { PickableSession } from './SchedulePicker'

interface RangeData {
  from: string
  to: string
  slots: ScheduledSession[]
  workouts: WorkoutDay[]
}

/** Reads the range and, as a side effect, persists the done states reconciliation derives from it. */
export async function loadRange(from: string, to: string): Promise<RangeData> {
  const [slots, workouts] = await Promise.all([listSlots(from, to), listWorkoutDays(from, to)])
  void healReconciledSlots(slots, workouts)
  return { from, to, slots, workouts }
}

/** Slots of the range with their derived state, grouped by day; `startable` are the sessions of the active plan. */
export function groupSlots(range: Pick<RangeData, 'slots' | 'workouts'>, startable: readonly PickableSession[], today: string): Map<string, DayGroup<ScheduledSession>> {
  const views = resolveSlots(range.slots, {
    today,
    workouts: range.workouts,
    startableSessionIds: new Set(startable.map((session) => session.id)),
  })
  return groupByDay(views)
}

export type CalendarData =
  | { status: 'error'; error: Error; retry: () => void }
  | {
      /** `loading` while data is on its way; `groups` is empty until the range has loaded once. */
      status: 'loading' | 'ready'
      /** True once this range has loaded; a later reload keeps the days on screen (`status` is `loading` again meanwhile). */
      loaded: boolean
      groups: ReadonlyMap<string, DayGroup<ScheduledSession>>
      /** Non-archived sessions of the active plan; empty without one. */
      sessions: readonly PickableSession[]
      hasPlan: boolean
      reload: () => void
    }

/** Loads the active plan once and the slots plus workouts of the visible range; while the same range reloads the previous days stay. */
export function useCalendarData(from: string, to: string, today: string): CalendarData {
  const plan = useAsync(getActivePlan, [])
  const range = useAsync(() => loadRange(from, to), [from, to])
  const last = useRef<RangeData | null>(null)
  if (range.status === 'ready') last.current = range.data
  // useAsync still reports the old range as ready for one render after the range changed: compare the bounds.
  const kept = last.current?.from === from && last.current.to === to ? last.current : null

  if (plan.status === 'error') return { status: 'error', error: plan.error, retry: plan.reload }
  if (range.status === 'error') return { status: 'error', error: range.error, retry: range.reload }

  const sessions = plan.status === 'ready' && plan.data ? plan.data.sessions : []
  const shown = plan.status === 'ready' ? kept : null
  return {
    status: plan.status === 'ready' && range.status === 'ready' && kept ? 'ready' : 'loading',
    loaded: shown !== null,
    groups: shown ? groupSlots(shown, sessions, today) : new Map(),
    sessions,
    hasPlan: plan.status === 'ready' && plan.data !== null,
    reload: range.reload,
  }
}
