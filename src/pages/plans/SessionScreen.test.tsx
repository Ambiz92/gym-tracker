import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PlanExerciseDetail, SessionDetail } from '../../data/activePlan'
import type { Exercise } from '../../types/db'
import { AddExercise } from './AddExercise'
import { ExerciseRows } from './ExerciseRows'
import { SessionFields } from './SessionFields'
import { SessionRemove } from './SessionRemove'
import { SessionScreen } from './SessionScreen'
import { TargetForm } from './TargetForm'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))

beforeEach(() => {
  desktop = false
})

const inRouter = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = () => {}

function exercise(id: string): Exercise {
  return { id, owner_id: 'u1', name: `Esercizio ${id}`, equipment: 'barbell', muscles: null, execution_steps: null, notes: null, starting_weight_kg: null, archived: false }
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

const rowsProps = { editingId: null, busy: false, error: null, onEdit: noop, onSave: noop, onMove: noop, onReorder: noop, onRemove: noop }

test('rows show sets and reps only, never the weight', () => {
  const html = renderToStaticMarkup(<ExerciseRows {...rowsProps} exercises={[row('a')]} />)
  expect(html).toContain('3×8')
  expect(html).not.toMatch(/kg|20|25/)
})

test('rows write timed and distance targets with their unit', () => {
  const html = renderToStaticMarkup(
    <ExerciseRows {...rowsProps} exercises={[row('a', { target_unit: 'seconds', target_reps: 30 }), row('b', { target_unit: 'meters', target_reps: 40 })]} />,
  )
  expect(html).toContain('3×30 s')
  expect(html).toContain('3×40 m')
})

test('an empty session says so and the first and last rows cannot move out of the list', () => {
  expect(renderToStaticMarkup(<ExerciseRows {...rowsProps} exercises={[]} />)).toContain('non ha ancora esercizi')
  const html = renderToStaticMarkup(<ExerciseRows {...rowsProps} exercises={[row('a'), row('b')]} />)
  expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta su Esercizio e-a")(?=[^>]*disabled)/)
  expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta giù Esercizio e-b")(?=[^>]*disabled)/)
  expect(html).toContain('aria-label="Rimuovi Esercizio e-a"')
})

test('the open row shows the weights in the edit form, prefilled', () => {
  const html = renderToStaticMarkup(<ExerciseRows {...rowsProps} exercises={[row('a')]} editingId="a" />)
  expect(html).toContain('aria-expanded="true"')
  expect(html).toContain('Peso suggerito (kg)')
  expect(html).toContain('value="20"')
  expect(html).toContain('value="25"')
})

test('the target form offers the three units, with reps relabelled for the chosen one', () => {
  const initial = { sets: '3', reps: '30', unit: 'seconds' as const, weight: '', weightMax: '' }
  const html = renderToStaticMarkup(<TargetForm initial={initial} busy={false} error={null} onSubmit={noop} onCancel={noop} />)
  expect(html).toMatch(/<input(?=[^>]*type="radio")(?=[^>]*value="seconds")(?=[^>]*checked)/)
  expect(html).toContain('value="reps"')
  expect(html).toContain('value="meters"')
  expect(html).not.toContain('Sopra le 10')
})

test('the target form softly warns above ten reps without blocking', () => {
  const initial = { sets: '3', reps: '12', unit: 'reps' as const, weight: '', weightMax: '' }
  const html = renderToStaticMarkup(<TargetForm initial={initial} busy={false} error="Salvataggio non riuscito." onSubmit={noop} onCancel={noop} />)
  expect(html).toContain('Sopra le 10 ripetizioni')
  expect(html).toContain('role="alert"')
})

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

test('the add screen announces what was added and starts on the picker', () => {
  const html = inRouter(
    <AddExercise sessionName="Upper" excludeIds={[]} busy={false} error={null} notice="«Squat» aggiunto." onPick={noop} onCreate={noop} onClose={noop} />,
  )
  expect(html).toContain('Upper')
  expect(html).toMatch(/<div role="status"><p[^>]*>«Squat» aggiunto\.<\/p><\/div>/)
  expect(html).toContain('Caricamento')
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
  expect(html).toContain('3×8')
  expect(html).toContain('Aggiungi esercizio')
  expect(html).toContain('Rimuovi la sessione')
})

test('every exercise row has a pointer-only drag handle and keeps the move buttons', () => {
  const html = renderToStaticMarkup(<ExerciseRows {...rowsProps} exercises={[row('a'), row('b')]} />)
  expect(html.match(/<span[^>]*class="plan-row__grip"[^>]*aria-hidden="true"/g)).toHaveLength(2)
  expect(html).toContain('aria-label="Sposta giù Esercizio e-a"')
  expect(html).toContain('aria-label="Sposta su Esercizio e-b"')
})

test('the session screen edits targets in place on desktop and through a form on the phone', () => {
  const session: SessionDetail = {
    id: 's1', owner_id: 'u1', plan_id: 'p1', name: 'Full body', subtitle: null, position: 0, is_optional: false, archived: false,
    exercises: [row('a')],
    warmup: [],
  }
  const render = () => inRouter(<SessionScreen planId="p1" planName="Forza" session={session} onChange={noop} onRemoved={noop} />)

  expect(render()).toContain('aria-label="Modifica Esercizio e-a"')
  expect(render()).not.toContain('plan-grid__input')

  desktop = true
  expect(render()).toContain('plan-grid__input')
  expect(render()).not.toContain('aria-label="Modifica Esercizio e-a"')
})
