import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { TabBar } from './TabBar'

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  )
}

test('links the five tabs and marks only the current one', () => {
  const html = renderAt('/plans')
  for (const href of ['href="/"', 'href="/calendar"', 'href="/plans"', 'href="/history"', 'href="/more"']) {
    expect(html).toContain(href)
  }
  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html).toMatch(/aria-current="page"[^>]*>Schede</)
})

test('Calendario is current on its route only', () => {
  expect(renderAt('/calendar')).toMatch(/aria-current="page"[^>]*>Calendario</)
  expect(renderAt('/calendar').match(/aria-current="page"/g)).toHaveLength(1)
  expect(renderAt('/')).not.toMatch(/aria-current="page"[^>]*>Calendario</)
})

test('Oggi is current only on the home route', () => {
  expect(renderAt('/more')).not.toMatch(/aria-current="page"[^>]*>Oggi</)
  expect(renderAt('/')).toMatch(/aria-current="page"[^>]*>Oggi</)
})

test('Storico stays current on an exercise history route', () => {
  expect(renderAt('/history/abc')).toMatch(/aria-current="page"[^>]*>Storico</)
})

test('Schede stays current on the exercise library and on a plan', () => {
  expect(renderAt('/exercises')).toMatch(/aria-current="page"[^>]*>Schede</)
  expect(renderAt('/plans/p1/sessions/s1')).toMatch(/aria-current="page"[^>]*>Schede</)
  expect(renderAt('/exercises').match(/aria-current="page"/g)).toHaveLength(1)
})

test('a route that only starts with a tab path does not light it up', () => {
  expect(renderAt('/plansible')).not.toContain('aria-current')
})
