// Test double for the supabase auth surface (see AuthApi): a tiny in-memory account. No network.

import type { AuthErrorLike } from './errors'
import type { AuthApi } from './flow'

export const EMAIL = 'me@example.com'
export const PASSWORD = 'correct horse'
export const CODE = '123456'

interface Factor {
  id: string
  status: 'verified' | 'unverified'
}

type Method = 'signInWithPassword' | 'getSession' | 'getAuthenticatorAssuranceLevel' | 'listFactors' | 'enroll' | 'unenroll' | 'challenge' | 'verify' | 'challengeAndVerify' | 'signOut'

/** `enrolled` starts the account with a verified authenticator; `fail` makes one method return an error, `crash` throw. */
export function createFakeAuth({ enrolled = false }: { enrolled?: boolean } = {}) {
  let nextFactor = 1
  const state = {
    session: null as { aal: 'aal1' | 'aal2' } | null,
    factors: (enrolled ? [{ id: 'f0', status: 'verified' }] : []) as Factor[],
    calls: [] as string[],
    fail: {} as Partial<Record<Method, AuthErrorLike>>,
    crash: new Set<Method>(),
    listener: null as ((event: string) => void) | null,
  }

  const badCode: AuthErrorLike = { message: 'Invalid TOTP code entered', name: 'AuthApiError', status: 400, code: 'mfa_verification_failed' }
  const verified = () => state.factors.filter((f) => f.status === 'verified')

  function enter(method: Method, detail = '') {
    state.calls.push(detail ? `${method}:${detail}` : method)
    if (state.crash.has(method)) throw new Error(`${method} crashed`)
    return state.fail[method] ?? null
  }

  function verifyFactor(factorId: string, code: string) {
    const factor = state.factors.find((f) => f.id === factorId)
    if (!factor || code !== CODE) return badCode
    factor.status = 'verified'
    state.session = { aal: 'aal2' }
    return null
  }

  const api: AuthApi = {
    async signInWithPassword({ email, password }) {
      const injected = enter('signInWithPassword', email)
      if (injected) return { error: injected }
      if (email !== EMAIL || password !== PASSWORD) {
        return { error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400, code: 'invalid_credentials' } }
      }
      state.session = { aal: 'aal1' }
      return { error: null }
    },
    async signOut() {
      const injected = enter('signOut')
      if (injected) return { error: injected }
      state.session = null
      return { error: null }
    },
    async getSession() {
      const injected = enter('getSession')
      return { data: { session: state.session }, error: injected }
    },
    onAuthStateChange(callback) {
      state.listener = callback
      return { data: { subscription: { unsubscribe: () => (state.listener = null) } } }
    },
    mfa: {
      async getAuthenticatorAssuranceLevel() {
        const injected = enter('getAuthenticatorAssuranceLevel')
        if (injected) return { data: null, error: injected }
        if (!state.session) return { data: { currentLevel: null, nextLevel: null }, error: null }
        return { data: { currentLevel: state.session.aal, nextLevel: verified().length ? 'aal2' : 'aal1' }, error: null }
      },
      async listFactors() {
        const injected = enter('listFactors')
        if (injected) return { data: null, error: injected }
        return { data: { all: [...state.factors], totp: verified() }, error: null }
      },
      async enroll(params) {
        const injected = enter('enroll', `${params.factorType}:${params.issuer}`)
        if (injected) return { data: null, error: injected }
        const id = `f${nextFactor++}`
        state.factors.push({ id, status: 'unverified' })
        return { data: { id, totp: { qr_code: `data:image/svg+xml;utf-8,<svg id="${id}"/>`, secret: `SECRET-${id}` } }, error: null }
      },
      async unenroll({ factorId }) {
        const injected = enter('unenroll', factorId)
        if (injected) return { error: injected }
        state.factors = state.factors.filter((f) => f.id !== factorId)
        return { error: null }
      },
      async challenge({ factorId }) {
        const injected = enter('challenge', factorId)
        if (injected) return { data: null, error: injected }
        return { data: { id: `c-${factorId}` }, error: null }
      },
      async verify({ factorId, challengeId, code }) {
        const injected = enter('verify', `${factorId}:${challengeId}:${code}`)
        return { error: injected ?? verifyFactor(factorId, code) }
      },
      async challengeAndVerify({ factorId, code }) {
        const injected = enter('challengeAndVerify', `${factorId}:${code}`)
        return { error: injected ?? verifyFactor(factorId, code) }
      },
    },
  }

  return { api, state, emit: (event: string) => state.listener?.(event) }
}
