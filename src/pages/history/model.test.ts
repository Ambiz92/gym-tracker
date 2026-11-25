import { describe, expect, test } from 'vitest'
import type { HistoryExercise, LoggedSet, RecentWorkout } from '../../data/history'
import type { Equipment, HistorySet } from '../../types/db'
import { formatKg, formatLoadKg, formatShortDate, formatVariation, groupSets } from './format'
import {
  buildExerciseSummaries,
  buildExerciseView,
  buildSessionSummaries,
  buildWorkoutRows,
  filterSummaries,
  summaryDetail,
} from './model'

const TODAY = '2026-11-17'

const exercise = (id: string, name: string, extra: Partial<HistoryExercise> = {}): HistoryExercise => ({
  id,
  name,
  equipment: 'barbell',
  archived: false,
  starting_weight_kg: null,
  ...extra,
})

const logged = (exercise_id: string, date: string, weight_kg: number, equipment_used: Equipment = 'barbell'): LoggedSet => ({
  exercise_id,
  date,
  weight_kg,
  equipment_used,
})

const historySet = (workout_id: string, date: string, set_number: number, reps: number, weight_kg: number, equipment_used: Equipment = 'barbell'): HistorySet => ({
  id: `${workout_id}-${set_number}`,
  owner_id: 'u',
  workout_id,
  exercise_id: 'row',
  set_number,
  reps,
  weight_kg,
  equipment_used,
  rpe: null,
  date,
})

describe('format', () => {
  test('numbers use the decimal comma and drop trailing zeros', () => {
    expect(formatKg(27.5)).toBe('27,5 kg')
    expect(formatKg(30)).toBe('30 kg')
    expect(formatKg(12.125)).toBe('12,13 kg')
  })

  test('barbell loads are labelled as totals, the others stay plain kg', () => {
    expect(formatLoadKg(110, 'barbell')).toBe('110 kg totali')
    expect(formatLoadKg(27.5, 'dumbbell')).toBe('27,5 kg')
    expect(formatLoadKg(30, 'other')).toBe('30 kg')
  })

  test('variation shows the sign, "=" when flat and a dash without a baseline', () => {
    expect(formatVariation(20)).toBe('+20%')
    expect(formatVariation(-5.5)).toBe('−5,5%')
    expect(formatVariation(0)).toBe('=')
    expect(formatVariation(null)).toBe('—')
  })

  test('dates read "oggi", dd.mm this year and dd.mm.yy otherwise', () => {
    expect(formatShortDate('2026-11-17', TODAY)).toBe('oggi')
    expect(formatShortDate('2026-11-10', TODAY)).toBe('10.11')
    expect(formatShortDate('2025-12-31', TODAY)).toBe('31.12.25')
  })

  test('groupSets merges runs of identical sets in set order', () => {
    const sets = [
      { set_number: 3, reps: 6, weight_kg: 27.5, equipment_used: 'dumbbell' as const },
      { set_number: 1, reps: 8, weight_kg: 30, equipment_used: 'dumbbell' as const },
      { set_number: 2, reps: 8, weight_kg: 30, equipment_used: 'dumbbell' as const },
    ]
    expect(groupSets(sets)).toEqual(['2×8 · 30 kg', '1×6 · 27,5 kg'])
  })

  test('groupSets shows both sides of a barbell and does not merge it with a dumbbell of the same stored weight', () => {
    const sets = [
      { set_number: 1, reps: 8, weight_kg: 55, equipment_used: 'barbell' as const },
      { set_number: 2, reps: 8, weight_kg: 55, equipment_used: 'barbell' as const },
      { set_number: 3, reps: 8, weight_kg: 55, equipment_used: 'dumbbell' as const },
    ]
    expect(groupSets(sets)).toEqual(['2×8 · 110 kg totali', '1×8 · 55 kg'])
  })
})

describe('buildExerciseSummaries', () => {
  const exercises = [exercise('row', 'Rematore'), exercise('bench', 'Panca piana'), exercise('unused', 'Mai fatto')]

  test('reports last weight and change versus the first week, skipping never-logged exercises', () => {
    const sets = [logged('row', '2026-11-03', 25), logged('row', '2026-11-17', 30), logged('bench', '2026-11-10', 15)]
    const summaries = buildExerciseSummaries(exercises, sets)
    expect(summaries.map((s) => s.name)).toEqual(['Rematore', 'Panca piana'])
    expect(summaries[0]).toMatchObject({ lastWeightKg: 60, variationPct: 20, lastDate: '2026-11-17' })
    expect(summaries[1]).toMatchObject({ lastWeightKg: 30, variationPct: 0 })
  })

  test('dumbbells stay as logged and a mixed exercise compares totals with totals', () => {
    const [dumbbell] = buildExerciseSummaries([exercise('press', 'Press', { equipment: 'dumbbell' })], [logged('press', '2026-11-03', 20, 'dumbbell')])
    expect(dumbbell).toMatchObject({ lastWeightKg: 20 })
    expect(summaryDetail(dumbbell!)).toBe('ultima 20 kg')

    const [mixed] = buildExerciseSummaries(exercises, [logged('row', '2026-11-03', 20, 'barbell'), logged('row', '2026-11-10', 50, 'dumbbell')])
    expect(mixed).toMatchObject({ lastWeightKg: 50, variationPct: 25 })
  })

  test('orders by most recent training, then by name', () => {
    const sets = [logged('row', '2026-11-10', 25), logged('bench', '2026-11-10', 15)]
    expect(buildExerciseSummaries(exercises, sets).map((s) => s.name)).toEqual(['Panca piana', 'Rematore'])
  })

  test('keeps archived exercises and says so in the detail line', () => {
    const [summary] = buildExerciseSummaries([exercise('row', 'Rematore', { archived: true })], [logged('row', '2026-11-03', 25)])
    expect(summary!.archived).toBe(true)
    expect(summaryDetail(summary!)).toBe('ultima 50 kg totali · archiviato')
  })

  test('filters by name ignoring case and surrounding spaces', () => {
    const summaries = buildExerciseSummaries(exercises, [logged('row', '2026-11-03', 25), logged('bench', '2026-11-03', 15)])
    expect(filterSummaries(summaries, '  PANCA ').map((s) => s.name)).toEqual(['Panca piana'])
    expect(filterSummaries(summaries, '')).toHaveLength(2)
    expect(filterSummaries(summaries, 'zzz')).toEqual([])
  })
})

