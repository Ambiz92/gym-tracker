import { describe, expect, test } from 'vitest'
import { CODE, createFakeAuth, EMAIL, GOOGLE_CODE, PASSWORD } from './fakeAuth'
import {
  type AuthStatus,
  completeOAuthReturn,
  currentEmail,
  normalizeCode,
  resolveStatus,
  signIn,
  signInWithGoogle,
  signOut,
  startEnrollment,
  statusFromAssurance,
  stepPath,
  verifyCode,
  verifyEnrollment,
} from './flow'

const valueOf = <T>(result: { ok: true; value: T } | { ok: false }) => (result.ok ? result.value : null)

describe('statusFromAssurance', () => {
  test.each<[string | null, string | null, AuthStatus]>([
    ['aal2', 'aal2', 'signed_in'],
    ['aal1', 'aal2', 'needs_mfa'],
    ['aal1', 'aal1', 'signed_in'],
    [null, null, 'signed_out'],
  ])('%s -> %s is %s', (current, next, expected) => {
    expect(statusFromAssurance(current, next)).toBe(expected)
  })
})

test('every status maps to its screen, and loading to none', () => {
  expect(stepPath('loading')).toBeNull()
  expect(stepPath('signed_out')).toBe('/login')
  expect(stepPath('needs_mfa')).toBe('/login/code')
  expect(stepPath('signed_in')).toBe('/')
})

test('normalizeCode keeps digits only, up to six', () => {
  expect(normalizeCode('123 456')).toBe('123456')
  expect(normalizeCode('12a-34')).toBe('1234')
  expect(normalizeCode('1234567890')).toBe('123456')
})

describe('resolveStatus', () => {
  test('no stored session is signed out', async () => {
    expect(valueOf(await resolveStatus(createFakeAuth().api, 'other'))).toBe('signed_out')
  })

  test('an aal1 session is told apart by whether a verified factor exists', async () => {
    const withoutFactor = createFakeAuth()
    withoutFactor.state.session = { aal: 'aal1' }
    const withFactor = createFakeAuth({ enrolled: true })
    withFactor.state.session = { aal: 'aal1' }

    expect(valueOf(await resolveStatus(withoutFactor.api, 'other'))).toBe('signed_in')
    expect(valueOf(await resolveStatus(withFactor.api, 'other'))).toBe('needs_mfa')
  })

  test('an abandoned unverified factor does not make the code mandatory', async () => {
    const fake = createFakeAuth()
    fake.state.session = { aal: 'aal1' }
    await startEnrollment(fake.api)

    expect(fake.state.factors).toEqual([{ id: 'f1', status: 'unverified' }])
    expect(valueOf(await resolveStatus(fake.api, 'other'))).toBe('signed_in')
  })

  test('only an aal2 session is signed in', async () => {
    const fake = createFakeAuth({ enrolled: true })
    fake.state.session = { aal: 'aal2' }
    expect(valueOf(await resolveStatus(fake.api, 'other'))).toBe('signed_in')
  })

  test('an unreadable assurance level is a failure, not a login', async () => {
    const fake = createFakeAuth({ enrolled: true })
    fake.state.session = { aal: 'aal2' }
    fake.state.fail.getAuthenticatorAssuranceLevel = { message: 'x', name: 'AuthRetryableFetchError', status: 0 }

    expect(await resolveStatus(fake.api, 'other')).toMatchObject({ ok: false, error: { kind: 'network' } })
  })
})

describe('currentEmail', () => {
  test('is the email of the stored session, and null without one', async () => {
    const { api } = createFakeAuth()
    expect(await currentEmail(api)).toBeNull()
    await signIn(api, EMAIL, PASSWORD)
    expect(await currentEmail(api)).toBe(EMAIL)
  })

  test('is null when the session cannot be read', async () => {
    const { api, state } = createFakeAuth()
    state.crash.add('getSession')
    expect(await currentEmail(api)).toBeNull()
  })
})

