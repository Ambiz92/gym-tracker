import type { Equipment, ScheduledSession } from '../types/db'

/** `pending`: not acknowledged by the server yet. `removed`: undone, the server row (if any) still has to go. */
export type SetSync = 'pending' | 'synced' | 'removed'

export interface DraftSet {
  id: string
  exerciseId: string
  setNumber: number
  reps: number
  weightKg: number
  equipment: Equipment
  sync: SetSync
}

/** The open session: lives in the browser until every set reached the server and the user closes it. */
export interface Draft {
  workoutId: string
  workoutSynced: boolean
  date: string
  sessionId: string
  sessionName: string
  startedAt: number
  currentExerciseId: string | null
  sets: DraftSet[]
  /** Calendar slot this session was started from; absent in drafts saved before the calendar existed. */
  scheduledId?: string
}

export type Operation = { kind: 'workout' } | { kind: 'log'; set: DraftSet } | { kind: 'delete'; set: DraftSet }

export const DRAFT_STORAGE_KEY = 'gym-tracker.session-draft'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type NewDraft = Pick<Draft, 'workoutId' | 'date' | 'sessionId' | 'sessionName' | 'startedAt' | 'scheduledId'>

export function newDraft(init: NewDraft): Draft {
  return { ...init, workoutSynced: false, currentExerciseId: null, sets: [] }
}

/** A slot can be linked to the session being started only while it is still planned and is that session's. */
export const isLinkableSlot = (slot: Pick<ScheduledSession, 'status' | 'plan_session_id'>, sessionId: string): boolean =>
  slot.status === 'planned' && slot.plan_session_id === sessionId

export const activeSets = (draft: Draft): DraftSet[] => draft.sets.filter((set) => set.sync !== 'removed')

export const setsOf = (draft: Draft, exerciseId: string): DraftSet[] =>
  activeSets(draft).filter((set) => set.exerciseId === exerciseId)

/** Number of the next set of the exercise: one past the highest logged one. */
export function nextSetNumber(draft: Draft, exerciseId: string): number {
  return Math.max(0, ...setsOf(draft, exerciseId).map((set) => set.setNumber)) + 1
}

export const addSet = (draft: Draft, set: Omit<DraftSet, 'sync'>): Draft => ({
  ...draft,
  sets: [...draft.sets, { ...set, sync: 'pending' }],
})

/**
 * Undo. Before the workout row reached the server nothing of the set can be there, so it is
 * dropped at once; afterwards it is only marked, because a request may already be in flight.
 */
export function removeSet(draft: Draft, setId: string): Draft {
  const sets = draft.workoutSynced
    ? draft.sets.map((set) => (set.id === setId ? { ...set, sync: 'removed' as const } : set))
    : draft.sets.filter((set) => set.id !== setId)
  return { ...draft, sets }
}

/** The server acknowledged the insert; a set undone in the meantime stays `removed`. */
export const ackSet = (draft: Draft, setId: string): Draft => ({
  ...draft,
  sets: draft.sets.map((set) => (set.id === setId && set.sync === 'pending' ? { ...set, sync: 'synced' } : set)),
})

/** The server acknowledged the delete (or the set was never there). */
export const dropSet = (draft: Draft, setId: string): Draft => ({
  ...draft,
  sets: draft.sets.filter((set) => set.id !== setId),
})

export const ackWorkout = (draft: Draft): Draft => ({ ...draft, workoutSynced: true })

export const withCurrentExercise = (draft: Draft, exerciseId: string | null): Draft => ({
  ...draft,
  currentExerciseId: exerciseId,
})

/** Sets (and removals) the server has not confirmed yet: what the "Riprova" banner counts. */
export const unsyncedCount = (draft: Draft): number => draft.sets.filter((set) => set.sync !== 'synced').length

/** Next request to send, in order: the workout row first, then sets and removals one by one. */
export function nextOperation(draft: Draft): Operation | null {
  if (!draft.workoutSynced && draft.sets.some((set) => set.sync === 'pending')) return { kind: 'workout' }
  const set = draft.sets.find((candidate) => candidate.sync !== 'synced')
  if (!set) return null
  return { kind: set.sync === 'removed' ? 'delete' : 'log', set }
}

const EQUIPMENT: readonly string[] = ['barbell', 'dumbbell', 'other']
const SYNC: readonly string[] = ['pending', 'synced', 'removed']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDraftSet(value: unknown): value is DraftSet {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.exerciseId === 'string' &&
    Number.isInteger(value.setNumber) &&
    Number.isInteger(value.reps) &&
    typeof value.weightKg === 'number' &&
    Number.isFinite(value.weightKg) &&
    typeof value.equipment === 'string' &&
    EQUIPMENT.includes(value.equipment) &&
    typeof value.sync === 'string' &&
    SYNC.includes(value.sync)
  )
}

function isDraft(value: unknown): value is Draft {
  return (
    isRecord(value) &&
    typeof value.workoutId === 'string' &&
    typeof value.workoutSynced === 'boolean' &&
    typeof value.date === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.sessionName === 'string' &&
    typeof value.startedAt === 'number' &&
    (value.currentExerciseId === null || typeof value.currentExerciseId === 'string') &&
    (value.scheduledId === undefined || typeof value.scheduledId === 'string') &&
    Array.isArray(value.sets) &&
    value.sets.every(isDraftSet)
  )
}

/** The saved draft, or null when there is none, storage is unavailable or the content is not a draft. */
export function loadDraft(storage: StorageLike | null): Draft | null {
  if (!storage) return null
  try {
    const text = storage.getItem(DRAFT_STORAGE_KEY)
    if (text === null) return null
    const parsed: unknown = JSON.parse(text)
    return isDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persists the draft (null clears it). Storage failures are swallowed: the app works without persistence. */
export function saveDraft(storage: StorageLike | null, draft: Draft | null): void {
  if (!storage) return
  try {
    if (draft) storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    else storage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Quota or private mode: the in-memory draft still drives the session.
  }
}

/** localStorage when the browser allows it (it can throw when blocked), otherwise null. */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
