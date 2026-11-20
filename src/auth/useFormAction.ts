import { useRef, useState } from 'react'
import type { AuthFailure } from './errors'

/** Runs one auth request at a time: `busy` drives the button, `error` the alert (which may start non-empty). */
export function useFormAction(initialError: string | null = null) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const inFlight = useRef(false)

  async function run(action: () => Promise<AuthFailure | null>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      setError((await action())?.message ?? null)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return { busy, error, run }
}