describe('signIn', () => {
  test('empty fields fail locally with the generic message, without a request', async () => {
    const fake = createFakeAuth()

    expect(await signIn(fake.api, '  ', PASSWORD)).toMatchObject({ ok: false, error: { kind: 'invalid_credentials' } })
    expect(await signIn(fake.api, EMAIL, '')).toMatchObject({ ok: false, error: { kind: 'invalid_credentials' } })
    expect(fake.state.calls).toEqual([])
  })

  test('an unknown email and a wrong password give the same answer', async () => {
    const fake = createFakeAuth()
    const unknownEmail = await signIn(fake.api, 'someone@example.com', PASSWORD)
    const wrongPassword = await signIn(fake.api, EMAIL, 'nope')

    expect(unknownEmail).toEqual(wrongPassword)
    expect(wrongPassword).toMatchObject({ ok: false, error: { message: 'Credenziali non valide.' } })
    expect(fake.state.session).toBeNull()
  })

  test('the email is trimmed', async () => {
    const fake = createFakeAuth({ enrolled: true })
    expect(valueOf(await signIn(fake.api, ` ${EMAIL} `, PASSWORD))).toBe('needs_mfa')
  })

  test('a correct password asks for the code only when an authenticator is enrolled', async () => {
    const enrolled = createFakeAuth({ enrolled: true })
    const fresh = createFakeAuth()

    expect(valueOf(await signIn(enrolled.api, EMAIL, PASSWORD))).toBe('needs_mfa')
    expect(valueOf(await signIn(fresh.api, EMAIL, PASSWORD))).toBe('signed_in')
  })

  test.each([
    [{ message: 'x', status: 429, code: 'over_request_rate_limit' }, 'rate_limited'],
    [{ message: 'x', name: 'AuthRetryableFetchError', status: 0 }, 'network'],
    [{ message: 'x', status: 500 }, 'unavailable'],
  ])('%j is reported as %s, not as wrong credentials', async (error, kind) => {
    const fake = createFakeAuth()
    fake.state.fail.signInWithPassword = error

    expect(await signIn(fake.api, EMAIL, PASSWORD)).toMatchObject({ ok: false, error: { kind } })
  })

  test('a request that throws is reported as unavailable', async () => {
    const fake = createFakeAuth()
    fake.state.crash.add('signInWithPassword')

    expect(await signIn(fake.api, EMAIL, PASSWORD)).toMatchObject({ ok: false, error: { kind: 'unavailable' } })
  })
})

describe('signInWithGoogle', () => {
  const REDIRECT = 'https://user.github.io/gym-tracker/'

  test('asks Supabase for the Google flow, coming back to the given page', async () => {
    const fake = createFakeAuth()

    expect(await signInWithGoogle(fake.api, REDIRECT)).toEqual({ ok: true, value: null })
    expect(fake.state.calls).toEqual([`signInWithOAuth:google:${REDIRECT}`])
  })

  test('a failing request is reported, not swallowed', async () => {
    const fake = createFakeAuth()
    fake.state.fail.signInWithOAuth = { message: 'x', name: 'AuthRetryableFetchError', status: 0 }
    expect(await signInWithGoogle(fake.api, REDIRECT)).toMatchObject({ ok: false, error: { kind: 'network' } })

    fake.state.crash.add('signInWithOAuth')
    expect(await signInWithGoogle(fake.api, REDIRECT)).toMatchObject({ ok: false, error: { kind: 'unavailable' } })
  })
})

