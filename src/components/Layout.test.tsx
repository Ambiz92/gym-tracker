import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { AuthContext } from '../auth/AuthProvider'
import { AuthLayout } from './AuthLayout'
import { Layout } from './Layout'

function render(ui: ReactElement, email: string | null = null) {
  const unused = () => Promise.reject(new Error('not used when rendering'))
  return renderToStaticMarkup(
    <AuthContext.Provider
      value={{ status: 'signed_in', email, signIn: unused, verifyCode: unused, startEnrollment: unused, verifyEnrollment: unused, signOut: unused }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('Layout wraps the page in a focusable main landmark above the navigation', () => {
  const html = render(
    <Layout>
      <h1>Pagina</h1>
    </Layout>,
  )
  expect(html).toContain('<main class="app__content" tabindex="-1"><h1>Pagina</h1></main>')
  expect(html.indexOf('<main')).toBeLessThan(html.indexOf('<nav'))
})

test('Layout puts the brand and the main tabs in the sidebar wrapper after the page', () => {
  const html = render(<Layout>Pagina</Layout>)
  expect(html).toContain('<div class="sidebar"><p class="sidebar__brand">Gym Tracker</p><nav')
  expect(html.match(/<nav/g)).toHaveLength(1)
})

test('the sidebar footer shows the signed-in email above the logout action', () => {
  const html = render(<Layout>Pagina</Layout>, 'nome@esempio.it')
  expect(html).toContain('<strong class="sidebar__email">nome@esempio.it</strong>')
  expect(html.indexOf('nome@esempio.it')).toBeLessThan(html.indexOf('>Esci<'))
})

test('the sidebar footer keeps the logout action while the email is not known', () => {
  const html = render(<Layout>Pagina</Layout>)
  expect(html).not.toContain('sidebar__email')
  expect(html).toContain('>Esci<')
})

test('AuthLayout has a focusable main landmark and no navigation', () => {
  const html = render(
    <AuthLayout>
      <h1>Accesso</h1>
    </AuthLayout>,
  )
  expect(html).toContain('<main class="app__content" tabindex="-1"><h1>Accesso</h1></main>')
  expect(html).not.toContain('<nav')
})
