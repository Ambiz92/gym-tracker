import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T }

/**
 * Runs `load` on mount and whenever `deps` change; `reload` runs it again.
 * Errors are surfaced as state, never swallowed. A stale response (the deps
 * changed or the component unmounted meanwhile) is ignored.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    load().then(
      (data) => {
        if (current) setState({ status: 'ready', data })
      },
      (cause: unknown) => {
        if (current) {
          setState({ status: 'error', error: cause instanceof Error ? cause : new Error(String(cause)) })
        }
      },
    )
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload }
}
