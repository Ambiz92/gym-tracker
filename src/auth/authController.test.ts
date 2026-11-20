import { afterEach, describe, expect, test, vi } from 'vitest'
import { createAuthController } from './authController'
import { createFakeAuth, EMAIL, GOOGLE_CODE, PASSWORD } from './fakeAuth'
import type { AuthApi } from './flow'

const REDIRECT = 'https://user.github.io/gym-tracker/'

function setup({ enrolled = false, session = null as 'aal1' | 'aal2' | null, oauthReturn = null as Parameters<typeof createAuthController>[1]['oauthReturn'] } = {}) {
  const fake = createFakeAuth({ enrolled })
  if (session) fake.state.session = { aal: session }
  const controller = createAuthController(fake.api, { oauthReturn, redirectTo: REDIRECT, initialTimeoutMs: 50 })
  return { fake, controller }
}

const settled = (controller: ReturnType<typeof createAuthController>) =>
  vi.waitFor(() => expect(controller.getState().status).not.toBe('loading'))

afterEach(() => vi.useRealTimers())

describe('reading the stored session', () => {
  test('starts loading, then follows the stored session', async () => {
    const { controller } = setup({ session: 'aal2', enrolled: true })
    expect(controller.getState().status).toBe('loading')

    controller.start()
    await settled(controller)

    expect(controller.getState().status).toBe('signed_in')
    await vi.waitFor(() => expect(controller.getState().email).toBe(EMAIL))
  })

  test('no session, or an aal1 session that still owes the code, is not signed in', async () => {
    const none = setup()
    none.controller.start()
    await settled(none.controller)
    expect(none.controller.getState().status).toBe('signed_out')

    const halfOpen = setup({ session: 'aal1', enrolled: true })
    halfOpen.controller.start()
    await settled(halfOpen.controller)
    expect(halfOpen.controller.getState().status).toBe('needs_mfa')
  })

  test('a read that throws ends signed out instead of loading forever', async () => {
    const { fake, controller } = setup({ session: 'aal2', enrolled: true })
    fake.state.crash.add('getSession')

    controller.start()
    await settled(controller)

    expect(controller.getState()).toMatchObject({ status: 'signed_out', oauthError: null })
  })

  test('a read that never answers ends signed out after the timeout', async () => {
    vi.useFakeTimers()
    const { fake } = setup()
    const hanging: AuthApi = { ...fake.api, getSession: () => new Promise(() => undefined) }
    const controller = createAuthController(hanging, { oauthReturn: null, redirectTo: REDIRECT, initialTimeoutMs: 50 })

    controller.start()
    expect(controller.getState().status).toBe('loading')
    await vi.advanceTimersByTimeAsync(49)
    expect(controller.getState().status).toBe('loading')
    await vi.advanceTimersByTimeAsync(2)

    expect(controller.getState().status).toBe('signed_out')
  })

  test('an exchange that never answers is reported on the login', async () => {
    vi.useFakeTimers()
    const { fake } = setup()
    const hanging: AuthApi = { ...fake.api, exchangeCodeForSession: () => new Promise(() => undefined) }
    const controller = createAuthController(hanging, { oauthReturn: { code: GOOGLE_CODE }, redirectTo: REDIRECT, initialTimeoutMs: 50 })

    controller.start()
    await vi.advanceTimersByTimeAsync(60)

    expect(controller.getState()).toMatchObject({ status: 'signed_out', oauthError: { kind: 'unavailable' } })
  })
})

describe('the return from Google', () => {
  test('the code is exchanged once even when started twice, as StrictMode does', async () => {
    const { fake, controller } = setup({ oauthReturn: { code: GOOGLE_CODE } })

    const stopFirst = controller.start()
    stopFirst()
    controller.start()
    await settled(controller)

    expect(fake.state.calls.filter((call) => call.startsWith('exchangeCodeForSession'))).toHaveLength(1)
    expect(controller.getState()).toMatchObject({ status: 'signed_in', oauthError: null })
  })

  test('a user whose account has an authenticator still has to give the code', async () => {
    const { controller } = setup({ enrolled: true, oauthReturn: { code: GOOGLE_CODE } })

    controller.start()
    await settled(controller)

    expect(controller.getState().status).toBe('needs_mfa')
  })

  test('a failed exchange ends signed out with the reason', async () => {
    const { fake, controller } = setup({ oauthReturn: { code: 'stale' } })

    controller.start()
    await settled(controller)

    expect(controller.getState()).toMatchObject({ status: 'signed_out', oauthError: { kind: 'oauth_failed' } })
    expect(fake.state.session).toBeNull()
  })

  test('a refused account ends signed out, as not invited, without any request', async () => {
    const { fake, controller } = setup({ oauthReturn: { error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' } } })

    controller.start()
    await settled(controller)

    expect(controller.getState()).toMatchObject({ status: 'signed_out', oauthError: { kind: 'not_invited' } })
    expect(fake.state.calls).toEqual([])
  })

  test('the message is read once: clearing it removes it for good', async () => {
    const { controller } = setup({ oauthReturn: { error: { message: 'x', code: 'signup_disabled' } } })
    const listener = vi.fn()
    controller.start()
    await settled(controller)
    controller.subscribe(listener)

    controller.actions.clearOauthError()
    expect(controller.getState().oauthError).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)

    controller.actions.clearOauthError()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('starting Google sends the browser back to the configured page', async () => {
    const { fake, controller } = setup()

    expect(await controller.actions.signInWithGoogle()).toBeNull()

    expect(fake.state.calls).toEqual([`signInWithOAuth:google:${REDIRECT}`])
  })

  test('a failure to start Google is returned to the button', async () => {
    const { fake, controller } = setup()
    fake.state.fail.signInWithOAuth = { message: 'x', name: 'AuthRetryableFetchError', status: 0 }

    expect(await controller.actions.signInWithGoogle()).toMatchObject({ kind: 'network' })
  })
})

describe('following the session', () => {
  test('a sign-out announced by supabase-js signs out, and stopping unsubscribes', async () => {
    const { fake, controller } = setup({ session: 'aal2', enrolled: true })
    const stop = controller.start()
    await settled(controller)

    fake.emit('SIGNED_OUT')
    expect(controller.getState()).toMatchObject({ status: 'signed_out', email: null })

    await controller.actions.signIn(EMAIL, PASSWORD)
    stop()
    fake.emit('SIGNED_OUT')
    expect(controller.getState().status).toBe('needs_mfa')
  })

  test('listeners hear every change until they unsubscribe', async () => {
    const { controller } = setup()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    controller.start()
    await settled(controller)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    listener.mockClear()
    await controller.actions.signIn(EMAIL, PASSWORD)
    expect(listener).not.toHaveBeenCalled()
  })

  test('a wrong password leaves the state alone and returns the failure', async () => {
    const { controller } = setup()
    controller.start()
    await settled(controller)

    expect(await controller.actions.signIn(EMAIL, 'nope')).toMatchObject({ kind: 'invalid_credentials' })
    expect(controller.getState().status).toBe('signed_out')
  })
})
