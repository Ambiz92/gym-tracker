import type { CoachLink } from '../types/db'
import { DataError, ensureAffected, linkTable, unwrap } from './client'

const NOT_ALLOWED = '42501'
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'
const INVALID_TEXT_REPRESENTATION = '22P02'

export interface CoachLinks {
  /** The signed-in user's id, which doubles as their coach code. */
  userId: string
  /** Links where the user asked for a coach, newest first. */
  asAthlete: CoachLink[]
  /** Links where the user is the coach, newest first. */
  asCoach: CoachLink[]
}

interface Mapping {
  code: string
  message: string
}

/** The failures the database gives for a link write, told apart by code and, for the unique and check ones, by constraint name. */
function layerError(error: DataError): Mapping | null {
  const { code, message } = error
  if (code === INVALID_TEXT_REPRESENTATION) return { code: 'invalid_code', message: 'The coach code is not a uuid' }
  if (code === FOREIGN_KEY_VIOLATION) return { code: 'unknown_coach', message: 'No account has that coach code' }
  if (code === NOT_ALLOWED) return { code: 'not_allowed', message: 'The database refused the change' }
  if (code === UNIQUE_VIOLATION && message.includes('coach_athlete_pair_key')) {
    return { code: 'link_exists', message: 'A link with this coach already exists' }
  }
  if (code === UNIQUE_VIOLATION && message.includes('coach_athlete_one_open_link_per_athlete')) {
    return { code: 'already_has_coach', message: 'The athlete already has an open link' }
  }
  if (code === CHECK_VIOLATION && message.includes('coach_athlete_not_self')) {
    return { code: 'self_link', message: 'A user cannot be their own coach' }
  }
  if (code === CHECK_VIOLATION && message.includes('athlete_label')) {
    return { code: 'invalid_label', message: 'The label is not allowed' }
  }
  return null
}

async function mapped<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const mapping = error instanceof DataError ? layerError(error) : null
    if (!mapping) throw error
    throw new DataError(mapping.message, mapping.code, { cause: error })
  }
}

/** The caller's links on both sides, newest first, with the id that is their own coach code. */
export async function loadCoachLinks(): Promise<CoachLinks> {
  const links = await linkTable()
  const [asAthlete, asCoach] = await Promise.all([
    links.asAthlete('*').order('created_at', { ascending: false }),
    links.asCoach('*').order('created_at', { ascending: false }),
  ])
  return { userId: links.userId, asAthlete: unwrap<CoachLink[]>(asAthlete), asCoach: unwrap<CoachLink[]>(asCoach) }
}

/**
 * The athlete asks `coachId` (the coach's code) to coach them. Only the coach and the name the coach
 * will see are sent: the database sets the athlete (the caller), the status and the consent version.
 */
export function requestCoach(coachId: string, athleteLabel: string): Promise<CoachLink> {
  return mapped(async () => {
    const links = await linkTable()
    return unwrap<CoachLink>(await links.insert({ coach_id: coachId, athlete_label: athleteLabel }).select().single())
  })
}

/** Coach side: pending to active. A coach with an enrolled factor still at aal1 is refused (`not_allowed`). */
export function acceptLink(id: string): Promise<void> {
  return setStatus(id, 'active', ['pending'])
}

/**
 * Either side ends a pending or active link for good: the athlete withdraws or revokes, the coach declines or revokes.
 * A revoked link cannot be reopened (the database refuses it), and the row stays as the record of the consent.
 */
export function revokeLink(id: string): Promise<void> {
  return setStatus(id, 'revoked', ['pending', 'active'])
}

/** Only `status` is sent (the only column the grants allow), and only from the statuses the action starts from; no match is `not_found`. */
function setStatus(id: string, status: 'active' | 'revoked', from: string[]): Promise<void> {
  return mapped(async () => {
    const links = await linkTable()
    ensureAffected(await links.update({ status }).eq('id', id).in('status', from).select('id'))
  })
}
