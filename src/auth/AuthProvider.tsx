import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthFailure } from './errors'
import {
  type AuthApi,
  type AuthStatus,
  type Enrollment,
  completeOAuthReturn,
  currentEmail,
  type Result,
  resolveStatus,
  signIn,
  signInWithGoogle,
  signOut,
  startEnrollment,
  verifyCode,
  verifyEnrollment,
} from './flow'
import { type OAuthReturn, oauthRedirectUrl } from './oauthReturn'

/** Actions resolve to `null` on success and to the failure to show otherwise. */
export interface AuthContextValue {
  status: AuthStatus
  /** Account of the signed-in user; null until it is read and when signed out. */
  email: string | null
  /** Why the return from Google ended in a refusal; cleared by the next action. */
  oauthError: AuthFailure | null
  signIn(email: string, password: string): Promise<AuthFailure | null>
  signInWithGoogle(): Promise<AuthFailure | null>
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
  /** What the provider left in the URL on this page load, read before the router starts. */
  oauthReturn?: OAuthReturn | null
  children: ReactNode
}

/** Holds the auth status; the session itself persists through supabase-js (localStorage, auto refresh). */
export function AuthProvider({ api, oauthReturn = null, children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState<AuthFailure | null>(null)
  const initial = useRef<Promise<Result<AuthStatus>> | null>(null)

  useEffect(() => {
    let active = true
    // Started once: StrictMode runs this effect twice and an authorization code can be exchanged only once.
    initial.current ??= oauthReturn ? completeOAuthReturn(api, oauthReturn) : resolveStatus(api, 'other')
    // Fail closed: a session that cannot be read sends the user to the login.
    void initial.current.then((result) => {
      if (!active) return
      setStatus(result.ok ? result.value : 'signed_out')
      if (!result.ok && oauthReturn) setOauthError(result.error)
    })
    // supabase-js also signs out on its own (revoked or unrefreshable session, another tab).
    const { data } = api.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setStatus('signed_out')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [api, oauthReturn])

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
      setOauthError(null)
      const result = await pending
      if (!result.ok) return result.error
      setStatus(result.value)
      return null
    }
    return {
      signIn: (email: string, password: string) => apply(signIn(api, email, password)),
      signInWithGoogle: async () => {
        setOauthError(null)
        const result = await signInWithGoogle(api, oauthRedirectUrl(window.location.origin, import.meta.env.BASE_URL))
        return result.ok ? null : result.error
      },
      verifyCode: (code: string) => apply(verifyCode(api, code)),
      startEnrollment: () => startEnrollment(api),
      verifyEnrollment: (factorId: string, code: string) => apply(verifyEnrollment(api, factorId, code)),
      signOut: () => apply(signOut(api)),
    }
  }, [api])

  const value = useMemo(
    () => ({ status, email: status === 'signed_in' ? email : null, oauthError, ...actions }),
    [status, email, oauthError, actions],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
