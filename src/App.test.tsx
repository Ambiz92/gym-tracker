import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { AppRoutes } from './App'
import { AuthContext } from './auth/AuthProvider'
import type { AuthStatus } from './auth/flow'

// App() builds the provider from the real client, which needs env vars; these tests render AppRoutes only.
vi.mock('./lib/supabase', () => ({ supabase: { auth: {} } }))

function renderAt(path: string, status: AuthStatus = 'signed_in') {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{ status, signIn: unused, verifyCode: unused, startEnrollment: unused, verifyEnrollment: unused, signOut: unused }}
    >
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

test.each([
  ['/login', 'signed_out', 'Entra.'],
  ['/login/code', 'needs_mfa', 'Il codice.'],
  ['/login/enroll', 'needs_enroll', 'Collega l’app.'],
] as const)('%s renders in the auth layout: a main landmark, no navigation', (path, status, title) => {
  const html = renderAt(path, status)
  expect(html).toContain('<main')
  expect(html).toContain(title)
  expect(html).not.toContain('<nav')
})

test.each([
  ['signed_out', '/'],
  ['needs_mfa', '/more'],
  ['needs_enroll', '/plans'],
] as const)('%s never shows the app at %s', (status, path) => {
  const html = renderAt(path, status)
  expect(html).not.toContain('<nav')
  expect(html).not.toContain('<main')
})

test('while the stored session is read, the app shows a status line and no screen', () => {
  const html = renderAt('/', 'loading')
  expect(html).toContain('Caricamento')
  expect(html).not.toContain('<nav')
})

test('a login screen is not shown to a user it does not belong to', () => {
  expect(renderAt('/login', 'needs_mfa')).not.toContain('Entra.')
  expect(renderAt('/login/code', 'signed_out')).not.toContain('Il codice.')
})

test.each(['/', '/session/1', '/plans', '/plans/1', '/exercises', '/history', '/history/1', '/more'])(
  '%s renders in the app layout: a main landmark and the navigation',
  (path) => {
    const html = renderAt(path)
    expect(html).toContain('<main')
    expect(html).toContain('<nav')
  },
)

test('an unknown path renders the not-found page inside the layout with a link back to Oggi', () => {
  const html = renderAt('/nope/at/all')
  expect(html).toContain('Pagina non trovata')
  expect(html).toContain('<nav')
  expect(html).toContain('href="/"')
  expect(html).toContain('Torna a Oggi')
})
