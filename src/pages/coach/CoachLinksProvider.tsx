import { createContext, type ReactNode, useContext } from 'react'
import { type CoachLinks, loadCoachLinks } from '../../data/coachLinks'
import { type AsyncState, useAsync } from '../../hooks/useAsync'

export type CoachLinksState = AsyncState<CoachLinks> & { reload: () => void }

export const CoachLinksContext = createContext<CoachLinksState | null>(null)

/** Loads the user's coach/athlete links once for the whole app: the tab bar and Altro read the same answer. */
export function CoachLinksProvider({ children }: { children: ReactNode }) {
  const state = useAsync(loadCoachLinks, [])
  return <CoachLinksContext.Provider value={state}>{children}</CoachLinksContext.Provider>
}

export function useCoachLinks(): CoachLinksState {
  const value = useContext(CoachLinksContext)
  if (!value) throw new Error('useCoachLinks must be used inside <CoachLinksProvider>')
  return value
}
