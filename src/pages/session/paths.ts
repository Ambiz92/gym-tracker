/** Session list, or the set logger of one exercise. */
export function sessionPath(sessionId: string, exerciseId?: string | null): string {
  const base = `/session/${sessionId}`
  return exerciseId ? `${base}?es=${encodeURIComponent(exerciseId)}` : base
}

/** Starts a session from a calendar slot: the route carries only the slot id. */
export const slotStartPath = (sessionId: string, slotId: string): string => `/session/${sessionId}?slot=${encodeURIComponent(slotId)}`

/** The end-of-session summary. */
export const summaryPath = (sessionId: string): string => `/session/${sessionId}?fine=1`
