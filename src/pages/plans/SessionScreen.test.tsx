import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { PlanExerciseDetail, SessionDetail } from '../../data/activePlan'
import type { Exercise } from '../../types/db'
import { SessionFields } from './SessionFields'
import { SessionRemove } from './SessionRemove'
import { SessionScreen } from './SessionScreen'

const inRouter = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = () => {}

function exercise(id: string): Exercise {
  return { id, owner_id: 'u1', name: `Esercizio ${id}`, equipment: 'barbell', muscles: null, execution_steps: null, notes: null, starting_weight_kg: null, archived: false, catalog_id: null }
}

function row(id: string, overrides: Partial<PlanExerciseDetail> = {}): PlanExerciseDetail {
  return {
    id,
    owner_id: 'u1',
    session_id: 's1',
    exercise_id: `e-${id}`,
    position: 0,
    target_sets: 3,
    target_reps: 8,
    target_unit: 'reps',
    suggested_weight_kg: 20,
    suggested_weight_max_kg: 25,
    exercise: exercise(`e-${id}`),
    ...overrides,
  }
}

test('the session fields prefill name, subtitle and the bonus flag', () => {
  const html = renderToStaticMarkup(
    <SessionFields initial={{ name: 'Full body', subtitle: 'Petto', isOptional: true }} busy={false} error={null} onSubmit={noop} />,
  )
  expect(html).toContain('value="Full body"')
  expect(html).toContain('value="Petto"')
  expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked/)
})

test('removing a session says a logged one is refused', () => {
  const html = renderToStaticMarkup(
    <SessionRemove name="A" busy={false} error="La sessione ha allenamenti nello storico: non si può rimuovere." onRemove={noop} />,
  )
  expect(html).toContain('role="alert"')
  expect(html).toContain('Rimuovi la sessione')
  expect(html).not.toContain('Non rimuovere')
})

test('the session screen shows the header, the bonus tag, the exercises and the ways out', () => {
  const session: SessionDetail = {
    id: 's1',
    owner_id: 'u1',
    plan_id: 'p1',
    name: 'Full body',
    subtitle: null,
    position: 0,
    is_optional: true,
    archived: false,
    exercises: [row('a')],
    warmup: [],
  }
  const html = inRouter(<SessionScreen planId="p1" planName="Forza" session={session} onChange={noop} onRemoved={noop} />)
  expect(html).toContain('href="/plans/p1"')
  expect(html).toContain('‹ Forza')
  expect(html).toContain('Bonus')
  expect(html).toContain('1 esercizio')
  expect(html).toContain('aria-label="Serie di Esercizio e-a"')
  expect(html).toContain('Aggiungi esercizi')
  expect(html).toContain('Rimuovi la sessione')
})
