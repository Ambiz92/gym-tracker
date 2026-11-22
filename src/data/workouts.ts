import type { HistorySet, SetLog, SetLogInsert, Workout } from '../types/db'
import { ensureOk, own, unwrap } from './client'

export interface NewWorkout {
  /** Client-generated uuid: lets a retry of the same draft hit the same row. */
  id?: string
  /** Local date YYYY-MM-DD: the database default is UTC, which is wrong near midnight. */
  date: string
  sessionId: string | null
  sessionName: string
}

/**
 * Creates the workout row when the first set of a session is confirmed.
 * Idempotent on `id`: the UI draft keeps one id and retries after a network failure, so a
 * request that actually reached the database must not create a second workout.
 */
export async function createWorkout({ id, date, sessionId, sessionName }: NewWorkout): Promise<Workout> {
  return unwrap<Workout>(
    await (await own('workout'))
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
    await (await own('set_log'))
      .upsert(set, { onConflict: 'workout_id,exercise_id,set_number' })
      .select()
      .single(),
  )
}

/** Undo of a confirmed set. */
export async function deleteSet(setId: string): Promise<void> {
  ensureOk(await (await own('set_log')).delete().eq('id', setId))
}

export interface PastWorkout {
  date: string
  sets: SetLog[]
}

/**
 * The `count` most recent workouts that contain the exercise, newest first, each with its sets in set order.
 * Pass the open workout as `excludeWorkoutId` so it is not mistaken for a previous one.
 * One request: the inner join keeps only the exercise's rows inside each workout.
 */
export async function getLastWorkoutsSets(exerciseId: string, count: number, excludeWorkoutId?: string): Promise<PastWorkout[]> {
  let query = (await own('workout'))
    .select('id, date, set_log!inner(*)')
    .eq('set_log.exercise_id', exerciseId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(count)
  if (excludeWorkoutId) query = query.neq('id', excludeWorkoutId)

  const workouts = unwrap<{ date: string; set_log: SetLog[] }[]>(await query)
  return workouts.map(({ date, set_log }) => ({ date, sets: [...set_log].sort((a, b) => a.set_number - b.set_number) }))
}

// PostgREST caps a response at 1000 rows by default, so history is read in pages of this size.
const HISTORY_PAGE_SIZE = 1000

/** Every logged set of an exercise with its workout date, oldest first, however many there are. */
export async function getExerciseHistory(exerciseId: string): Promise<HistorySet[]> {
  const history: HistorySet[] = []
  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    // workout_id breaks ties between workouts on the same day, so pages never overlap or skip rows.
    const page = unwrap<(SetLog & { workout: { date: string } })[]>(
      await (await own('set_log'))
        .select('*, workout!inner(date)')
        .eq('exercise_id', exerciseId)
        .order('workout(date)')
        .order('workout_id')
        .order('set_number')
        .range(from, from + HISTORY_PAGE_SIZE - 1),
    )
    history.push(...page.map(({ workout, ...set }) => ({ ...set, date: workout.date })))
    if (page.length < HISTORY_PAGE_SIZE) return history
  }
}
