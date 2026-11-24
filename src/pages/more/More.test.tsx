import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../../auth/AuthProvider'
import { LinksStub } from '../coach/fakeLinks'
import { More } from '../More'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))

beforeEach(() => {
  desktop = false
})

function renderMore(email: string | null = null) {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{ status: 'signed_in', email, oauthError: null, clearOauthError: () => undefined, signIn: unused, signInWithGoogle: unused, verifyCode: unused, startEnrollment: unused, verifyEnrollment: unused, signOut: unused }}
    >
      <LinksStub>
        <More />
      </LinksStub>
    </AuthContext.Provider>,
  )
}

test('Altro offers both exports, the theme switch with Auto selected, and keeps the logout button', () => {
  const html = renderMore()
  expect(html).toContain('Esporta CSV')
  expect(html).toContain('Esporta JSON')
  expect(html).toContain('<button type="button" class="segmented__option" aria-pressed="true">Auto</button>')
  expect(html).toContain('aria-pressed="false">Chiaro</button>')
  expect(html).toContain('aria-pressed="false">Scuro</button>')
  expect(html).toContain('Esci')
})

test('Altro starts without a download list or an error', () => {
  const html = renderMore()
  expect(html).not.toContain('Pronto')
  expect(html).not.toContain('role="alert"')
})

test('on desktop Altro shows the account email and the second factor', () => {
  desktop = true
  const html = renderMore('nome@esempio.it')
  expect(html).toContain('<span>nome@esempio.it</span>')
  expect(html).toContain('Authenticator attivo')
})

test('on the phone Altro keeps the header and the account as they were', () => {
  const html = renderMore('nome@esempio.it')
  expect(html).not.toContain('nome@esempio.it')
  expect(html).not.toContain('Authenticator attivo')
})
