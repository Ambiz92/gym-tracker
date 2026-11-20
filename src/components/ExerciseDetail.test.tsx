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

test('names the day of the last workout in the label of the last sets', () => {
  const lastSets = [{ set_number: 1, reps: 10, weight_kg: 12.5, equipment_used: 'barbell' }] as const
  expect(renderToStaticMarkup(<ExerciseDetail {...base} lastSets={lastSets} lastDate="2026-11-13" />)).toContain('Ultima volta · 13 nov')
  expect(renderToStaticMarkup(<ExerciseDetail {...base} lastSets={lastSets} />)).toContain('>Ultima volta<')
})

test('says so without written steps', () => {
  expect(renderToStaticMarkup(<ExerciseDetail {...base} />)).toContain('Nessuna indicazione scritta')
})

test('labels the weight column per side on a barbell, whose weights are the load of one side', () => {
  const lastSets = [{ set_number: 1, reps: 10, weight_kg: 15, equipment_used: 'barbell' }] as const
  const barbell = renderToStaticMarkup(<ExerciseDetail {...base} equipment="barbell" unit="reps" lastSets={lastSets} />)
  expect(barbell).toContain('<th scope="col">Kg per lato</th>')
  expect(barbell).toContain('<td>15</td>')
  expect(renderToStaticMarkup(<ExerciseDetail {...base} unit="reps" lastSets={lastSets} />)).toContain('<th scope="col">Kg</th>')
})
