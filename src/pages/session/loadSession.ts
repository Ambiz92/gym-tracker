import { getActivePlan, type ActivePlan, type SessionDetail } from '../../data/activePlan'
import { getLastSets } from '../../data/workouts'
import type { SetLog } from '../../types/db'

export interface LoadedSession {
  plan: ActivePlan
  session: SessionDetail
  /** Sets of the previous workout per exercise id, for prefill, hints and the summary. */
  lastSets: ReadonlyMap<string, SetLog[]>
}

/** The session in the active plan with last time's sets; null when the plan or the session is gone. */
export async function loadSession(sessionId: string, openWorkoutId?: string): Promise<LoadedSession | null> {
  const plan = await getActivePlan()
  const session = plan?.sessions.find((candidate) => candidate.id === sessionId)
  if (!plan || !session) return null

  const entries = await Promise.all(
    session.exercises.map(async ({ exercise_id }) => [exercise_id, await getLastSets(exercise_id, openWorkoutId)] as const),
  )
  return { plan, session, lastSets: new Map(entries) }
}
