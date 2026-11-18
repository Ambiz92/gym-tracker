import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { useAuth } from './AuthProvider'
import { stepPath } from './flow'

function Loading() {
  return <p role="status">Caricamento…</p>
}

/** Route guard: only an aal2 session reaches the app; everyone else goes to the step they are on. */
export function RequireAuth() {
  const { status } = useAuth()
  if (status === 'signed_in') return <Outlet />

  const target = stepPath(status)
  if (target === null) {
    return (
      <AuthLayout>
        <Loading />
      </AuthLayout>
    )
  }
  return <Navigate to={target} replace />
}

interface AuthStepProps {
  /** The `stepPath` of the screen this wraps. */
  path: string
  children: ReactNode
}

/** Shows a login screen only while the status belongs to it, otherwise moves on to the right one. */
export function AuthStep({ path, children }: AuthStepProps) {
  const { status } = useAuth()
  const target = stepPath(status)
  if (target === null) return <Loading />
  if (target !== path) return <Navigate to={target} replace />
  return children
}
