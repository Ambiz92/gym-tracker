import type { SetLog, SetLogInsert, Workout } from '../types/db'
import { ensureOk, supabase, unwrap } from './client'

export interface NewWorkout {
  /** Local date YYYY-MM-DD: the database default is UTC, which is wrong near midnight. */
  date: string
  sessionId: string | null
  sessionName: string
}

/** A logged set with the date of its workout. */
export interface HistorySet extends SetLog {
  date: string
}

/** Creates the workout row; called when the first set of a session is confirmed. */
export async function createWorkout({ date, sessionId, sessionName }: NewWorkout): Promise<Workout> {
  return unwrap<Workout>(
    await supabase
      .from('workout')
      .insert({ date, session_id: sessionId, session_name: sessionName })
      .select()
      .single(),
  )
}

/** Inserts a confirmed set. */
export async function logSet(set: SetLogInsert): Promise<SetLog> {
  return unwrap<SetLog>(await supabase.from('set_log').insert(set).select().single())
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
