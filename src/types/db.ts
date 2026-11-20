// Hand-written row types mirroring supabase/migrations/0001_schema.sql and the later ones.
// numeric columns arrive as JSON numbers, uuid/date columns as strings.

export type Equipment = 'barbell' | 'dumbbell' | 'other'
export type TargetUnit = 'reps' | 'seconds' | 'meters'

export type TableName =
  | 'exercise'
  | 'plan'
  | 'plan_session'
  | 'plan_exercise'
  | 'warmup_item'
  | 'workout'
  | 'set_log'

// owner_id is never sent: the database fills it with auth.uid().
type Insert<Row, Optional extends keyof Row> = Omit<Row, Optional | 'owner_id'> & Partial<Pick<Row, Optional>>
type Update<Row> = Partial<Omit<Row, 'id' | 'owner_id'>>

export interface Exercise {
  id: string
  owner_id: string
  name: string
  equipment: Equipment
  muscles: string | null
  execution_steps: string | null
  notes: string | null
  starting_weight_kg: number | null
  archived: boolean
  /** The catalog entry this exercise was copied from; null for a personal one. */
  catalog_id: string | null
}
export type ExerciseInsert = Insert<
  Exercise,
  'id' | 'muscles' | 'execution_steps' | 'notes' | 'starting_weight_kg' | 'archived' | 'catalog_id'
>
export type ExerciseUpdate = Update<Exercise>

/** A read-only standard exercise: choosing it copies it into the user's own `exercise` rows. */
export interface CatalogExercise {
  id: string
  slug: string
  name_it: string
  name_en: string | null
  synonyms: string[]
  equipment: Equipment
  primary_muscle: string
  secondary_muscles: string[]
  execution_steps: string | null
  source: string
  source_id: string
}

export interface Plan {
  id: string
  owner_id: string
  name: string
  is_active: boolean
  archived: boolean
}
export type PlanInsert = Insert<Plan, 'id' | 'is_active' | 'archived'>

export interface PlanSession {
  id: string
  owner_id: string
  plan_id: string
  name: string
  subtitle: string | null
  position: number
  is_optional: boolean
  archived: boolean
}
export type PlanSessionInsert = Insert<PlanSession, 'id' | 'subtitle' | 'is_optional' | 'archived'>
export type PlanSessionUpdate = Update<PlanSession>

export interface PlanExercise {
  id: string
  owner_id: string
  session_id: string
  exercise_id: string
  position: number
  target_sets: number
  target_reps: number
  target_unit: TargetUnit
  suggested_weight_kg: number | null
  suggested_weight_max_kg: number | null
}
export type PlanExerciseInsert = Insert<
  PlanExercise,
  'id' | 'target_unit' | 'suggested_weight_kg' | 'suggested_weight_max_kg'
>
export type PlanExerciseUpdate = Update<PlanExercise>

export interface WarmupItem {
  id: string
  owner_id: string
  session_id: string
  position: number
  name: string
  reps_text: string | null
  note: string | null
}
export type WarmupItemInsert = Insert<WarmupItem, 'id' | 'reps_text' | 'note'>

export interface Workout {
  id: string
  owner_id: string
  date: string // YYYY-MM-DD
  created_at: string // ISO timestamp, breaks ties between workouts on the same day
  session_id: string | null
  session_name: string
  notes: string | null
}
export type WorkoutInsert = Insert<Workout, 'id' | 'date' | 'created_at' | 'session_id' | 'notes'>

export interface SetLog {
  id: string
  owner_id: string
  workout_id: string
  exercise_id: string
  set_number: number
  reps: number
  weight_kg: number
  equipment_used: Equipment
  rpe: number | null
}
export type SetLogInsert = Insert<SetLog, 'id' | 'rpe'>

/** The part of a logged set that prefill and progression read. */
export type LastSet = Pick<SetLog, 'set_number' | 'reps' | 'weight_kg' | 'equipment_used'>

/** A logged set with the date of its workout. */
export interface HistorySet extends SetLog {
  date: string
}
