import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { AuthLayout } from './AuthLayout'
import { Layout } from './Layout'

function render(ui: ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>)
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

test('AuthLayout has a focusable main landmark and no navigation', () => {
  const html = render(
    <AuthLayout>
      <h1>Accesso</h1>
    </AuthLayout>,
  )
  expect(html).toContain('<main class="app__content" tabindex="-1"><h1>Accesso</h1></main>')
  expect(html).not.toContain('<nav')
})
