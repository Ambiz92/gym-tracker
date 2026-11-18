import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

/** Page content with the main navigation: a phone-width column with a bottom tab bar, a sidebar on desktop. */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <main className="app__content" tabIndex={-1}>{children}</main>
      <Sidebar />
    </div>
  )
}
