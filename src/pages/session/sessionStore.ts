import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { DataError } from '../../data/client'
import { linkWorkout } from '../../data/schedule'
import { createWorkout, deleteSet, logSet } from '../../data/workouts'
import { deleteWorkout, saveWorkoutNotes } from '../../data/sessionLog'
import { localDateString } from '../../lib/localDate'
import { newUuid } from '../../lib/uuid'
import { browserStorage, unsyncedCount } from '../../lib/sessionDraft'
import { SessionStore, type StoreState } from '../../lib/sessionStore'

/** A slot that is no longer planned is the normal "already handled" case; anything else only matters in dev. */
function reportLinkError(error: unknown): void {
  if (error instanceof DataError && error.code === 'not_planned') return
  if (import.meta.env.DEV) console.warn('Could not link the workout to its calendar slot', error)
}

/** The one open session of the app, shared by Home and Session. */
export const sessionStore = new SessionStore({
  api: { createWorkout, logSet, deleteSet, saveNotes: saveWorkoutNotes, deleteWorkout, linkSlot: linkWorkout },
  storage: browserStorage(),
  uuid: newUuid,
  today: () => localDateString(new Date()),
  now: () => Date.now(),
  onLinkError: reportLinkError,
})

export function useSessionState(): StoreState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot)
}

/** Props for the "serie da inviare" banner. */
export function useSyncStatus() {
  const { draft, syncing, failed } = useSessionState()
  const onRetry = useCallback(() => void sessionStore.flush(), [])
  return { count: draft ? unsyncedCount(draft) : 0, syncing, failed, onRetry }
}

/** Sends the sets a previous visit left unsent. */
export function useFlushOnMount(): void {
  useEffect(() => {
    const { draft } = sessionStore.getSnapshot()
    if (draft && unsyncedCount(draft) > 0) void sessionStore.flush()
  }, [])
}
