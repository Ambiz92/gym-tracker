import type { Exercise, LastSet, SetLog, Workout } from '../types/db'
import { DataError, own, unwrap, unwrapOrNull } from './client'
import { readAllRows } from './paging'

const INVALID_TEXT_REPRESENTATION = '22P02'

/** The exercise fields the history screens read; archived exercises keep their history. */
export type HistoryExercise = Pick<Exercise, 'id' | 'name' | 'equipment' | 'archived' | 'starting_weight_kg'>

export interface LoggedSet {
  exercise_id: string
  weight_kg: number
  date: string
}

export type RecentWorkout = Pick<Workout, 'id' | 'date' | 'session_name'> & {
  set_log: (Pick<SetLog, 'exercise_id'> & LastSet)[]
}

const EXERCISE_COLUMNS = 'id, name, equipment, archived, starting_weight_kg'

/** Every exercise, archived ones included, by name. */
export async function listHistoryExercises(): Promise<HistoryExercise[]> {
  return unwrap<HistoryExercise[]>(await (await own('exercise')).select(EXERCISE_COLUMNS).order('name'))
}

/** One exercise by id, or null when it does not exist (a malformed id from the URL counts as missing). */
export async function getHistoryExercise(id: string): Promise<HistoryExercise | null> {
  try {
    return unwrapOrNull<HistoryExercise>(
      await (await own('exercise')).select(EXERCISE_COLUMNS).eq('id', id).maybeSingle(),
    )
  } catch (error) {
    if (error instanceof DataError && error.code === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
}

/** Exercise, weight and workout date of every logged set, however many there are. */
export async function listLoggedSets(): Promise<LoggedSet[]> {
  const setLogs = await own('set_log')
  const rows = await readAllRows<Pick<SetLog, 'exercise_id' | 'weight_kg'> & { workout: { date: string } }>((from, to) =>
    setLogs.select('exercise_id, weight_kg, workout!inner(date)').order('id').range(from, to),
  )
  return rows.map(({ workout, ...set }) => ({ ...set, date: workout.date }))
}

/** The latest workouts with their sets, newest first. */
export async function listRecentWorkouts(limit: number): Promise<RecentWorkout[]> {
  return unwrap<RecentWorkout[]>(
    await (await own('workout'))
      .select('id, date, session_name, set_log(exercise_id, set_number, reps, weight_kg, equipment_used)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  )
}

/** What the calendar needs of a workout: which session was done on which day. */
export type WorkoutDay = Pick<Workout, 'id' | 'session_id' | 'date'>

/** Id, session and date of the workouts in [from, to] (both inclusive, YYYY-MM-DD): what the calendar reconciles slots against. */
export async function listWorkoutDays(from: string, to: string): Promise<WorkoutDay[]> {
  return unwrap<WorkoutDay[]>(await (await own('workout')).select('id, session_id, date').gte('date', from).lte('date', to))
}
