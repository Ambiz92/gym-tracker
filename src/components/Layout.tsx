import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
  /** The user coaches at least one active athlete: the navigation adds the Atleti tab. */
  hasAthletes?: boolean
}

/** Page content with the main navigation: a phone-width column with a bottom tab bar, a sidebar on desktop. */
export function Layout({ children, hasAthletes = false }: LayoutProps) {
  return (
    <div className="app">
      <main className="app__content" tabIndex={-1}>{children}</main>
      <Sidebar hasAthletes={hasAthletes} />
    </div>
  )
}
