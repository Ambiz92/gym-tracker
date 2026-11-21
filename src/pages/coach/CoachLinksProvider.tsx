import { createContext, type ReactNode, useContext } from 'react'
import { type CoachLinks, loadCoachLinks } from '../../data/coachLinks'
import { type AsyncState, useAsync } from '../../hooks/useAsync'

export type CoachLinksState = AsyncState<CoachLinks> & { reload: () => void }

export const CoachLinksContext = createContext<CoachLinksState | null>(null)

// One retry: a transient failure at start-up must not hide the Atleti tab until the user opens Altro.
const loadWithRetry = () => loadCoachLinks().catch(() => loadCoachLinks())

/**
 * Loads the user's coach/athlete links once for the whole app: the tab bar and Altro read the same answer.
 * A reload after a change keeps the links on screen, so nothing under it unmounts or refetches.
 */
export function CoachLinksProvider({ children }: { children: ReactNode }) {
  const state = useAsync(loadWithRetry, [], { keepOnReload: true })
  return <CoachLinksContext.Provider value={state}>{children}</CoachLinksContext.Provider>
}

export function useCoachLinks(): CoachLinksState {
  const value = useContext(CoachLinksContext)
  if (!value) throw new Error('useCoachLinks must be used inside <CoachLinksProvider>')
  return value
}
