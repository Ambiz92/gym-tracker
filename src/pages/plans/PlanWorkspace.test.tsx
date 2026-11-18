import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { EditablePlan, SessionDetail } from '../../data/activePlan'
import { PlanSessionEdit } from '../PlanSessionEdit'
import { PlanWorkspace } from './PlanWorkspace'

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

test('at the plan the workspace shows the plan screen', () => {
  const html = renderAt('/plans/p1')
  expect(html).toContain('Forza base')
  expect(html).toContain('href="/plans/p1/sessions/s1"')
  expect(html).not.toContain('Rimuovi la sessione')
})

test('at a session it shows the session editor of the plan it holds', () => {
  const html = renderAt('/plans/p1/sessions/s1')
  expect(html).toContain('Upper body')
  expect(html).toContain('‹ Forza base')
  expect(html).toContain('Rimuovi la sessione')
})

test('a session that is not in the plan says so and leads back to the plan', () => {
  const html = renderAt('/plans/p1/sessions/gone')
  expect(html).toContain('Sessione non trovata.')
  expect(html).toContain('href="/plans/p1"')
})
