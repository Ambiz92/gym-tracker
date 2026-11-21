import { weeklyDates } from '../lib/calendar'
import { localDateString } from '../lib/localDate'
import { reconciledLinks, workoutKey } from '../lib/scheduleStatus'
import { newUuid } from '../lib/uuid'
import type { ScheduledSession, ScheduledSessionUpdate } from '../types/db'
import { DataError, ensureOk, supabase, unwrap, unwrapOrNull } from './client'
import type { WorkoutDay } from './history'

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

/**
 * Refuses to touch a `planned` slot whose session already has a workout on its date: reading shows
 * it as done, and a failed link must never let it be moved, skipped or deleted. Other states and
 * unknown ids pass, so the caller's own filters answer them.
 */
async function refuseIfWorkedOut(id: string): Promise<void> {
  const slot = await getSlot(id)
  if (!slot || slot.status !== 'planned' || slot.plan_session_id === null) return
  const workouts = unwrap<{ id: string }[]>(
    await supabase.from('workout').select('id').eq('session_id', slot.plan_session_id).eq('date', slot.date).limit(1),
  )
  if (workouts.length > 0) throw new DataError('A workout was already logged for this slot', 'already_done')
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

/** One slot by id, or null when it does not exist. */
export async function getSlot(id: string): Promise<ScheduledSession | null> {
  return unwrapOrNull<ScheduledSession>(await supabase.from(TABLE).select().eq('id', id).maybeSingle())
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

/** Moves a planned slot (also an overdue one) to `date`, today or later; done, skipped and worked-out slots are never moved. */
export async function moveSlot(id: string, date: string): Promise<void> {
  if (date < today()) throw new DataError('A slot cannot be moved to a past date', 'past_date')
  await refuseIfWorkedOut(id)
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
export async function skipSlot(id: string): Promise<void> {
  await refuseIfWorkedOut(id)
  await updatePlanned(id, { status: 'skipped' })
}

/**
 * Deletes a planned slot of today or later. Done and skipped slots, anything in the past and a slot
 * its session already has a workout for are history and stay (an overdue slot is skipped, not deleted).
 */
export async function deleteSlot(id: string): Promise<void> {
  await refuseIfWorkedOut(id)
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
 * Persists the "done" that reading derived from a workout (same session and day) for slots whose
 * link never saved, so the database converges. Best effort: it never rejects and a failure is
 * not reported, because the derived state stays correct without it.
 */
export async function healReconciledSlots(slots: readonly ScheduledSession[], workouts: readonly WorkoutDay[]): Promise<void> {
  await Promise.allSettled(reconciledLinks(slots, workouts).map(({ slotId, workoutId }) => linkWorkout(slotId, workoutId)))
}

/**
 * Puts a slot back to `planned` when its workout was discarded (every set undone). Only a slot that
 * is done AND linked to that very workout changes, so it must run before the workout is deleted
 * (deleting it nulls the link). Best effort: it never rejects.
 */
export async function reopenSlot(slotId: string, workoutId: string): Promise<void> {
  try {
    ensureOk(
      await supabase
        .from(TABLE)
        .update({ status: 'planned', workout_id: null })
        .eq('id', slotId)
        .eq('status', 'done')
        .eq('workout_id', workoutId),
    )
  } catch {
    // Reading reconciles with the workout that is about to go; nothing else depends on this.
  }
}

/**
 * Deletes the slots of `planSessionIds` that are still to do: `planned`, dated today or later and
 * without a workout, and not completed by one either (a workout of the same session and day whose
 * link failed). Workouts, sets and any done, skipped or past slot are out of its reach.
 */
export async function deleteFuturePlannedSlots(planSessionIds: string[]): Promise<void> {
  if (planSessionIds.length === 0) return
  const from = today()
  const slots = unwrap<{ id: string; plan_session_id: string; date: string }[]>(
    await supabase
      .from(TABLE)
      .select('id, plan_session_id, date')
      .in('plan_session_id', planSessionIds)
      .eq('status', 'planned')
      .is('workout_id', null)
      .gte('date', from),
  )
  if (slots.length === 0) return
  const workouts = unwrap<{ session_id: string; date: string }[]>(
    await supabase.from('workout').select('session_id, date').in('session_id', planSessionIds).gte('date', from),
  )
  const worked = new Set(workouts.map((workout) => workoutKey(workout.session_id, workout.date)))
  const doomed = slots.filter((slot) => !worked.has(workoutKey(slot.plan_session_id, slot.date))).map((slot) => slot.id)
  if (doomed.length === 0) return
  // The same filters again: a slot that changed since the read is still out of reach.
  ensureOk(await supabase.from(TABLE).delete().in('id', doomed).eq('status', 'planned').is('workout_id', null).gte('date', from))
}
