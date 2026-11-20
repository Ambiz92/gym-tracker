import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { EditablePlan, SessionDetail } from '../../data/activePlan'
import { PlanSessionEdit } from '../PlanSessionEdit'
import { PlanWorkspace } from './PlanWorkspace'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))

beforeEach(() => {
  desktop = false
})

function session(id: string, name: string): SessionDetail {
  return { id, owner_id: 'u1', plan_id: 'p1', name, subtitle: null, position: 0, is_optional: false, archived: false, exercises: [], warmup: [] }
}

const plan: EditablePlan = {
  id: 'p1',
  owner_id: 'u1',
  name: 'Forza base',
  is_active: true,
  archived: false,
  sessions: [session('s1', 'Upper body')],
  archivedSessions: [],
}

function renderAt(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/plans/:id" element={<PlanWorkspace initial={plan} />}>
          <Route path="sessions/:sessionId" element={<PlanSessionEdit />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('on the phone the plan opens as one screen: the session keys, its exercises and the footer bar', () => {
  const html = renderAt('/plans/p1')
  expect(html).toContain('Forza base')
  expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Upper body<\/button>/)
  expect(html).toContain('aria-label="Aggiungi sessione"')
  expect(html).toContain('+ Aggiungi esercizi')
  expect(html).toContain('1 sessione · 0 esercizi')
  expect(html).toContain('Attiva · compare in Oggi')
  expect(html).not.toContain('href="/plans/p1/sessions/s1"')
})

test('on the phone a session in the address opens first, and an unknown one falls back to the first session', () => {
  const two = { ...plan, sessions: [session('s1', 'Upper body'), session('s2', 'Lower body')] }
  const at = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/plans/:id" element={<PlanWorkspace initial={two} />}>
            <Route path="sessions/:sessionId" element={<PlanSessionEdit />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  expect(at('/plans/p1/sessions/s2')).toMatch(/aria-pressed="true"[^>]*>Lower body</)
  expect(at('/plans/p1/sessions/gone')).toMatch(/aria-pressed="true"[^>]*>Upper body</)
})

test('on desktop a session that is not in the plan says so and leads back to the plan', () => {
  desktop = true
  const html = renderAt('/plans/p1/sessions/gone')
  expect(html).toContain('Sessione non trovata.')
  expect(html).toContain('href="/plans/p1"')
})

test('on desktop the sessions and the session editor sit side by side, the open session marked', () => {
  desktop = true
  const html = renderAt('/plans/p1/sessions/s1')
  expect(html.indexOf('plan-panes__sessions')).toBeLessThan(html.indexOf('plan-panes__editor'))
  expect(html).toContain('Rimuovi la sessione')
  expect(html).toMatch(/aria-current="true"[^>]*href="\/plans\/p1\/sessions\/s1"|href="\/plans\/p1\/sessions\/s1"[^>]*aria-current="true"/)
  expect(html).toContain('plan-row plan-row--selected')
})

test('on desktop without a session open the editor pane invites to pick one', () => {
  desktop = true
  const html = renderAt('/plans/p1')
  expect(html).toContain('href="/plans/p1/sessions/s1"')
  expect(html).toContain('Scegli una sessione')
  expect(html).not.toContain('plan-row--selected')
})
