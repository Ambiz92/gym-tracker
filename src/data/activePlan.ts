import type { Exercise, Plan, PlanExercise, PlanSession, WarmupItem } from '../types/db'
import { own, unwrapOrNull } from './client'

export interface PlanExerciseDetail extends PlanExercise {
  exercise: Exercise
}

export interface SessionDetail extends PlanSession {
  exercises: PlanExerciseDetail[]
  warmup: WarmupItem[]
}

/** `sessions` holds the live sessions only: archived ones are hidden from the plan, Oggi and the next-session logic. */
export interface PlanDetail extends Plan {
  sessions: SessionDetail[]
}

/** What the plan editor needs on top: the archived sessions, to offer their restore. */
export interface EditablePlan extends PlanDetail {
  archivedSessions: SessionDetail[]
}

interface RawPlan extends Plan {
  plan_session: (PlanSession & {
    plan_exercise: PlanExerciseDetail[]
    warmup_item: WarmupItem[]
  })[]
}

const byPosition = <T extends { position: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.position - b.position)

const PLAN_TREE = '*, plan_session(*, plan_exercise(*, exercise(*)), warmup_item(*))'

function shapePlan({ plan_session, ...plan }: RawPlan): EditablePlan {
  const sessions = byPosition(plan_session).map(({ plan_exercise, warmup_item, ...session }) => ({
    ...session,
    exercises: byPosition(plan_exercise),
    warmup: byPosition(warmup_item),
  }))
  return {
    ...plan,
    sessions: sessions.filter((session) => !session.archived),
    archivedSessions: sessions.filter((session) => session.archived),
  }
}

/** The active plan with sessions, exercises and warm-ups ordered by position; null when none is active. */
export async function getActivePlan(): Promise<PlanDetail | null> {
  const raw = unwrapOrNull<RawPlan>(await (await own('plan')).select(PLAN_TREE).eq('is_active', true).maybeSingle())
  return raw && shapePlan(raw)
}

/** Any plan (archived included) with its archived sessions listed apart; null when it does not exist. */
export async function getPlanById(id: string): Promise<EditablePlan | null> {
  const raw = unwrapOrNull<RawPlan>(await (await own('plan')).select(PLAN_TREE).eq('id', id).maybeSingle())
  return raw && shapePlan(raw)
}
