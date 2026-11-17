import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

interface LayoutProps {
  children: ReactNode
}

/** Phone-width column: page content above the bottom tab bar. */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <main className="app__content">{children}</main>
      <TabBar />
    </div>
  )
}
