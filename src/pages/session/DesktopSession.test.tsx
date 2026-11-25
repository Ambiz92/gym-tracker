import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { DesktopSession } from './DesktopSession'
import type { LoadedSession } from './loadSession'
import type { PlanExerciseDetail } from '../../data/activePlan'
import type { SetLog } from '../../types/db'

function planExercise(id: string, name: string): PlanExerciseDetail {
  return {
    id: `pe-${id}`,
    owner_id: 'o',
    session_id: 's1',
    exercise_id: id,
    position: 0,
    target_sets: 3,
    target_reps: 10,
    target_unit: 'reps',
    suggested_weight_kg: 20,
    suggested_weight_max_kg: null,
    exercise: {
      id,
      owner_id: 'o',
      name,
      equipment: 'barbell',
      muscles: 'Bicipiti',
      execution_steps: '1. Gomiti fermi\n2. Scendi piano',
      notes: null,
      starting_weight_kg: null,
      archived: false,
      catalog_id: null,
    },
  }
}

const lastSet = (setNumber: number): SetLog => ({
  id: `l${setNumber}`,
  owner_id: 'o',
  workout_id: 'w',
  exercise_id: 'e2',
  set_number: setNumber,
  reps: 10,
  weight_kg: 25,
  equipment_used: 'barbell',
  rpe: null,
})
// Out of order on purpose: the table lists them by set number.
const lastCurl = [lastSet(2), lastSet(1)]

function loaded(warmup: LoadedSession['session']['warmup'] = []): LoadedSession {
  return {
    plan: { id: 'p', owner_id: 'o', name: 'Forza base', is_active: true, archived: false, sessions: [] },
    session: {
      id: 's1',
      owner_id: 'o',
      plan_id: 'p',
      name: 'Upper body',
      subtitle: null,
      position: 0,
      is_optional: false,
      archived: false,
      exercises: [planExercise('e1', 'Panca piana'), planExercise('e2', 'Curl con bilanciere')],
      warmup,
    },
    lastSets: new Map([['e2', lastCurl]]),
    lastDates: new Map([['e2', '2026-11-13']]),
    recentSets: new Map(),
  }
}

function renderAt(url: string, data = loaded()) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <DesktopSession loaded={data} />
    </MemoryRouter>,
  )
}

test('lists the exercises with sets and reps only, and no logging control', () => {
  const html = renderAt('/session/s1')
  expect(html).toContain('Sola lettura')
  expect(html).toContain('Panca piana')
  expect(html).toContain('3×10')
  expect(html).not.toContain('kg ·')
  expect(html).not.toContain('Termina sessione')
  expect(html).not.toContain('<button')
})

test('opens the first exercise by default and marks it as the selection', () => {
  const html = renderAt('/session/s1')
  expect(html).toMatch(/aria-current="true"[^>]*><span[^>]*>Panca piana/)
  expect(html).toContain('<h2 id="exercise-detail-title" class="exercise-detail__title">Panca piana</h2>')
})

test('shows the selected exercise with its steps and the sets of the last workout', () => {
  const html = renderAt('/session/s1?es=e2')
  expect(html).toContain('Curl con bilanciere</h2>')
  expect(html).toContain('<li>Gomiti fermi</li>')
  expect(html).toContain('Ultima volta · 13 nov')
  expect(html).toContain('12,5')
  expect(html.indexOf('<td>1</td>')).toBeLessThan(html.indexOf('<td>2</td>'))
})

test('an unknown exercise falls back to the first one', () => {
  expect(renderAt('/session/s1?es=nope')).toContain('Panca piana</h2>')
})

test('says so when an exercise was never done', () => {
  expect(renderAt('/session/s1?es=e1')).toContain('Prima volta con questo esercizio.')
})

test('the warm-up is the first item and opens its movements', () => {
  const data = loaded([{ id: 'w1', owner_id: 'o', session_id: 's1', position: 0, name: 'Cerchi con le braccia', reps_text: '10 per lato', note: null }])
  const list = renderAt('/session/s1', data)
  expect(list.indexOf('Riscaldamento')).toBeLessThan(list.indexOf('Panca piana'))
  const html = renderAt('/session/s1?es=riscaldamento', data)
  expect(html).toContain('10 per lato')
})

test('the end-of-session summary redirects to the read-only view', () => {
  expect(renderAt('/session/s1?fine=1')).toBe('')
})
