import { scheduleRepeating, scheduleSession } from '../../data/schedule'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Italian message when `date` cannot be planned, null when it can. Past days are history: nothing is planned there. */
export function dateProblem(date: string, today: string): string | null {
  if (!DAY_PATTERN.test(date)) return 'Scegli un giorno.'
  return date < today ? 'Scegli un giorno da oggi in poi.' : null
}

/** Plans the session on `date`, and on each following week when `weeks` is above one (`weeks` slots in total). */
export async function saveSchedule(session: { id: string; name: string }, date: string, weeks: number): Promise<void> {
  if (weeks === 1) await scheduleSession(session.id, session.name, date)
  else await scheduleRepeating(session.id, session.name, date, weeks)
}
