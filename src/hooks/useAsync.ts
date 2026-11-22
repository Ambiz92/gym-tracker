import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T }

interface AsyncOptions {
  /** `reload` keeps the data on screen until the new answer arrives, instead of going back to `loading`. A change of `deps` still resets. */
  keepOnReload?: boolean
}

/** The state a load starts from: the previous data survives only a `reload` of a hook that asked for it. */
export function startState<T>(previous: AsyncState<T>, reloaded: boolean, keepOnReload: boolean): AsyncState<T> {
  return keepOnReload && reloaded && previous.status === 'ready' ? previous : { status: 'loading' }
}

/**
 * Runs `load` on mount and whenever `deps` change; `reload` runs it again.
 * Errors are surfaced as state, never swallowed. A stale response (the deps
 * changed or the component unmounted meanwhile) is ignored.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  { keepOnReload = false }: AsyncOptions = {},
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const seenTick = useRef(tick)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let current = true
    const reloaded = seenTick.current !== tick
    seenTick.current = tick
    setState((previous) => startState(previous, reloaded, keepOnReload))
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
