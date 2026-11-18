/** Shape of the errors supabase-js auth returns, narrowed to what the UI needs. */
export interface AuthErrorLike {
  message: string
  name?: string
  status?: number
  code?: string
}

export type AuthFailureKind =
  | 'invalid_credentials'
  | 'invalid_code'
  | 'rate_limited'
  | 'network'
  | 'unavailable'
  | 'session_expired'

export interface AuthFailure {
  kind: AuthFailureKind
  /** Italian text shown to the user. */
  message: string
}

/** Which request failed: decides how a plain client error is read. */
export type AuthStep = 'password' | 'code' | 'other'

const MESSAGES: Record<AuthFailureKind, string> = {
  invalid_credentials: 'Credenziali non valide.',
  invalid_code: 'Codice non valido. Controlla l’app e riprova.',
  rate_limited: 'Troppi tentativi. Attendi un minuto e riprova.',
  network: 'Connessione assente. Controlla la rete e riprova.',
  unavailable: 'Servizio non disponibile. Riprova tra poco.',
  session_expired: 'Sessione scaduta. Torna indietro e accedi di nuovo.',
}

const SESSION_CODES = new Set(['session_not_found', 'session_expired', 'refresh_token_not_found', 'bad_jwt'])

export function failure(kind: AuthFailureKind, message = MESSAGES[kind]): AuthFailure {
  return { kind, message }
}

/**
 * Maps a supabase-js auth error to a user-facing failure. A rejected password is always the
 * generic "Credenziali non valide", so the answer never reveals whether the email exists.
 */
export function classifyError(error: AuthErrorLike, step: AuthStep): AuthFailure {
  if (error.status === 429 || error.code?.endsWith('_rate_limit')) return failure('rate_limited')
  if (error.name === 'AuthRetryableFetchError' && error.status === 0) return failure('network')
  if (error.status !== undefined && error.status >= 500) return failure('unavailable')
  if (error.code && SESSION_CODES.has(error.code)) return failure('session_expired')
  if (step === 'password') return failure('invalid_credentials')
  if (step === 'code') return failure('invalid_code')
  return failure('unavailable')
}
