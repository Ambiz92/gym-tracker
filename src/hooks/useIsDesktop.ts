import { useSyncExternalStore } from 'react'

/** Same breakpoint as the desktop rules in styles/desktop.css. */
export const DESKTOP_QUERY = '(min-width: 64rem)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True on a desktop-width screen: sets are read-only there. The phone layout is the server snapshot. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  )
}
