export interface PlannedSession {
  id: string
  is_optional: boolean
}

/**
 * The session to do next: the one after the most recently done, in plan order and wrapping around,
 * skipping bonus sessions. Without history, the first non-bonus session. Null for an empty plan.
 * `lastDates` maps a session id to the date (YYYY-MM-DD) of its latest workout.
 */
export function nextSessionId(sessions: readonly PlannedSession[], lastDates: ReadonlyMap<string, string>): string | null {
  const regular = sessions.filter((session) => !session.is_optional)
  const candidates = regular.length > 0 ? regular : sessions

  let lastDone = -1
  let latest = ''
  sessions.forEach((session, index) => {
    const date = lastDates.get(session.id)
    // ISO dates sort as text; a tie goes to the later session in the plan.
    if (date !== undefined && date >= latest) {
      latest = date
      lastDone = index
    }
  })
  if (lastDone < 0) return candidates[0]?.id ?? null

  for (let step = 1; step <= sessions.length; step++) {
    const session = sessions[(lastDone + step) % sessions.length]
    if (session && candidates.includes(session)) return session.id
  }
  return null
}
