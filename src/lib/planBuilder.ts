import { MAX_NAME_LENGTH } from './exerciseForm'

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const COPY_SUFFIX = ' (copia)'

const isLetterName = (name: string) => /^[A-Za-z]$/.test(name.trim())

/** The first capital letter no session uses yet: a plan grows as "A", "B", "C". Null when all 26 are taken. */
function freeLetter(names: readonly string[]): string | null {
  const taken = new Set(names.map((name) => name.trim().toUpperCase()))
  return LETTERS.find((letter) => !taken.has(letter)) ?? null
}

/** Name of a session added with one tap: the next free letter. */
export function nextSessionName(names: readonly string[]): string {
  return freeLetter(names) ?? `Sessione ${names.length + 1}`
}

/** Name of a duplicated session: the next free letter when the source is a letter, else "<name> (copia)", "<name> (copia 2)"... */
export function duplicateSessionName(source: string, names: readonly string[]): string {
  if (isLetterName(source)) {
    const letter = freeLetter(names)
    if (letter) return letter
  }
  const taken = new Set(names.map((name) => name.trim().toLowerCase()))
  const base = source.trim()
  for (let copy = 1; ; copy++) {
    const suffix = copy === 1 ? COPY_SUFFIX : ` (copia ${copy})`
    const candidate = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** The session open in the builder: the chosen one, else the first (the chosen one was removed or none was chosen). */
export function pickSession<T extends { id: string }>(sessions: readonly T[], id: string | null): T | null {
  return sessions.find((session) => session.id === id) ?? sessions[0] ?? null
}

export type ActivationStep = 'activate' | 'confirm-replace' | 'deactivate'

/** What a tap on the footer button does: turn the plan off, or on (asking first when another plan is active). */
export function activationStep(plan: { is_active: boolean }, otherActive: boolean): ActivationStep {
  if (plan.is_active) return 'deactivate'
  return otherActive ? 'confirm-replace' : 'activate'
}

export interface FooterState {
  /** Where the plan stands: drafts and archived plans never show in Oggi. */
  status: string
  /** The one footer button; null on an archived plan, which cannot be activated. */
  button: { label: string; pressed: boolean; disabled: boolean } | null
}

/** Status line and button of the footer bar; activating needs at least one exercise. */
export function footerState(plan: { is_active: boolean; archived: boolean }, exerciseCount: number): FooterState {
  if (plan.archived) return { status: 'Archiviata · non compare in Oggi', button: null }
  if (plan.is_active) {
    return { status: 'Attiva · compare in Oggi', button: { label: '✓ Attiva', pressed: true, disabled: false } }
  }
  return {
    status: 'Bozza · non compare in Oggi',
    button: { label: 'Attiva', pressed: false, disabled: exerciseCount === 0 },
  }
}
