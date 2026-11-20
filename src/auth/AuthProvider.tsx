import { createContext, type ReactNode, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { type AuthActions, createAuthController, type AuthState } from './authController'
import type { AuthApi } from './flow'
import { type OAuthReturn, oauthRedirectUrl } from './oauthReturn'

export type AuthContextValue = AuthState & AuthActions

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

/** Shows the auth controller's state; the session itself persists through supabase-js (localStorage, auto refresh). */
export function AuthProvider({ api, oauthReturn = null, children }: AuthProviderProps) {
  // Built without side effects (StrictMode may build two); `start` does the work, once.
  const [controller] = useState(() =>
    createAuthController(api, {
      oauthReturn,
      redirectTo: oauthRedirectUrl(window.location.origin, import.meta.env.BASE_URL),
    }),
  )
  useEffect(() => controller.start(), [controller])

  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const value = useMemo(() => ({ ...state, ...controller.actions }), [state, controller])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
