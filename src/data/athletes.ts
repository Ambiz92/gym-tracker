import type { Exercise, Plan, PlanExercise, PlanSession, Workout } from '../types/db'
import { athleteReader, unwrap } from './client'
import type { HistoryExercise, LoggedSet, RecentWorkout } from './history'
import { readAllRows } from './paging'

// Read-only by construction: everything here goes through athleteReader(), which can only select.

/** A workout of the athlete with its free-text notes, which the coach may read. */
export type AthleteWorkout = RecentWorkout & Pick<Workout, 'notes'>

export type AthleteExercise = HistoryExercise & Pick<Exercise, 'notes'>

export type AthletePlanExercise = Pick<PlanExercise, 'exercise_id' | 'position' | 'target_sets' | 'target_reps' | 'target_unit'>

export type AthletePlanSession = Pick<PlanSession, 'id' | 'name' | 'subtitle' | 'position' | 'is_optional'> & {
  plan_exercise: AthletePlanExercise[]
}

export type AthletePlan = Pick<Plan, 'id' | 'name' | 'is_active'> & { plan_session: AthletePlanSession[] }

export interface AthleteData {
  workouts: AthleteWorkout[]
  exercises: AthleteExercise[]
  sets: LoggedSet[]
  plans: AthletePlan[]
}

const EXERCISE_COLUMNS = 'id, name, equipment, archived, starting_weight_kg, notes'
const WORKOUT_COLUMNS = 'id, date, session_name, notes, set_log(exercise_id, set_number, reps, weight_kg, equipment_used)'
const PLAN_COLUMNS =
  'id, name, is_active, plan_session(id, name, subtitle, position, is_optional, plan_exercise(exercise_id, position, target_sets, target_reps, target_unit))'

/**
 * What the coach sees of an athlete: the latest `recentWorkouts` workouts with their notes, the exercise
 * library, every logged set (for the weight trend) and the plans that are not archived (archived sessions
 * left out). Fails with `not_linked` unless the caller is the coach of an active link with `athleteId`.
 */
export async function loadAthleteData(athleteId: string, recentWorkouts: number): Promise<AthleteData> {
  const reader = await athleteReader(athleteId)
  const [workouts, exercises, sets, plans] = await Promise.all([
    reader
      .table('workout')
      .select(WORKOUT_COLUMNS)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(recentWorkouts),
    reader.table('exercise').select(EXERCISE_COLUMNS).order('name'),
    readAllRows<Pick<LoggedSet, 'exercise_id' | 'weight_kg'> & { workout: { date: string } }>((from, to) =>
      reader.table('set_log').select('exercise_id, weight_kg, workout!inner(date)').order('id').range(from, to),
    ),
    reader.table('plan').select(PLAN_COLUMNS).eq('archived', false).eq('plan_session.archived', false).order('name'),
  ])
  return {
    workouts: unwrap<AthleteWorkout[]>(workouts),
    exercises: unwrap<AthleteExercise[]>(exercises),
    sets: sets.map(({ workout, ...set }) => ({ ...set, date: workout.date })),
    plans: unwrap<AthletePlan[]>(plans),
  }
}
