import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthFailure } from './errors'
import {
  type AuthApi,
  type AuthStatus,
  type Enrollment,
  currentEmail,
  type Result,
  resolveStatus,
  signIn,
  signOut,
  startEnrollment,
  verifyCode,
  verifyEnrollment,
} from './flow'

/** Actions resolve to `null` on success and to the failure to show otherwise. */
export interface AuthContextValue {
  status: AuthStatus
  /** Account of the signed-in user; null until it is read and when signed out. */
  email: string | null
  signIn(email: string, password: string): Promise<AuthFailure | null>
  verifyCode(code: string): Promise<AuthFailure | null>
  startEnrollment(): Promise<Result<Enrollment>>
  verifyEnrollment(factorId: string, code: string): Promise<AuthFailure | null>
  signOut(): Promise<AuthFailure | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

interface AuthProviderProps {
  api: AuthApi
  children: ReactNode
}

/** Holds the auth status; the session itself persists through supabase-js (localStorage, auto refresh). */
export function AuthProvider({ api, children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // Fail closed: a session that cannot be read sends the user to the login.
    void resolveStatus(api, 'other').then((result) => {
      if (active) setStatus(result.ok ? result.value : 'signed_out')
    })
    // supabase-js also signs out on its own (revoked or unrefreshable session, another tab).
    const { data } = api.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setStatus('signed_out')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [api])

  useEffect(() => {
    if (status !== 'signed_in') return
    let active = true
    void currentEmail(api).then((value) => {
      if (active) setEmail(value)
    })
    return () => {
      active = false
    }
  }, [api, status])

  const actions = useMemo(() => {
    const apply = async (pending: Promise<Result<AuthStatus>>) => {
      const result = await pending
      if (!result.ok) return result.error
      setStatus(result.value)
      return null
    }
    return {
      signIn: (email: string, password: string) => apply(signIn(api, email, password)),
      verifyCode: (code: string) => apply(verifyCode(api, code)),
      startEnrollment: () => startEnrollment(api),
      verifyEnrollment: (factorId: string, code: string) => apply(verifyEnrollment(api, factorId, code)),
      signOut: () => apply(signOut(api)),
    }
  }, [api])

  const value = useMemo(
    () => ({ status, email: status === 'signed_in' ? email : null, ...actions }),
    [status, email, actions],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
