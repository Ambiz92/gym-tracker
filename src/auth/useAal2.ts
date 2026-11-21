import { useAsync } from '../hooks/useAsync'
import { useAuth } from './AuthProvider'

export interface Aal2State {
  /** `true` at aal2, `false` below it, `null` while it is being read or when reading failed (see `loading`). */
  aal2: boolean | null
  loading: boolean
  /** Reads the level again, e.g. after a failure. */
  retry: () => void
}

export function useAal2(): Aal2State {
  const { isAal2 } = useAuth()
  const state = useAsync(isAal2, [isAal2])
  return {
    aal2: state.status === 'ready' ? state.data : null,
    loading: state.status === 'loading',
    retry: state.reload,
  }
}
