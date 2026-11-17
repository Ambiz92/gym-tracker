import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { createWorkout, deleteSet, logSet } from '../../data/workouts'
import { deleteWorkout, saveWorkoutNotes } from '../../data/sessionLog'
import { localDateString } from '../../lib/localDate'
import { browserStorage, unsyncedCount } from '../../lib/sessionDraft'
import { SessionStore, type StoreState } from '../../lib/sessionStore'

/** The one open session of the app, shared by Home and Session. */
export const sessionStore = new SessionStore({
  api: { createWorkout, logSet, deleteSet, saveNotes: saveWorkoutNotes, deleteWorkout },
  storage: browserStorage(),
  uuid: () => crypto.randomUUID(),
  today: () => localDateString(new Date()),
  now: () => Date.now(),
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
