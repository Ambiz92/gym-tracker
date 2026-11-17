import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Login } from '../pages/Login'
import { MfaChallenge } from '../pages/MfaChallenge'
import { MfaEnroll } from '../pages/MfaEnroll'
import { More } from '../pages/More'
import { AuthContext } from './AuthProvider'

function render(ui: ReactElement) {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{ status: 'signed_out', signIn: unused, verifyCode: unused, startEnrollment: unused, verifyEnrollment: unused, signOut: unused }}
    >
      {ui}
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

test('the code step asks for a numeric one-time code and offers a way back', () => {
  const html = render(<MfaChallenge />)
  expect(html).toContain('autoComplete="one-time-code"')
  expect(html).toContain('inputMode="numeric"')
  expect(html).toContain('Conferma')
  expect(html).toContain('Indietro')
})

test('the enrollment starts with a button, creating nothing until it is tapped', () => {
  const html = render(<MfaEnroll />)
  expect(html).toContain('Mostra il codice QR')
  expect(html).not.toContain('<img')
})

test('the Altro page carries the logout button', () => {
  expect(render(<More />)).toContain('Esci')
})
