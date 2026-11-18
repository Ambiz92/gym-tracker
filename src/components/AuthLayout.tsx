import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/** Signed-out screens: a phone-width column, centred on desktop. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="app app--auth">
      <main className="app__content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
