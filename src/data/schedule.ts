import { weeklyDates } from '../lib/calendar'
import { localDateString } from '../lib/localDate'
import { newUuid } from '../lib/uuid'
import type { ScheduledSession, ScheduledSessionUpdate } from '../types/db'
import { DataError, ensureOk, supabase, unwrap } from './client'

const TABLE = 'scheduled_session'
const UNIQUE_VIOLATION = '23505'

// Dates always travel as local YYYY-MM-DD strings: the database default (current_date) is UTC.
const today = (): string => localDateString(new Date())

/** The unique (owner, session, date) key refuses the same session twice on one day. */
function asDuplicate(error: unknown): unknown {
  if (error instanceof DataError && error.code === UNIQUE_VIOLATION) {
    return new DataError('That session is already scheduled on that day', 'already_scheduled', { cause: error })
  }
  return error
}

/** Update that only matches a still-`planned` slot; any other state (or id) is refused with `not_planned`. */
async function updatePlanned(id: string, changes: ScheduledSessionUpdate): Promise<void> {
  const rows = unwrap<{ id: string }[]>(
    await supabase.from(TABLE).update(changes).eq('id', id).eq('status', 'planned').select('id'),
  )
  if (rows.length === 0) throw new DataError('The slot does not exist or is no longer planned', 'not_planned')
}

/** Slots with a date in [from, to] (both inclusive, YYYY-MM-DD), by date. Query by month so the 1000-row limit never bites. */
export async function listSlots(from: string, to: string): Promise<ScheduledSession[]> {
  return unwrap<ScheduledSession[]>(
    await supabase
      .from(TABLE)
      .select()
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('created_at'),
  )
}

/** Plans `planSessionId` on `date`; `sessionName` is the snapshot that outlives the session. */
export async function scheduleSession(planSessionId: string, sessionName: string, date: string): Promise<ScheduledSession> {
  try {
    return unwrap<ScheduledSession>(
      await supabase
        .from(TABLE)
        .insert({ plan_session_id: planSessionId, session_name: sessionName, date })
        .select()
        .single(),
    )
  } catch (error) {
    throw asDuplicate(error)
  }
}

/**
 * Plans the session on `startDate` and on each following week, `weeks` slots in total. One insert
 * statement, so a clash on any day rejects the whole batch; the slots share a `series_id`.
 */
export async function scheduleRepeating(
  planSessionId: string,
  sessionName: string,
  startDate: string,
  weeks: number,
): Promise<ScheduledSession[]> {
  const seriesId = newUuid()
  const rows = weeklyDates(startDate, weeks).map((date) => ({
    plan_session_id: planSessionId,
    session_name: sessionName,
    date,
    series_id: seriesId,
  }))
  try {
    return unwrap<ScheduledSession[]>(await supabase.from(TABLE).insert(rows).select())
  } catch (error) {
    throw asDuplicate(error)
  }
}

/** Moves a planned slot (also an overdue one) to `date`; done and skipped slots are never moved. */
export async function moveSlot(id: string, date: string): Promise<void> {
  try {
    await updatePlanned(id, { date })
  } catch (error) {
    throw asDuplicate(error)
  }
}

/** The "Sposta a oggi" action of an overdue slot. */
export function moveSlotToToday(id: string): Promise<void> {
  return moveSlot(id, today())
}

/** Marks a planned slot as skipped on purpose. */
export function skipSlot(id: string): Promise<void> {
  return updatePlanned(id, { status: 'skipped' })
}

/**
 * Deletes a planned slot of today or later. Done and skipped slots, and anything in the past, are
 * history and stay (an overdue slot is skipped, not deleted).
 */
export async function deleteSlot(id: string): Promise<void> {
  const rows = unwrap<{ id: string }[]>(
    await supabase.from(TABLE).delete().eq('id', id).eq('status', 'planned').gte('date', today()).select('id'),
  )
  if (rows.length === 0) throw new DataError('Only a planned slot from today on can be deleted', 'not_deletable')
}

/**
 * Links the workout started from a slot and marks the slot done. Meant to run after the sets are
 * saved: callers must not let a failure here block the workout (reading reconciles it anyway).
 */
export function linkWorkout(slotId: string, workoutId: string): Promise<void> {
  return updatePlanned(slotId, { workout_id: workoutId, status: 'done' })
}

/**
 * Deletes the slots of `planSessionIds` that are still to do: `planned`, dated today or later and
 * without a workout. One statement with all those filters, so workouts, sets and any done, skipped
 * or past slot are out of its reach.
 */
export async function deleteFuturePlannedSlots(planSessionIds: string[]): Promise<void> {
  if (planSessionIds.length === 0) return
  ensureOk(
    await supabase
      .from(TABLE)
      .delete()
      .in('plan_session_id', planSessionIds)
      .eq('status', 'planned')
      .is('workout_id', null)
      .gte('date', today()),
  )
}
