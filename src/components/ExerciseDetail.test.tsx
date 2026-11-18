import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ExerciseDetail } from './ExerciseDetail'

const base = { name: 'Plank', equipment: 'other', muscles: null, executionSteps: null, unit: 'seconds', lastSets: [] } as const

test('shows the suggestion only when there is one', () => {
  expect(renderToStaticMarkup(<ExerciseDetail {...base} suggestion="Suggerito: 15 kg, più 2,5" />)).toContain('Suggerito: 15 kg, più 2,5')
  expect(renderToStaticMarkup(<ExerciseDetail {...base} />)).not.toContain('exercise-detail__suggestion')
})

test('labels the last-time column with the unit of the target', () => {
  const lastSets = [{ set_number: 1, reps: 40, weight_kg: 0, equipment_used: 'other' }] as const
  const html = renderToStaticMarkup(<ExerciseDetail {...base} lastSets={lastSets} />)
  expect(html).toContain('<th scope="col">sec</th>')
  expect(html).toContain('<td>40</td>')
})

test('says so without written steps', () => {
  expect(renderToStaticMarkup(<ExerciseDetail {...base} />)).toContain('Nessuna indicazione scritta')
})
