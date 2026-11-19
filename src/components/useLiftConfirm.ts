import { useEffect, useRef, useState } from 'react'
import type { SetValues } from '../lib/setFlow'

/** Must equal --ds-duration-lift in tokens.css: the set is confirmed when the CSS lift ends. Change both together. */
export const LIFT_MS = 420

interface LiftConfirmDeps {
  confirm: (values: SetValues) => void
  setLifting: (lifting: boolean) => void
  reducedMotion: () => boolean
}

/**
 * Plays the lift, then confirms the set when it settles. A tap is never lost: with reduced motion the
 * set is confirmed at once, a second tap during the lift is ignored, and settle() confirms what is pending.
 */
export function createLiftConfirm({ confirm, setLifting, reducedMotion }: LiftConfirmDeps) {
  let pending: { values: SetValues; timer: ReturnType<typeof setTimeout> } | null = null

  function settle() {
    if (!pending) return
    const { values, timer } = pending
    clearTimeout(timer)
    pending = null
    setLifting(false)
    confirm(values)
  }

  return {
    start(values: SetValues) {
      if (pending) return
      if (reducedMotion()) {
        confirm(values)
        return
      }
      setLifting(true)
      pending = { values, timer: setTimeout(settle, LIFT_MS) }
    },
    settle,
  }
}

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The lift of the scene before a set is confirmed; leaving the screen mid-lift confirms the set on the way out. */
export function useLiftConfirm(onConfirm: (values: SetValues) => void) {
  const [lifting, setLifting] = useState(false)
  const latest = useRef(onConfirm)
  const [machine] = useState(() =>
    createLiftConfirm({ confirm: (values) => latest.current(values), setLifting, reducedMotion: prefersReducedMotion }),
  )

  useEffect(() => {
    latest.current = onConfirm
  })
  useEffect(() => machine.settle, [machine])

  return { lifting, confirm: machine.start }
}
