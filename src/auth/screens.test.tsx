import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as PrimaryButtonModule from '../components/PrimaryButton'
import { Login } from '../pages/Login'
import { MfaChallenge } from '../pages/MfaChallenge'
import { MfaEnroll } from '../pages/MfaEnroll'
import { LinksStub } from '../pages/coach/fakeLinks'
import { More } from '../pages/More'
import { AuthContext, type AuthContextValue } from './AuthProvider'
import { CodeForm } from './CodeForm'
import { classifyError } from './errors'

function render(ui: ReactElement, overrides: Partial<AuthContextValue> = {}) {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{
        status: 'signed_out',
        email: null,
        oauthError: null,
        clearOauthError: () => undefined,
        signIn: unused,
        signInWithGoogle: unused,
        verifyCode: unused,
        startEnrollment: unused,
        verifyEnrollment: unused,
        signOut: unused,
        isAal2: unused,
        ...overrides,
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('login offers autofill-friendly email and password fields and no sign-up path', () => {
  const html = render(<Login />)
  expect(html).toContain('autoComplete="username"')
  expect(html).toContain('type="email"')
  expect(html).toContain('type="password"')
  expect(html).toContain('autoComplete="current-password"')
  expect(html).toContain('Accedi')
  expect(html.toLowerCase()).not.toMatch(/registr|crea (un )?account|sign.?up/)
})

test('login offers Google as a plain text button, next to the password form and not submitting it', () => {
  const html = render(<Login />)
  expect(html).toMatch(/<button type="button"[^>]*>(?:(?!<\/button>).)*Continua con Google/)
  expect(html).toContain('Accedi')
  expect(html).not.toMatch(/<(svg|img)/)
})

test('a refused Google account is explained on the login, as an alert', () => {
  const oauthError = classifyError({ message: 'Signups not allowed for this instance', code: 'signup_disabled' }, 'oauth')
  const html = render(<Login />, { oauthError })
  expect(html).toContain('role="alert"')
  expect(html).toContain('Questo account Google non è stato invitato.')
})

test('the login shows no alert before anything went wrong', () => {
  expect(render(<Login />)).not.toContain('role="alert"')
})

test('the code step asks for a numeric one-time code and offers a way back', () => {
  const html = render(<MfaChallenge />)
  expect(html).toContain('autoComplete="one-time-code"')
  expect(html).toContain('inputMode="numeric"')
  expect(html).toContain('Conferma')
  expect(html).toContain('Indietro')
})

describe('the back button of the code form', () => {
  const buttons: Record<string, (() => void) | undefined> = {}

  beforeEach(() => {
    for (const key of Object.keys(buttons)) delete buttons[key]
    vi.spyOn(PrimaryButtonModule, 'PrimaryButton').mockImplementation(({ children, onClick }) => {
      buttons[String(children)] = onClick
      return <></>
    })
  })
  afterEach(() => vi.restoreAllMocks())

  test('signs out by default: it leaves the half-open session of the login', () => {
    const signOut = vi.fn(() => Promise.resolve(null))
    render(<CodeForm onSubmit={() => Promise.resolve(null)} />, { signOut })

    buttons.Indietro?.()

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('uses the given action instead, so a signed-in user is not signed out', () => {
    const signOut = vi.fn(() => Promise.resolve(null))
    const onBack = vi.fn()
    render(<CodeForm onSubmit={() => Promise.resolve(null)} onBack={onBack} />, { signOut })

    buttons.Indietro?.()

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(signOut).not.toHaveBeenCalled()
  })
})

test('the enrollment starts with a button, creating nothing until it is tapped, and is optional', () => {
  const html = render(<MfaEnroll />)
  expect(html).toContain('Mostra il codice QR')
  expect(html).toContain('Facoltativo')
  expect(html).not.toContain('<img')
})

test('the Altro page carries the logout button', () => {
  expect(render(
    <LinksStub>
      <More />
    </LinksStub>,
  )).toContain('Esci')
})
