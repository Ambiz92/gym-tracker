import type { CoachLink, CoachLinkStatus } from '../types/db'
import { dayMonthName } from './formatDate'
import { localDateString } from './localDate'
import { isUuid } from './uuid'

const STATUS_LABELS: Record<CoachLinkStatus, string> = {
  active: 'Attivo',
  // Legacy rows only: a link is active from the start now, so nothing creates a pending one.
  pending: 'In sospeso',
  revoked: 'Revocato',
}

export function linkStatusLabel(status: CoachLinkStatus): string {
  return STATUS_LABELS[status]
}

const isOpen = (link: CoachLink): boolean => link.status !== 'revoked'

/** The athlete's one open link (active, or a legacy pending), or null: a revoked one is over and a new link is possible elsewhere. */
export function openCoachLink(asAthlete: readonly CoachLink[]): CoachLink | null {
  return asAthlete.find(isOpen) ?? null
}

/** The coach's links that can still be revoked: active ones, plus legacy pending ones. */
export const openAthletes = (asCoach: readonly CoachLink[]): CoachLink[] => asCoach.filter(isOpen)

/** The athletes the coach can read: active links only. */
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

/** "21 nov" for the local day a link timestamp falls on. */
export function linkDay(timestamp: string): string {
  return dayMonthName(localDateString(new Date(timestamp)))
}

/** The day the link started: the database sets `accepted_at` on insert, older rows fall back to their creation. */
export function linkSince(link: Pick<CoachLink, 'accepted_at' | 'created_at'>): string {
  return linkDay(link.accepted_at ?? link.created_at)
}
