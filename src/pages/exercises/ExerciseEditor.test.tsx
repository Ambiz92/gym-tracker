import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Exercise } from '../../types/db'
import { ExerciseEditor } from './ExerciseEditor'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))

const exercise: Exercise = {
  id: 'e1',
  owner_id: 'u1',
  name: 'Squat',
  equipment: 'barbell',
  muscles: null,
  execution_steps: null,
  notes: null,
  starting_weight_kg: null,
  archived: false,
}

const render = (value: Exercise | null) =>
  renderToStaticMarkup(<ExerciseEditor exercise={value} onCancel={() => {}} onDone={() => {}} />)

beforeEach(() => {
  desktop = false
})

test('on the phone the archive button sits in the manage section, after the form', () => {
  const html = render(exercise)
  expect(html.indexOf('Archivia<')).toBeGreaterThan(html.indexOf('exercise-editor__manage'))
  expect(html).not.toContain('exercise-form__actions--split')
})

test('on desktop the archive button sits beside the save button, in the form', () => {
  desktop = true
  const html = render(exercise)
  expect(html).toContain('exercise-form__actions--split')
  expect(html.indexOf('Archivia<')).toBeGreaterThan(html.indexOf('Salva modifiche'))
  expect(html.indexOf('Archivia<')).toBeLessThan(html.indexOf('exercise-editor__manage'))
  expect(html).toContain('Elimina esercizio')
})

test('a new exercise has nothing to archive', () => {
  desktop = true
  const html = render(null)
  expect(html).not.toContain('Archivia<')
  expect(html).not.toContain('exercise-form__actions--split')
})
