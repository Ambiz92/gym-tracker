import { listWorkoutDays } from '../../data/history'
import { listSlots } from '../../data/schedule'
import { useAsync } from '../../hooks/useAsync'
import type { ScheduledSession, Workout } from '../../types/db'
import { lookbackStart } from './model'

export interface ScheduleData {
  slots: ScheduledSession[]
  workouts: Pick<Workout, 'session_id' | 'date'>[]
}

async function loadSchedule(today: string): Promise<ScheduleData> {
  const from = lookbackStart(today)
  const [slots, workouts] = await Promise.all([listSlots(from, today), listWorkoutDays(from, today)])
  return { slots, workouts }
}

/** Slots up to `today` and the workouts to reconcile them with; a separate read, so a failure never touches the plan list. */
export function useTodaySlots(today: string) {
  return useAsync(() => loadSchedule(today), [today])
}

export type TodaySlotsState = ReturnType<typeof useTodaySlots>
