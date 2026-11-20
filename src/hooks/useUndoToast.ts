import { useCallback, useEffect, useRef, useState } from 'react'

const UNDO_TOAST_MS = 6000

interface Toast {
  message: string
  onUndo: () => void
}

/** One Undo toast at a time that goes away by itself: a new one replaces the old. */
export function useUndoToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setToast(null)
  }, [])

  const show = useCallback(
    (message: string, onUndo: () => void) => {
      dismiss()
      setToast({ message, onUndo })
      timer.current = setTimeout(() => setToast(null), UNDO_TOAST_MS)
    },
    [dismiss],
  )

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return { toast, show, dismiss }
}
