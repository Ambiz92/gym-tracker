import { type AuthErrorLike, type AuthFailure, type AuthStep, classifyError, failure } from './errors'
import type { OAuthReturn } from './oauthReturn'

export type AuthStatus = 'loading' | 'signed_out' | 'needs_mfa' | 'signed_in'

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthFailure }

export interface Enrollment {
  factorId: string
  /** SVG data URI, ready for an <img src>. */
  qrCode: string
  /** Same secret as the QR code, for typing it by hand. */
  secret: string
}

type Reply<T> = Promise<{ data: T | null; error: AuthErrorLike | null }>

/** The slice of supabase-js `auth` this app uses; tests implement it with a fake. */
export interface AuthApi {
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: AuthErrorLike | null }>
  signInWithOAuth(credentials: { provider: 'google'; options: { redirectTo: string; queryParams?: Record<string, string> } }): Promise<{ error: AuthErrorLike | null }>
  exchangeCodeForSession(authCode: string, options?: { flowId?: string }): Promise<{ error: AuthErrorLike | null }>
  signOut(options: { scope: 'local' }): Promise<{ error: AuthErrorLike | null }>
  getSession(): Promise<{ data: { session: { user: { email?: string } } | null }; error: AuthErrorLike | null }>
  onAuthStateChange(callback: (event: string) => void): { data: { subscription: { unsubscribe(): void } } }
  mfa: {
    getAuthenticatorAssuranceLevel(): Reply<{ currentLevel: string | null; nextLevel: string | null }>
    listFactors(): Reply<{ all: { id: string; status: string }[]; totp: { id: string }[] }>
    enroll(params: { factorType: 'totp'; issuer: string }): Reply<{ id: string; totp: { qr_code: string; secret: string } }>
    unenroll(params: { factorId: string }): Promise<{ error: AuthErrorLike | null }>
    challenge(params: { factorId: string }): Reply<{ id: string }>
    verify(params: { factorId: string; challengeId: string; code: string }): Promise<{ error: AuthErrorLike | null }>
    challengeAndVerify(params: { factorId: string; code: string }): Promise<{ error: AuthErrorLike | null }>
  }
}

export const CODE_LENGTH = 6
const ISSUER = 'Gym Tracker'

/** Keeps only the digits of what the user typed or an autofill pasted, capped at the code length. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

/**
 * aal1 needs the code only when a verified factor exists (nextLevel aal2); without one the user is in.
 * The owner's account relies on its factor: if it were ever removed, a password alone would sign in.
 */
export function statusFromAssurance(currentLevel: string | null, nextLevel: string | null): AuthStatus {
  if (currentLevel === 'aal2') return 'signed_in'
  if (currentLevel === 'aal1') return nextLevel === 'aal2' ? 'needs_mfa' : 'signed_in'
  return 'signed_out'
}

/** The screen each status belongs to; `null` while the stored session is still being read. */
export function stepPath(status: AuthStatus): string | null {
  switch (status) {
    case 'loading':
      return null
    case 'signed_out':
      return '/login'
    case 'needs_mfa':
      return '/login/code'
    case 'signed_in':
      return '/'
  }
}

function fail(error: AuthErrorLike, step: AuthStep): { ok: false; error: AuthFailure } {
  return { ok: false, error: classifyError(error, step) }
}

/** A request that throws instead of returning an error is unexpected: report it, never swallow it. */
async function guarded<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run()
  } catch {
    return { ok: false, error: failure('unavailable') }
  }
}

/** Reads the stored session and its assurance level. */
export function resolveStatus(api: AuthApi, step: AuthStep): Promise<Result<AuthStatus>> {
  return guarded(async () => {
    const { data: stored, error: sessionError } = await api.getSession()
    if (sessionError) return fail(sessionError, step)
    if (!stored.session) return { ok: true, value: 'signed_out' }

    const { data, error } = await api.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return fail(error ?? { message: 'Empty assurance level' }, step)
    return { ok: true, value: statusFromAssurance(data.currentLevel, data.nextLevel) }
  })
}

/** Email of the stored session; null without one or when it cannot be read (it is only shown, never relied on). */
export async function currentEmail(api: AuthApi): Promise<string | null> {
  try {
    const { data } = await api.getSession()
    return data.session?.user.email ?? null
  } catch {
    return null
  }
}

