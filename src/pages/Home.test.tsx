import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { Home } from './Home'

test('while the plan loads, Oggi shows the skeleton and no calendar block, note or alert', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
  expect(html).toContain('Carico la scheda')
  expect(html).not.toContain('In programma oggi')
  expect(html).not.toContain('Da recuperare')
  expect(html).not.toContain('Non riesco')
  expect(html).not.toContain('role="alert"')
})
