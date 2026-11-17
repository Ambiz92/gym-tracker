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

test('links the four tabs and marks only the current one', () => {
  const html = renderAt('/plans')
  for (const href of ['href="/"', 'href="/plans"', 'href="/history"', 'href="/more"']) {
    expect(html).toContain(href)
  }
  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html).toMatch(/aria-current="page"[^>]*>Schede</)
})

test('Oggi is current only on the home route', () => {
  expect(renderAt('/more')).not.toMatch(/aria-current="page"[^>]*>Oggi</)
  expect(renderAt('/')).toMatch(/aria-current="page"[^>]*>Oggi</)
})

test('Storico stays current on an exercise history route', () => {
  expect(renderAt('/history/abc')).toMatch(/aria-current="page"[^>]*>Storico</)
})
