import type { AuthFailure } from './errors'
import { failure } from './errors'
import {
  type AuthApi,
  type AuthStatus,
  type Enrollment,
  completeOAuthReturn,
  currentEmail,
  isAal2,
  type Result,
  resolveStatus,
  signIn,
  signInWithGoogle,
  signOut,
  startEnrollment,
  verifyCode,
  verifyEnrollment,
} from './flow'
import type { OAuthReturn } from './oauthReturn'

export interface AuthState {
  status: AuthStatus
  /** Account of the signed-in user; null until it is read and when signed out. */
  email: string | null
  /** Why the return from Google ended in a refusal; read once by the login, then cleared. */
  oauthError: AuthFailure | null
}

/** Actions resolve to `null` on success and to the failure to show otherwise. */
export interface AuthActions {
  signIn(email: string, password: string): Promise<AuthFailure | null>
  signInWithGoogle(): Promise<AuthFailure | null>
  verifyCode(code: string): Promise<AuthFailure | null>
  startEnrollment(): Promise<Result<Enrollment>>
  verifyEnrollment(factorId: string, code: string): Promise<AuthFailure | null>
  signOut(): Promise<AuthFailure | null>
  /** Whether the session is at aal2 right now; null when it cannot be read. */
  isAal2(): Promise<boolean | null>
  clearOauthError(): void
}

export interface AuthController {
  getState(): AuthState
  subscribe(listener: () => void): () => void
  /** Reads the stored session (or finishes the Google return) once, and follows sign-outs; returns the stop function. */
  start(): () => void
  actions: AuthActions
}

interface AuthControllerOptions {
  /** What the provider left in the URL on this page load. */
  oauthReturn: OAuthReturn | null
  /** Where Google sends the browser back. */
  redirectTo: string
  /** How long the first read may take before the user is sent to the login. */
  initialTimeoutMs?: number
}

const INITIAL_TIMEOUT_MS = 10_000

/**
 * The auth state machine without React: AuthProvider only subscribes to it. Starting is idempotent
 * because StrictMode runs effects twice and an authorization code can be exchanged only once.
 */
export function createAuthController(
  api: AuthApi,
  { oauthReturn, redirectTo, initialTimeoutMs = INITIAL_TIMEOUT_MS }: AuthControllerOptions,
): AuthController {
  let state: AuthState = { status: 'loading', email: null, oauthError: null }
  const listeners = new Set<() => void>()
  let started = false

  function update(patch: Partial<AuthState>) {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  function setStatus(status: AuthStatus) {
    if (status === state.status) return
    update({ status, email: null })
    if (status === 'signed_in') {
      void currentEmail(api).then((email) => {
        if (state.status === 'signed_in') update({ email })
      })
    }
  }

  function readInitialState() {
    const read = oauthReturn ? completeOAuthReturn(api, oauthReturn) : resolveStatus(api, 'other')
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<Result<AuthStatus>>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: failure('unavailable') }), initialTimeoutMs)
    })

    // Fail closed: a session that cannot be read, or not in time, sends the user to the login.
    void Promise.race([read, timeout]).then((result) => {
      clearTimeout(timer)
      if (result.ok) return setStatus(result.value)
      if (oauthReturn) update({ oauthError: result.error })
      setStatus('signed_out')
    })
  }

  async function apply(pending: Promise<Result<AuthStatus>>) {
    const result = await pending
    if (!result.ok) return result.error
    setStatus(result.value)
    return null
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (!started) {
        started = true
        readInitialState()
      }
      // supabase-js also signs out on its own (revoked or unrefreshable session, another tab).
      const { data } = api.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') setStatus('signed_out')
      })
      return () => data.subscription.unsubscribe()
    },
    actions: {
      signIn: (email, password) => apply(signIn(api, email, password)),
      signInWithGoogle: async () => {
        const result = await signInWithGoogle(api, redirectTo)
        return result.ok ? null : result.error
      },
      verifyCode: (code) => apply(verifyCode(api, code)),
      startEnrollment: () => startEnrollment(api),
      verifyEnrollment: (factorId, code) => apply(verifyEnrollment(api, factorId, code)),
      signOut: () => apply(signOut(api)),
      isAal2: () => isAal2(api),
      clearOauthError: () => {
        if (state.oauthError) update({ oauthError: null })
      },
    },
  }
}
