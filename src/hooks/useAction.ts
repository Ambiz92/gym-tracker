import { useRef, useState } from 'react'

/**
 * Runs one async action at a time: `busy` drives the button, `error` the alert.
 * `describe` turns a failure into the Italian message (`failureMessage` is its fallback).
 */
export function useAction(describe: (cause: unknown, fallback: string) => string) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  /** Resolves true when the action succeeded; a second call while one is in flight is ignored (false). */
  async function run(action: () => Promise<unknown>, failureMessage: string): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (cause) {
      console.error(cause)
      setError(describe(cause, failureMessage))
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { busy, error, run }
}
