import { ensureAffected, ensureOk, own, unwrap } from './client'

/**
 * Date of the latest workout that has at least one set, per session id (sessions never done are
 * absent). One small request per session keeps the answer exact however long the history is.
 */
export async function getLastWorkoutDates(sessionIds: readonly string[]): Promise<Map<string, string>> {
  const latest = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const [workout] = unwrap<{ date: string }[]>(
        await (await own('workout'))
          .select('date, set_log!inner(id)')
          .eq('session_id', sessionId)
          .order('date', { ascending: false })
          .limit(1),
      )
      return workout ? ([sessionId, workout.date] as const) : null
    }),
  )
  return new Map(latest.filter((entry) => entry !== null))
}

/** Stores the note of the closed session; retrying overwrites with the same text. */
export async function saveWorkoutNotes(workoutId: string, notes: string): Promise<void> {
  ensureAffected(await (await own('workout')).update({ notes }).eq('id', workoutId).select('id'))
}

/** Removes a workout and, by cascade, its sets; deleting one that is already gone is not an error. */
export async function deleteWorkout(workoutId: string): Promise<void> {
  ensureOk(await (await own('workout')).delete().eq('id', workoutId))
}
