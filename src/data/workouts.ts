import type { SetLog, SetLogInsert, Workout } from '../types/db'
import { ensureOk, supabase, unwrap } from './client'

export interface NewWorkout {
  /** Client-generated uuid: lets a retry of the same draft hit the same row. */
  id?: string
  /** Local date YYYY-MM-DD: the database default is UTC, which is wrong near midnight. */
  date: string
  sessionId: string | null
  sessionName: string
}

/** A logged set with the date of its workout. */
export interface HistorySet extends SetLog {
  date: string
}

/**
 * Creates the workout row when the first set of a session is confirmed.
 * Idempotent on `id`: the UI draft keeps one id and retries after a network failure, so a
 * request that actually reached the database must not create a second workout.
 */
export async function createWorkout({ id, date, sessionId, sessionName }: NewWorkout): Promise<Workout> {
  return unwrap<Workout>(
    await supabase
      .from('workout')
      .upsert({ id, date, session_id: sessionId, session_name: sessionName }, { onConflict: 'id' })
      .select()
      .single(),
  )
}

/**
 * Stores a confirmed set. Idempotent on (workout, exercise, set number): the UI retry of a set
 * that already reached the database overwrites it with the same values instead of failing on
 * the unique constraint. Pass `id` to keep the row id stable across retries.
 */
export async function logSet(set: SetLogInsert): Promise<SetLog> {
  return unwrap<SetLog>(
    await supabase
      .from('set_log')
      .upsert(set, { onConflict: 'workout_id,exercise_id,set_number' })
      .select()
      .single(),
  )
}

/** Undo of a confirmed set. */
export async function deleteSet(setId: string): Promise<void> {
  ensureOk(await supabase.from('set_log').delete().eq('id', setId))
}

/**
 * Sets of the most recent workout that contains the exercise, in set order, for prefill.
 * Pass the open workout as `excludeWorkoutId` so it is not mistaken for the previous one.
 */
export async function getLastSets(exerciseId: string, excludeWorkoutId?: string): Promise<SetLog[]> {
  let query = supabase
    .from('workout')
    .select('id, set_log!inner(exercise_id)')
    .eq('set_log.exercise_id', exerciseId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  if (excludeWorkoutId) query = query.neq('id', excludeWorkoutId)

  const [last] = unwrap<{ id: string }[]>(await query)
  if (!last) return []

  return unwrap<SetLog[]>(
    await supabase
      .from('set_log')
      .select()
      .eq('workout_id', last.id)
      .eq('exercise_id', exerciseId)
      .order('set_number'),
  )
}

/** Every logged set of an exercise with its workout date, oldest first. */
export async function getExerciseHistory(exerciseId: string): Promise<HistorySet[]> {
  const rows = unwrap<(SetLog & { workout: { date: string } })[]>(
    await supabase.from('set_log').select('*, workout!inner(date)').eq('exercise_id', exerciseId),
  )
  return rows
    .map(({ workout, ...set }) => ({ ...set, date: workout.date }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.workout_id.localeCompare(b.workout_id) || a.set_number - b.set_number)
}
