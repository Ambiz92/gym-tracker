import type { CoachLink, CoachLinkStatus } from '../types/db'
import { isUuid } from './uuid'

/** Which side of a link the signed-in user is on. */
export type LinkRole = 'athlete' | 'coach'

/** What the user can do to a link; `decline` and `revoke` both end in the `revoked` status. */
export type LinkAction = 'accept' | 'decline' | 'revoke'

const STATUS_LABELS: Record<LinkRole, Record<CoachLinkStatus, string>> = {
  athlete: { pending: 'In attesa di risposta', active: 'Attivo', revoked: 'Revocato' },
  coach: { pending: 'Richiesta in arrivo', active: 'Attivo', revoked: 'Revocato' },
}

export function linkStatusLabel(role: LinkRole, status: CoachLinkStatus): string {
  return STATUS_LABELS[role][status]
}

/** Mirrors the database: only the coach accepts or declines; either side revokes an open link; revoked is final. */
export function allowedActions(role: LinkRole, status: CoachLinkStatus): LinkAction[] {
  if (status === 'revoked') return []
  if (status === 'pending' && role === 'coach') return ['accept', 'decline']
  return ['revoke']
}

export function actionLabel(action: LinkAction, role: LinkRole, status: CoachLinkStatus): string {
  if (action === 'accept') return 'Accetta'
  if (action === 'decline') return 'Rifiuta'
  if (role === 'athlete' && status === 'pending') return 'Ritira la richiesta'
  return 'Revoca l’accesso'
}

/** Accepting is the only action the database refuses below aal2. */
export function needsSecondFactor(action: LinkAction): boolean {
  return action === 'accept'
}

/** The coach's reads and the accept both need aal2, so a coach with something to do and no aal2 is sent to verify. */
export function coachNeedsSecondFactor(asCoach: readonly CoachLink[], aal2: boolean): boolean {
  return !aal2 && asCoach.some((link) => link.status !== 'revoked')
}

/** The athlete's one open link (pending or active), or null: a revoked one is over and a new request is possible elsewhere. */
export function openCoachLink(asAthlete: readonly CoachLink[]): CoachLink | null {
  return asAthlete.find((link) => link.status !== 'revoked') ?? null
}

export const pendingRequests = (asCoach: readonly CoachLink[]): CoachLink[] => asCoach.filter((link) => link.status === 'pending')

export const activeAthletes = (asCoach: readonly CoachLink[]): CoachLink[] => asCoach.filter((link) => link.status === 'active')

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }

/** The coach's code is their user id: it must be a uuid and not the athlete's own. */
export function parseCoachCode(raw: string, ownId: string): Parsed<string> {
  const code = raw.trim().toLowerCase()
  if (!isUuid(code)) return { ok: false, message: 'Il codice è di 36 caratteri, con i trattini: incollalo per intero.' }
  if (code === ownId.toLowerCase()) return { ok: false, message: 'Questo è il tuo codice: serve quello del tuo allenatore.' }
  return { ok: true, value: code }
}

const LABEL_MAX = 60
// Same set as the database check (0007): controls, bidi marks, zero-width and separator characters.
const HIDDEN_CHARACTERS = /[\u0001-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/

/** The name the coach will see: trimmed, 1 to 60 visible characters. The database enforces the same rules. */
export function parseAthleteLabel(raw: string): Parsed<string> {
  const label = raw.trim()
  if (label === '') return { ok: false, message: 'Scrivi il nome con cui il tuo allenatore ti riconosce.' }
  if ([...label].length > LABEL_MAX) return { ok: false, message: `Il nome può avere al massimo ${LABEL_MAX} caratteri.` }
  if (HIDDEN_CHARACTERS.test(label)) return { ok: false, message: 'Il nome contiene caratteri non visibili o di controllo.' }
  return { ok: true, value: label }
}

/** What the coach sees for an athlete: the label the athlete chose, which may be missing on old rows. */
export function athleteName(link: Pick<CoachLink, 'athlete_label'>): string {
  return link.athlete_label ?? 'Atleta senza nome'
}
