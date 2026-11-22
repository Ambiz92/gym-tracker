import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { AthleteData } from '../../data/athletes'
import { AthleteContent } from './AthleteDetail'

const set = (exercise_id: string, set_number: number, weight_kg: number) => ({ exercise_id, set_number, reps: 8, weight_kg, equipment_used: 'barbell' as const })

const data: AthleteData = {
  workouts: [{ id: 'w1', date: '2026-11-20', session_name: 'Sessione A', notes: 'Dolore <b>alla spalla</b>\nmeglio dopo', set_log: [set('e1', 1, 40), set('e1', 2, 40)] }],
  exercises: [{ id: 'e1', name: 'Panca', equipment: 'barbell', archived: false, starting_weight_kg: 40, notes: 'Presa stretta' }],
  sets: [{ exercise_id: 'e1', weight_kg: 40, date: '2026-11-20' }],
  plans: [
    {
      id: 'p1',
      name: 'Forza',
      is_active: true,
      plan_session: [
        { id: 's1', name: 'A', subtitle: null, position: 0, is_optional: false, plan_exercise: [{ exercise_id: 'e1', position: 0, target_sets: 4, target_reps: 8, target_unit: 'reps' }] },
      ],
    },
  ],
}

const html = renderToStaticMarkup(<AthleteContent data={data} />)

test('shows the recent sessions with their notes, the exercises with the last weight and the plans with targets', () => {
  expect(html).toContain('Ultime sessioni')
  expect(html).toContain('<bdi>Sessione A</bdi>')
  expect(html).toContain('2×8 · 40 kg')
  expect(html).toContain('Presa stretta')
  expect(html).toContain('ultima 40 kg')
  expect(html).toContain('Forza')
  expect(html).toContain('Attiva')
  expect(html).toContain('4×8')
})

test('free text is plain text: markup in a note is escaped, not rendered', () => {
  expect(html).toContain('Dolore &lt;b&gt;alla spalla&lt;/b&gt;\nmeglio dopo')
  expect(html).not.toContain('<b>')
})

test('is read-only: no button, input, form or link in it', () => {
  for (const control of ['<button', '<input', '<form', '<textarea', '<select', '<a ']) expect(html).not.toContain(control)
})

test('an athlete with nothing logged shows an empty sessions note and no empty sections', () => {
  const empty = renderToStaticMarkup(<AthleteContent data={{ workouts: [], exercises: [], sets: [], plans: [] }} />)
  expect(empty).toContain('Nessuna sessione registrata.')
  expect(empty).not.toContain('Esercizi')
  expect(empty).not.toContain('Schede')
})
