import { useAsync } from '../hooks/useAsync'
import { useAuth } from './AuthProvider'

/** `true` once the session is at aal2, `false` below that, `null` while it is being read. */
export function useAal2(): boolean | null {
  const { isAal2 } = useAuth()
  const state = useAsync(isAal2, [isAal2])
  return state.status === 'ready' ? state.data : null
}