/** True at aal2, false below it, null when the level cannot be read: an error is "unknown", never "not verified". */
export async function isAal2(api: AuthApi): Promise<boolean | null> {
  try {
    const { data, error } = await api.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return null
    return data.currentLevel === 'aal2'
  } catch {
    return null
  }
}

export function signIn(api: AuthApi, email: string, password: string): Promise<Result<AuthStatus>> {
  const trimmedEmail = email.trim()
  if (!trimmedEmail || !password) return Promise.resolve({ ok: false, error: failure('invalid_credentials') })

  return guarded(async () => {
    const { error } = await api.signInWithPassword({ email: trimmedEmail, password })
    if (error) return fail(error, 'password')
    return resolveStatus(api, 'password')
  })
}

/**
 * Sends the browser to Google; supabase-js navigates away, so success means the page is about to unload.
 * `select_account` makes Google show the account chooser even when one account is signed in, so a
 * logout from the app does not silently sign the next person in with the previous Google account.
 */
export function signInWithGoogle(api: AuthApi, redirectTo: string): Promise<Result<null>> {
  return guarded(async () => {
    const { error } = await api.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } })
    if (error) return fail(error, 'oauth')
    return { ok: true, value: null }
  })
}

/** Finishes the return from Google: exchanges the PKCE code for a session, or reports the refusal. */
export function completeOAuthReturn(api: AuthApi, returned: OAuthReturn): Promise<Result<AuthStatus>> {
  if ('error' in returned) return Promise.resolve(fail(returned.error, 'oauth'))

  return guarded(async () => {
    const { error } = await api.exchangeCodeForSession(returned.code, { flowId: returned.flowId })
    if (error) return fail(error, 'oauth')
    return resolveStatus(api, 'oauth')
  })
}

function incompleteCode():{ ok: false; error: AuthFailure } {
  return { ok: false, error: failure('invalid_code', `Inserisci le ${CODE_LENGTH} cifre del codice.`) }
}

/** Second factor for a user who already has a verified TOTP factor. */
export function verifyCode(api: AuthApi, rawCode: string): Promise<Result<AuthStatus>> {
  const code = normalizeCode(rawCode)
  if (code.length < CODE_LENGTH) return Promise.resolve(incompleteCode())

  return guarded(async () => {
    const { data, error } = await api.mfa.listFactors()
    if (error || !data) return fail(error ?? { message: 'Empty factor list' }, 'code')
    const factor = data.totp[0]
    if (!factor) return resolveStatus(api, 'code')

    const verified = await api.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (verified.error) return fail(verified.error, 'code')
    return resolveStatus(api, 'code')
  })
}

/** Starts a TOTP enrollment, first dropping factors an earlier abandoned attempt left unverified. */
export function startEnrollment(api: AuthApi): Promise<Result<Enrollment>> {
  return guarded(async () => {
    const { data: factors, error: listError } = await api.mfa.listFactors()
    if (listError || !factors) return fail(listError ?? { message: 'Empty factor list' }, 'other')

    for (const factor of factors.all.filter((f) => f.status !== 'verified')) {
      const { error } = await api.mfa.unenroll({ factorId: factor.id })
      if (error) return fail(error, 'other')
    }

    const { data, error } = await api.mfa.enroll({ factorType: 'totp', issuer: ISSUER })
    if (error || !data) return fail(error ?? { message: 'Empty enrollment' }, 'other')
    return { ok: true, value: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } }
  })
}

/** Confirms the enrollment with the first code; on success the session becomes aal2. */
export function verifyEnrollment(api: AuthApi, factorId: string, rawCode: string): Promise<Result<AuthStatus>> {
  const code = normalizeCode(rawCode)
  if (code.length < CODE_LENGTH) return Promise.resolve(incompleteCode())

  return guarded(async () => {
    const { data, error } = await api.mfa.challenge({ factorId })
    if (error || !data) return fail(error ?? { message: 'Empty challenge' }, 'code')

    const verified = await api.mfa.verify({ factorId, challengeId: data.id, code })
    if (verified.error) return fail(verified.error, 'code')
    return resolveStatus(api, 'code')
  })
}

/** Ends this device's session only; other devices stay signed in. */
export function signOut(api: AuthApi): Promise<Result<AuthStatus>> {
  return guarded(async () => {
    const { error } = await api.signOut({ scope: 'local' })
    if (error) return fail(error, 'other')
    return { ok: true, value: 'signed_out' }
  })
}
