import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { AppRoutes } from './App'

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

test('login renders in the auth layout: a main landmark, no navigation', () => {
  const html = renderAt('/login')
  expect(html).toContain('<main')
  expect(html).not.toContain('<nav')
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