describe('buildSessionSummaries', () => {
  const workout: RecentWorkout = {
    id: 'w1',
    date: TODAY,
    session_name: 'Upper body',
    set_log: [
      { exercise_id: 'row', set_number: 1, reps: 8, weight_kg: 30, equipment_used: 'barbell' },
      { exercise_id: 'row', set_number: 2, reps: 8, weight_kg: 30, equipment_used: 'barbell' },
      { exercise_id: 'bench', set_number: 1, reps: 8, weight_kg: 15, equipment_used: 'barbell' },
    ],
  }

  test('counts exercises and sets and lists each exercise by name', () => {
    const names = new Map([['row', 'Rematore'], ['bench', 'Panca piana']])
    const [session] = buildSessionSummaries([workout], names, TODAY)
    expect(session).toEqual({
      id: 'w1',
      title: 'Upper body',
      detail: 'oggi · 2 esercizi · 3 serie',
      exercises: [
        { exerciseId: 'bench', name: 'Panca piana', sets: ['1×8 · 30 kg totali'] },
        { exerciseId: 'row', name: 'Rematore', sets: ['2×8 · 60 kg totali'] },
      ],
    })
  })

  test('uses singular forms for one exercise', () => {
    const single = { ...workout, date: '2026-11-10', set_log: workout.set_log.slice(2) }
    const [session] = buildSessionSummaries([single], new Map(), TODAY)
    expect(session!.detail).toBe('10.11 · 1 esercizio · 1 serie')
  })
})

describe('buildWorkoutRows', () => {
  test('one row per workout, newest first, with grouped sets', () => {
    const sets = [
      historySet('w1', '2026-11-03', 1, 8, 25),
      historySet('w2', '2026-11-17', 1, 8, 30),
      historySet('w2', '2026-11-17', 2, 6, 30),
    ]
    expect(buildWorkoutRows(sets, TODAY)).toEqual([
      { key: 'w2', date: 'oggi', sets: ['1×8 · 60 kg totali', '1×6 · 60 kg totali'] },
      { key: 'w1', date: '03.11', sets: ['1×8 · 50 kg totali'] },
    ])
  })
})

describe('buildExerciseView', () => {
  const sets = [
    historySet('w1', '2026-11-03', 1, 8, 25),
    historySet('w2', '2026-11-10', 1, 8, 27.5),
    historySet('w3', '2026-11-24', 1, 8, 30),
  ]

  test('KPIs use the exercise starting weight and compare the last week with the first logged one', () => {
    const view = buildExerciseView(exercise('row', 'Rematore', { starting_weight_kg: 20 }), sets, '2026-11-30')
    expect(view.kpis).toEqual([
      { value: '40', label: 'partenza (kg totali)' },
      { value: '60', label: 'ultima (kg totali)' },
      { value: '+20%', label: 'vs sett. 1', accent: true },
    ])
    expect(view.equipment).toBe('Bilanciere')
  })

  test('the chart has one point per logged week, with a sentence for each and for the trend', () => {
    const view = buildExerciseView(exercise('row', 'Rematore'), sets, '2026-11-30')
    expect(view.chartPoints.map(({ x, y, axisLabel }) => ({ x, y, axisLabel }))).toEqual([
      { x: 1, y: 50, axisLabel: 'S1' },
      { x: 2, y: 55, axisLabel: 'S2' },
      { x: 4, y: 60, axisLabel: 'S4' },
    ])
    expect(view.chartPoints[1]!.description).toBe('Settimana 2, dal 09.11: 55 kg totali')
    expect(view.chartSummary).toBe('Peso massimo per settimana: da 50 kg totali nella settimana 1 a 60 kg totali nella settimana 4.')
  })

  test('a barbell exercise says its weights are totals of both sides, bar excluded', () => {
    expect(buildExerciseView(exercise('row', 'Rematore'), sets, TODAY).weightNote).toContain('kg totali')
  })

  test('a dumbbell exercise keeps plain kg and the plain note', () => {
    const dumbbell = sets.map((set) => ({ ...set, equipment_used: 'dumbbell' as const }))
    const view = buildExerciseView(exercise('press', 'Press', { equipment: 'dumbbell', starting_weight_kg: 10 }), dumbbell, '2026-11-30')
    expect(view.kpis.map(({ value, label }) => [value, label])).toEqual([['10', 'kg partenza'], ['30', 'kg ultima'], ['+20%', 'vs sett. 1']])
    expect(view.chartPoints.map((point) => point.y)).toEqual([25, 27.5, 30])
    expect(view.chartSummary).toContain('da 25 kg nella settimana 1')
    expect(view.weightNote).toBe('Il massimo di ogni settimana.')
  })

  test('without logged sets there are no KPIs, chart or rows', () => {
    const view = buildExerciseView(exercise('row', 'Rematore', { starting_weight_kg: 20 }), [], TODAY)
    expect(view).toMatchObject({ kpis: [], chartPoints: [], chartSummary: '', workouts: [] })
  })
})
