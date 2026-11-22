import type { AthleteExercise, AthletePlan, AthletePlanExercise, AthleteWorkout } from '../../data/athletes'
import type { LoggedSet } from '../../data/history'
import { buildExerciseSummaries, buildSessionSummaries, type ExerciseSummary, type SessionSummary } from '../history/model'

const blankToNull = (text: string | null): string | null => (text?.trim() ? text.trim() : null)

export interface AthleteSession extends SessionSummary {
  notes: string | null
}

/** The recent workouts as the athlete's own Storico shows them, plus the notes they wrote on each. */
export function buildAthleteSessions(
  workouts: readonly AthleteWorkout[],
  exercises: readonly Pick<AthleteExercise, 'id' | 'name'>[],
  today: string,
): AthleteSession[] {
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  const notes = new Map(workouts.map((workout) => [workout.id, blankToNull(workout.notes)]))
  return buildSessionSummaries(workouts, names, today).map((session) => ({ ...session, notes: notes.get(session.id) ?? null }))
}

export interface AthleteExerciseRow extends ExerciseSummary {
  notes: string | null
}

/** Every exercise the athlete ever logged, the most recent first, with the notes they wrote on it. */
export function buildAthleteExercises(exercises: readonly AthleteExercise[], sets: readonly LoggedSet[]): AthleteExerciseRow[] {
  const notes = new Map(exercises.map((exercise) => [exercise.id, blankToNull(exercise.notes)]))
  return buildExerciseSummaries(exercises, sets).map((summary) => ({ ...summary, notes: notes.get(summary.id) ?? null }))
}

const UNIT_SUFFIX = { reps: '', seconds: ' s', meters: ' m' } as const

/** "3×8", "3×30 s", "2×20 m". */
export function targetLabel({ target_sets, target_reps, target_unit }: AthletePlanExercise): string {
  return `${target_sets}×${target_reps}${UNIT_SUFFIX[target_unit]}`
}

export interface PlanView {
  id: string
  name: string
  active: boolean
  sessions: {
    id: string
    title: string
    subtitle: string | null
    optional: boolean
    exercises: { key: string; name: string; target: string }[]
  }[]
}

/** The plans with sessions and exercises in plan order; the active plan comes first, the rest keep their order. */
export function buildPlanViews(plans: readonly AthletePlan[], exercises: readonly Pick<AthleteExercise, 'id' | 'name'>[]): PlanView[] {
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  const views = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    active: plan.is_active,
    sessions: [...plan.plan_session]
      .sort((a, b) => a.position - b.position)
      .map((session) => ({
        id: session.id,
        title: session.name,
        subtitle: session.subtitle,
        optional: session.is_optional,
        exercises: [...session.plan_exercise]
          .sort((a, b) => a.position - b.position)
          .map((entry) => ({
            key: `${session.id}:${entry.position}`,
            name: names.get(entry.exercise_id) ?? 'Esercizio sconosciuto',
            target: targetLabel(entry),
          })),
      })),
  }))
  return [...views.filter((view) => view.active), ...views.filter((view) => !view.active)]
}
