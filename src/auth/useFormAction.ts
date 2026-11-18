import { useRef, useState } from 'react'
import type { AuthFailure } from './errors'

/** Runs one auth request at a time: `busy` drives the button, `error` the alert. */
export function useFormAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
