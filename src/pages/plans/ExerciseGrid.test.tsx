import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { PlanExerciseDetail } from '../../data/activePlan'
import { ExerciseGrid } from './ExerciseGrid'

const noop = () => {}
const save = async () => true

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
    exercise: {
      id: `e-${id}`,
      owner_id: 'u1',
      name: `Esercizio ${id}`,
      equipment: 'barbell',
      muscles: null,
      execution_steps: null,
      notes: null,
      starting_weight_kg: null,
      archived: false,
      catalog_id: null,
    },
    ...overrides,
  }
}

const render = (exercises: PlanExerciseDetail[], { busy = false, error = null as string | null } = {}) =>
  renderToStaticMarkup(<ExerciseGrid exercises={exercises} busy={busy} error={error} onSave={save} onMove={noop} onRemove={noop} />)

const input = (html: string, label: string) => html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? ''

test('every exercise has its sets, reps, unit and weights as fields, prefilled', () => {
  const html = render([row('a')])
  expect(input(html, 'Serie di Esercizio a')).toContain('value="3"')
  expect(input(html, 'Ripetizioni, secondi o metri di Esercizio a')).toContain('value="8"')
  expect(input(html, 'Peso suggerito di Esercizio a \\(kg\\)')).toContain('value="20"')
  expect(input(html, 'Peso suggerito massimo di Esercizio a \\(kg\\)')).toContain('value="25"')
  expect(html).toMatch(/<select[^>]*aria-label="Unità di Esercizio a"/)
  expect(html).toMatch(/<option value="reps" selected="">rip<\/option>/)
})

test('a timed target shows seconds as the unit and in the label of the reps field', () => {
  const html = render([row('a', { target_unit: 'seconds', target_reps: 30, suggested_weight_kg: null, suggested_weight_max_kg: null })])
  expect(html).toMatch(/<option value="seconds" selected="">sec<\/option>/)
  expect(html).toContain('>sec</span>')
})

test('nothing is saved until a field changes: the save button starts disabled', () => {
  const html = render([row('a')])
  expect(html).toMatch(/<button(?=[^>]*aria-label="Salva Esercizio a")(?=[^>]*disabled)/)
})

test('the first row cannot go up, the last cannot go down, and every row can be removed', () => {
  const html = render([row('a'), row('b')])
  expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta su Esercizio a")(?=[^>]*disabled)/)
  expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta giù Esercizio b")(?=[^>]*disabled)/)
  expect(html).toContain('aria-label="Rimuovi Esercizio a"')
  expect(html).toContain('aria-label="Rimuovi Esercizio b"')
})

test('moving, removing and saving are blocked while a request is in flight', () => {
  const html = render([row('a'), row('b')], { busy: true })
  expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(8)
  expect(html).not.toMatch(/<button(?=[^>]*aria-label="Rimuovi Esercizio a")(?![^>]*disabled)/)
})

test('softly warns above ten reps and announces a failed save', () => {
  const html = render([row('a', { target_reps: 12 })], { error: 'Salvataggio non riuscito. Riprova.' })
  expect(html).toContain('Sopra le 10 ripetizioni')
  expect(html).toMatch(/role="alert"[^>]*>Salvataggio non riuscito/)
})

test('an empty session says so', () => {
  expect(render([])).toContain('non ha ancora esercizi')
})
