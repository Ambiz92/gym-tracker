import { describe, expect, test } from 'vitest'
import type { HistoryExercise, LoggedSet, RecentWorkout } from '../../data/history'
import type { HistorySet } from '../../types/db'
import { formatKg, formatShortDate, formatVariation, groupSets } from './format'
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

const logged = (exercise_id: string, date: string, weight_kg: number): LoggedSet => ({ exercise_id, date, weight_kg })

const historySet = (workout_id: string, date: string, set_number: number, reps: number, weight_kg: number): HistorySet => ({
  id: `${workout_id}-${set_number}`,
  owner_id: 'u',
  workout_id,
  exercise_id: 'row',
  set_number,
  reps,
  weight_kg,
  equipment_used: 'barbell',
  rpe: null,
  date,
})

describe('format', () => {
  test('numbers use the decimal comma and drop trailing zeros', () => {
    expect(formatKg(27.5)).toBe('27,5 kg')
    expect(formatKg(30)).toBe('30 kg')
    expect(formatKg(12.125)).toBe('12,13 kg')
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
      { set_number: 3, reps: 6, weight_kg: 27.5 },
      { set_number: 1, reps: 8, weight_kg: 30 },
      { set_number: 2, reps: 8, weight_kg: 30 },
    ]
    expect(groupSets(sets)).toEqual(['2×8 · 30 kg', '1×6 · 27,5 kg'])
  })
})

describe('buildExerciseSummaries', () => {
  const exercises = [exercise('row', 'Rematore'), exercise('bench', 'Panca piana'), exercise('unused', 'Mai fatto')]

  test('reports last weight and change versus the first week, skipping never-logged exercises', () => {
    const sets = [logged('row', '2026-11-03', 25), logged('row', '2026-11-17', 30), logged('bench', '2026-11-10', 15)]
    const summaries = buildExerciseSummaries(exercises, sets)
    expect(summaries.map((s) => s.name)).toEqual(['Rematore', 'Panca piana'])
    expect(summaries[0]).toMatchObject({ lastWeightKg: 30, variationPct: 20, lastDate: '2026-11-17' })
    expect(summaries[1]).toMatchObject({ lastWeightKg: 15, variationPct: 0 })
  })

  test('orders by most recent training, then by name', () => {
    const sets = [logged('row', '2026-11-10', 25), logged('bench', '2026-11-10', 15)]
    expect(buildExerciseSummaries(exercises, sets).map((s) => s.name)).toEqual(['Panca piana', 'Rematore'])
  })

  test('keeps archived exercises and says so in the detail line', () => {
    const [summary] = buildExerciseSummaries([exercise('row', 'Rematore', { archived: true })], [logged('row', '2026-11-03', 25)])
    expect(summary!.archived).toBe(true)
    expect(summaryDetail(summary!)).toBe('ultima 25 kg · archiviato')
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
        { exerciseId: 'bench', name: 'Panca piana', sets: ['1×8 · 15 kg'] },
        { exerciseId: 'row', name: 'Rematore', sets: ['2×8 · 30 kg'] },
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
      { key: 'w2', date: 'oggi', sets: ['1×8 · 30 kg', '1×6 · 30 kg'] },
      { key: 'w1', date: '03.11', sets: ['1×8 · 25 kg'] },
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
      { value: '20', label: 'kg partenza' },
      { value: '30', label: 'kg ultima' },
      { value: '+20%', label: 'vs sett. 1', accent: true },
    ])
    expect(view.equipment).toBe('Bilanciere')
  })

  test('the chart has one point per logged week, with a sentence for each and for the trend', () => {
    const view = buildExerciseView(exercise('row', 'Rematore'), sets, '2026-11-30')
    expect(view.chartPoints.map(({ x, y, axisLabel }) => ({ x, y, axisLabel }))).toEqual([
      { x: 1, y: 25, axisLabel: 'S1' },
      { x: 2, y: 27.5, axisLabel: 'S2' },
      { x: 4, y: 30, axisLabel: 'S4' },
    ])
    expect(view.chartPoints[1]!.description).toBe('Settimana 2, dal 09.11: 27,5 kg')
    expect(view.chartSummary).toBe('Peso massimo per settimana: da 25 kg nella settimana 1 a 30 kg nella settimana 4.')
  })

  test('without logged sets there are no KPIs, chart or rows', () => {
    const view = buildExerciseView(exercise('row', 'Rematore', { starting_weight_kg: 20 }), [], TODAY)
    expect(view).toMatchObject({ kpis: [], chartPoints: [], chartSummary: '', workouts: [] })
  })
})
