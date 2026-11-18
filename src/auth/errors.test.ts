import { expect, test } from 'vitest'
import { classifyError } from './errors'

test('a rejected password is the generic message, whatever the server says about the email', () => {
  const wrongPassword = classifyError({ message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' }, 'password')
  const unconfirmed = classifyError({ message: 'Email not confirmed', status: 400, code: 'email_not_confirmed' }, 'password')
  const banned = classifyError({ message: 'User is banned', status: 400, code: 'user_banned' }, 'password')

  expect(wrongPassword).toEqual({ kind: 'invalid_credentials', message: 'Credenziali non valide.' })
  expect(unconfirmed).toEqual(wrongPassword)
  expect(banned).toEqual(wrongPassword)
})

test('rate limits are told apart from wrong credentials, by status or by code', () => {
  expect(classifyError({ message: 'x', status: 429 }, 'password').kind).toBe('rate_limited')
  expect(classifyError({ message: 'x', status: 400, code: 'over_request_rate_limit' }, 'code').kind).toBe('rate_limited')
  expect(classifyError({ message: 'x', status: 400, code: 'over_email_send_rate_limit' }, 'password').kind).toBe('rate_limited')
})

test('a failed fetch is a network error, a gateway error is the service being unavailable', () => {
  expect(classifyError({ message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 }, 'password').kind).toBe('network')
  expect(classifyError({ message: 'x', name: 'AuthRetryableFetchError', status: 503 }, 'password').kind).toBe('unavailable')
  expect(classifyError({ message: 'x', status: 500 }, 'code').kind).toBe('unavailable')
})

test('a wrong or expired code is an invalid code', () => {
  expect(classifyError({ message: 'x', status: 400, code: 'mfa_verification_failed' }, 'code').kind).toBe('invalid_code')
  expect(classifyError({ message: 'x', status: 400, code: 'mfa_challenge_expired' }, 'code').kind).toBe('invalid_code')
})

test('an expired session is reported as such on any step', () => {
  expect(classifyError({ message: 'x', status: 401, code: 'session_not_found' }, 'code').kind).toBe('session_expired')
})

test('an unexpected client error outside the login steps is not blamed on the user', () => {
  expect(classifyError({ message: 'x', status: 422, code: 'too_many_enrolled_mfa_factors' }, 'other').kind).toBe('unavailable')
})
