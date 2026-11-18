import type { ReactNode } from 'react'

interface SessionDockProps {
  /** Undo toast, shown above the action. */
  toast?: ReactNode
  children: ReactNode
}

/** Action bar pinned above the tab bar; its live region announces the toast. */
export function SessionDock({ toast, children }: SessionDockProps) {
  return (
    <div className="session-dock">
      <div role="status">{toast}</div>
      {children}
    </div>
  )
}
