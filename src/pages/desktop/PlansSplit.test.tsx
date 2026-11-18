import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { PlansSplit } from './PlansSplit'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))
vi.mock('../Plans', () => ({ Plans: ({ selectedId }: { selectedId?: string }) => <p>{`ELENCO ${selectedId ?? '-'}`}</p> }))

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/plans" element={<PlansSplit />}>
          <Route path=":id" element={<p>EDITOR</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  desktop = false
})

test('on the phone the list and the editor are separate pages', () => {
  expect(renderAt('/plans')).toBe('<p>ELENCO -</p>')
  expect(renderAt('/plans/p1')).toBe('<p>EDITOR</p>')
})

test('on desktop the editor sits beside the list', () => {
  desktop = true
  const html = renderAt('/plans/p1')
  expect(html).toContain('ELENCO')
  expect(html.indexOf('ELENCO')).toBeLessThan(html.indexOf('EDITOR'))
})

test('on desktop without a plan open the detail pane invites to pick one', () => {
  desktop = true
  const html = renderAt('/plans')
  expect(html).toContain('ELENCO')
  expect(html).toContain('Scegli una scheda')
  expect(html).not.toContain('EDITOR')
})

test('on desktop the list knows which plan is open', () => {
  desktop = true
  expect(renderAt('/plans/p1')).toContain('ELENCO p1')
})
