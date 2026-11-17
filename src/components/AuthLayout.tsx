import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/** Phone-width column without navigation, for the signed-out screens. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="app">
      <main className="app__content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
