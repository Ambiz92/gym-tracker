import { getActivePlan, type PlanDetail, type SessionDetail } from '../../data/activePlan'
import { getLastWorkoutsSets } from '../../data/workouts'
import { CLEAN_WORKOUTS_REQUIRED } from '../../lib/progression'
import type { SetLog } from '../../types/db'

export interface LoadedSession {
  plan: PlanDetail
  session: SessionDetail
  /** Sets of the previous workout per exercise id, for prefill and the summary. */
  lastSets: ReadonlyMap<string, SetLog[]>
  /** Sets of the last workouts per exercise id, newest first, for the progression rule. */
  recentSets: ReadonlyMap<string, SetLog[][]>
}

/** The session in the active plan with the sets of the last workouts; null when the plan or the session is gone. */
export async function loadSession(sessionId: string, openWorkoutId?: string): Promise<LoadedSession | null> {
  const plan = await getActivePlan()
  const session = plan?.sessions.find((candidate) => candidate.id === sessionId)
  if (!plan || !session) return null

  const entries = await Promise.all(
    session.exercises.map(
      async ({ exercise_id }) =>
        [exercise_id, await getLastWorkoutsSets(exercise_id, CLEAN_WORKOUTS_REQUIRED, openWorkoutId)] as const,
    ),
  )
  const recentSets = new Map(entries)
  const lastSets = new Map(entries.map(([exerciseId, workouts]) => [exerciseId, workouts[0] ?? []]))
  return { plan, session, lastSets, recentSets }
}
