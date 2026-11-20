import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { emptyForm } from '../lib/exerciseForm'
import type { Exercise } from '../types/db'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseList } from './ExerciseList'

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    owner_id: 'u1',
    name: `Esercizio ${id}`,
    equipment: 'dumbbell',
    muscles: 'Quadricipiti',
    execution_steps: null,
    notes: null,
    starting_weight_kg: null,
    archived: false,
    ...overrides,
  }
}

test('ExerciseList renders names and muscles as escaped text', () => {
  const html = renderToStaticMarkup(
    <ExerciseList
      exercises={[exercise('a', { name: '<img src=x onerror=alert(1)>', muscles: '<b>x</b>' })]}
      onSelect={() => {}}
      empty={null}
    />,
  )
  expect(html).not.toContain('<img')
  expect(html).not.toContain('<b>')
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
})

test('ExerciseList tags archived rows and shows the empty state when there are none', () => {
  const list = renderToStaticMarkup(
    <ExerciseList exercises={[exercise('a', { archived: true })]} onSelect={() => {}} empty="vuota" />,
  )
  expect(list).toContain('Archiviato')
  expect(list).not.toContain('→')

  const empty = renderToStaticMarkup(<ExerciseList exercises={[]} onSelect={() => {}} empty="vuota" />)
  expect(empty).toContain('vuota')
  expect(empty).not.toContain('<ul')
})

test('ExerciseList marks only the selected row as current', () => {
  const html = renderToStaticMarkup(
    <ExerciseList exercises={[exercise('a'), exercise('b', { name: 'Squat' })]} selectedId="b" onSelect={() => {}} empty={null} />,
  )
  expect(html.match(/aria-current="true"/g)).toHaveLength(1)
  expect(html).toMatch(/aria-current="true"[^>]*><span><span class="exercise-row__name">Squat/)
})

test('ExerciseForm labels its fields, marks the name required and shows a submit failure as an alert', () => {
  const html = renderToStaticMarkup(
    <ExerciseForm initial={emptyForm()} busy={false} error="Salvataggio non riuscito." submitLabel="Salva" onSubmit={() => {}} />,
  )
  expect(html).toContain('Nome')
  expect(html).toContain('Attrezzo')
  expect(html).toContain('Come si esegue (facoltativo)')
  expect(html).toContain('<p role="alert"')
  expect(html).toContain('Salvataggio non riuscito.')
  expect(html).not.toContain('aria-busy')
})

test('ExerciseForm blocks the submit button while busy', () => {
  const html = renderToStaticMarkup(
    <ExerciseForm initial={emptyForm()} busy error={null} submitLabel="Salva" onSubmit={() => {}} />,
  )
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/)
  expect(html).toContain('aria-busy="true"')
})