describe('completeOAuthReturn', () => {
  test('a user without a factor is signed in straight after the code exchange', async () => {
    const fake = createFakeAuth()

    expect(valueOf(await completeOAuthReturn(fake.api, { code: GOOGLE_CODE, flowId: 'abc' }))).toBe('signed_in')
    expect(fake.state.calls).toContain(`exchangeCodeForSession:${GOOGLE_CODE}:abc`)
  })

  test('a Google session on an account with an authenticator still asks for the code', async () => {
    const fake = createFakeAuth({ enrolled: true })

    expect(valueOf(await completeOAuthReturn(fake.api, { code: GOOGLE_CODE }))).toBe('needs_mfa')
  })

  test('a code that cannot be exchanged leaves the user signed out, with a message', async () => {
    const fake = createFakeAuth()

    expect(await completeOAuthReturn(fake.api, { code: 'stale' })).toMatchObject({ ok: false, error: { kind: 'oauth_failed' } })
    expect(fake.state.session).toBeNull()
  })

  test('a refused account is reported as not invited, without any request', async () => {
    const fake = createFakeAuth()
    const result = await completeOAuthReturn(fake.api, { error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' } })

    expect(result).toMatchObject({ ok: false, error: { kind: 'not_invited', message: 'Questo account Google non è stato invitato.' } })
    expect(fake.state.calls).toEqual([])
  })

  test('a provider error that is not a refusal gets the generic message', async () => {
    const fake = createFakeAuth()

    expect(await completeOAuthReturn(fake.api, { error: { message: 'access_denied' } })).toMatchObject({ ok: false, error: { kind: 'oauth_failed' } })
  })

  test('an exchange that throws is reported as unavailable', async () => {
    const fake = createFakeAuth()
    fake.state.crash.add('exchangeCodeForSession')

    expect(await completeOAuthReturn(fake.api, { code: GOOGLE_CODE })).toMatchObject({ ok: false, error: { kind: 'unavailable' } })
  })
})

describe('verifyCode', () => {
  async function signedInAtPassword() {
    const fake = createFakeAuth({ enrolled: true })
    await signIn(fake.api, EMAIL, PASSWORD)
    return fake
  }

  test('an incomplete code is refused without a request', async () => {
    const fake = await signedInAtPassword()
    fake.state.calls.length = 0

    expect(await verifyCode(fake.api, '12 34')).toMatchObject({ ok: false, error: { kind: 'invalid_code' } })
    expect(fake.state.calls).toEqual([])
  })

  test('a wrong code keeps the session at aal1', async () => {
    const fake = await signedInAtPassword()

    expect(await verifyCode(fake.api, '000000')).toMatchObject({ ok: false, error: { kind: 'invalid_code' } })
    expect(valueOf(await resolveStatus(fake.api, 'other'))).toBe('needs_mfa')
  })

  test('the right code, even typed with a space, makes the session aal2', async () => {
    const fake = await signedInAtPassword()

    expect(valueOf(await verifyCode(fake.api, '123 456'))).toBe('signed_in')
    expect(fake.state.calls).toContain(`challengeAndVerify:f0:${CODE}`)
  })

  test('rate limiting on the code is reported as such', async () => {
    const fake = await signedInAtPassword()
    fake.state.fail.challengeAndVerify = { message: 'x', status: 429, code: 'over_request_rate_limit' }

    expect(await verifyCode(fake.api, CODE)).toMatchObject({ ok: false, error: { kind: 'rate_limited' } })
  })
})

describe('enrollment', () => {
  test('voluntary: signed in without a factor, enroll, first code, and the next login asks for it', async () => {
    const fake = createFakeAuth()
    expect(valueOf(await signIn(fake.api, EMAIL, PASSWORD))).toBe('signed_in')

    const started = await startEnrollment(fake.api)
    expect(started).toEqual({
      ok: true,
      value: { factorId: 'f1', qrCode: 'data:image/svg+xml;utf-8,<svg id="f1"/>', secret: 'SECRET-f1' },
    })
    expect(fake.state.calls).toContain('enroll:totp:Gym Tracker')

    expect(valueOf(await verifyEnrollment(fake.api, 'f1', CODE))).toBe('signed_in')

    await signOut(fake.api)
    expect(valueOf(await signIn(fake.api, EMAIL, PASSWORD))).toBe('needs_mfa')
  })

  test('a wrong first code leaves the enrollment open for a retry', async () => {
    const fake = createFakeAuth()
    await signIn(fake.api, EMAIL, PASSWORD)
    await startEnrollment(fake.api)

    expect(await verifyEnrollment(fake.api, 'f1', '000000')).toMatchObject({ ok: false, error: { kind: 'invalid_code' } })
    expect(fake.state.factors).toEqual([{ id: 'f1', status: 'unverified' }])
    expect(valueOf(await verifyEnrollment(fake.api, 'f1', CODE))).toBe('signed_in')
  })

  test('an abandoned attempt is replaced, not piled up', async () => {
    const fake = createFakeAuth()
    await signIn(fake.api, EMAIL, PASSWORD)
    await startEnrollment(fake.api)
    await startEnrollment(fake.api)

    expect(fake.state.factors).toEqual([{ id: 'f2', status: 'unverified' }])
  })

  test('an incomplete first code is refused without a request', async () => {
    const fake = createFakeAuth()
    await signIn(fake.api, EMAIL, PASSWORD)
    await startEnrollment(fake.api)
    fake.state.calls.length = 0

    expect(await verifyEnrollment(fake.api, 'f1', '123')).toMatchObject({ ok: false, error: { kind: 'invalid_code' } })
    expect(fake.state.calls).toEqual([])
  })

  test('a failing enroll request is reported, with no half-built enrollment', async () => {
    const fake = createFakeAuth()
    fake.state.fail.enroll = { message: 'x', status: 422, code: 'too_many_enrolled_mfa_factors' }

    expect(await startEnrollment(fake.api)).toMatchObject({ ok: false, error: { kind: 'unavailable' } })
  })
})

describe('signOut', () => {
  test('ends the session and goes back to signed out', async () => {
    const fake = createFakeAuth({ enrolled: true })
    await signIn(fake.api, EMAIL, PASSWORD)
    await verifyCode(fake.api, CODE)

    expect(valueOf(await signOut(fake.api))).toBe('signed_out')
    expect(valueOf(await resolveStatus(fake.api, 'other'))).toBe('signed_out')
  })

  test('a failing sign-out is reported', async () => {
    const fake = createFakeAuth()
    fake.state.fail.signOut = { message: 'x', name: 'AuthRetryableFetchError', status: 0 }

    expect(await signOut(fake.api)).toMatchObject({ ok: false, error: { kind: 'network' } })
  })
})

test('a returning user: password, code, signed in, sign out, and the next login asks again', async () => {
  const fake = createFakeAuth({ enrolled: true })

  expect(valueOf(await signIn(fake.api, EMAIL, PASSWORD))).toBe('needs_mfa')
  expect(valueOf(await verifyCode(fake.api, CODE))).toBe('signed_in')
  expect(valueOf(await signOut(fake.api))).toBe('signed_out')
  expect(valueOf(await signIn(fake.api, EMAIL, PASSWORD))).toBe('needs_mfa')
})
