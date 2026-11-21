import { describe, expect, test } from 'vitest'
import type { AthleteExercise, AthletePlan, AthleteWorkout } from '../../data/athletes'
import { buildAthleteExercises, buildAthleteSessions, buildPlanViews, targetLabel } from './model'

const exercises: AthleteExercise[] = [
  { id: 'e1', name: 'Panca', equipment: 'barbell', archived: false, starting_weight_kg: 40, notes: '  spalla delicata ' },
  { id: 'e2', name: 'Squat', equipment: 'barbell', archived: false, starting_weight_kg: null, notes: '   ' },
]

const set = (exercise_id: string, set_number: number, weight_kg: number) => ({ exercise_id, set_number, reps: 8, weight_kg, equipment_used: 'barbell' as const })

const workouts: AthleteWorkout[] = [
  { id: 'w1', date: '2026-11-20', session_name: 'A', notes: 'Buona giornata', set_log: [set('e1', 1, 40), set('e1', 2, 40)] },
  { id: 'w2', date: '2026-11-18', session_name: 'B', notes: null, set_log: [set('e2', 1, 60)] },
]

describe('buildAthleteSessions', () => {
  test('keeps the session summaries and adds the notes, by workout', () => {
    const sessions = buildAthleteSessions(workouts, exercises, '2026-11-21')
    expect(sessions.map((s) => [s.id, s.title, s.notes])).toEqual([
      ['w1', 'A', 'Buona giornata'],
      ['w2', 'B', null],
    ])
    expect(sessions[0]!.exercises).toEqual([{ exerciseId: 'e1', name: 'Panca', sets: ['2×8 · 40 kg'] }])
  })

  test('a blank note counts as no note', () => {
    expect(buildAthleteSessions([{ ...workouts[0]!, notes: '  \n ' }], exercises, '2026-11-21')[0]!.notes).toBeNull()
  })
})

describe('buildAthleteExercises', () => {
  test('lists the exercises that were logged, with their trimmed notes', () => {
    const rows = buildAthleteExercises(exercises, [
      { exercise_id: 'e1', weight_kg: 40, date: '2026-11-18' },
      { exercise_id: 'e2', weight_kg: 60, date: '2026-11-20' },
    ])
    expect(rows.map((row) => [row.name, row.notes, row.lastWeightKg])).toEqual([
      ['Squat', null, 60],
      ['Panca', 'spalla delicata', 40],
    ])
  })

  test('leaves out an exercise that was never logged', () => {
    expect(buildAthleteExercises(exercises, [])).toEqual([])
  })
})

describe('targetLabel', () => {
  test.each([
    ['reps', '3×8'],
    ['seconds', '3×8 s'],
    ['meters', '3×8 m'],
  ] as const)('%s', (target_unit, expected) => {
    expect(targetLabel({ exercise_id: 'e1', position: 0, target_sets: 3, target_reps: 8, target_unit })).toBe(expected)
  })
})

describe('buildPlanViews', () => {
  const plans: AthletePlan[] = [
    { id: 'p1', name: 'Vecchia', is_active: false, plan_session: [] },
    {
      id: 'p2',
      name: 'Attuale',
      is_active: true,
      plan_session: [
        {
          id: 's2',
          name: 'B',
          subtitle: null,
          position: 1,
          is_optional: true,
          plan_exercise: [],
        },
        {
          id: 's1',
          name: 'A',
          subtitle: 'Parte alta',
          position: 0,
          is_optional: false,
          plan_exercise: [
            { exercise_id: 'e2', position: 1, target_sets: 3, target_reps: 5, target_unit: 'reps' },
            { exercise_id: 'e1', position: 0, target_sets: 4, target_reps: 8, target_unit: 'reps' },
            { exercise_id: 'gone', position: 2, target_sets: 2, target_reps: 30, target_unit: 'seconds' },
          ],
        },
      ],
    },
  ]

  test('puts the active plan first, sessions and exercises in plan order, with names and targets', () => {
    const views = buildPlanViews(plans, exercises)
    expect(views.map((view) => view.name)).toEqual(['Attuale', 'Vecchia'])
    expect(views[0]!.sessions.map((session) => session.title)).toEqual(['A', 'B'])
    expect(views[0]!.sessions[0]).toMatchObject({ subtitle: 'Parte alta', optional: false })
    expect(views[0]!.sessions[0]!.exercises.map(({ name, target }) => [name, target])).toEqual([
      ['Panca', '4×8'],
      ['Squat', '3×5'],
      ['Esercizio', '2×30 s'],
    ])
    expect(views[0]!.sessions[1]!.optional).toBe(true)
  })

  test('does not reorder the caller’s arrays', () => {
    const before = plans[1]!.plan_session.map((session) => session.id)
    buildPlanViews(plans, exercises)
    expect(plans[1]!.plan_session.map((session) => session.id)).toEqual(before)
  })
})
