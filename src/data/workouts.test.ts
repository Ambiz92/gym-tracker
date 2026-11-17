import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import { createWorkout, deleteSet, getExerciseHistory, getLastSets, logSet } from './workouts'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'boom', code: 'XX000' } }

beforeEach(() => fakeSupabase.reset())

test('createWorkout inserts the caller local date and the session snapshot', async () => {
  fakeSupabase.reset(() => ({ data: { id: 'w1' } }))
  const workout = await createWorkout({ date: '2026-11-17', sessionId: 's1', sessionName: 'A' })
  expect(workout).toEqual({ id: 'w1' })
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'workout',
    op: 'insert',
    payload: { date: '2026-11-17', session_id: 's1', session_name: 'A' },
    mode: 'single',
  })
})

test('logSet inserts the set and returns the stored row', async () => {
  fakeSupabase.reset(() => ({ data: { id: 'l1' } }))
  const set = { workout_id: 'w1', exercise_id: 'e1', set_number: 1, reps: 8, weight_kg: 20, equipment_used: 'barbell' as const }
  expect(await logSet(set)).toEqual({ id: 'l1' })
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', op: 'insert', payload: set })
})

test('writes surface failures as DataError', async () => {
  fakeSupabase.reset(() => failure)
  await expect(createWorkout({ date: '2026-11-17', sessionId: null, sessionName: 'A' })).rejects.toBeInstanceOf(DataError)
  await expect(deleteSet('l1')).rejects.toBeInstanceOf(DataError)
})

test('deleteSet deletes by id', async () => {
  await deleteSet('l1')
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', op: 'delete', filters: [['eq', 'id', 'l1']] })
})

describe('getLastSets', () => {
  test('finds the latest workout with the exercise, then reads its sets in order', async () => {
    fakeSupabase.reset((call) => (call.table === 'workout' ? { data: [{ id: 'w9' }] } : { data: [{ id: 'l1' }] }))
    expect(await getLastSets('e1')).toEqual([{ id: 'l1' }])

    const [find, read] = fakeSupabase.calls
    expect(find).toMatchObject({
      table: 'workout',
      filters: [['eq', 'set_log.exercise_id', 'e1']],
      orders: [
        { column: 'date', ascending: false },
        { column: 'created_at', ascending: false },
      ],
      limit: 1,
    })
    expect(read).toMatchObject({
      table: 'set_log',
      filters: [
        ['eq', 'workout_id', 'w9'],
        ['eq', 'exercise_id', 'e1'],
      ],
      orders: [{ column: 'set_number', ascending: true }],
    })
  })

  test('excludes the open workout', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await getLastSets('e1', 'w-open')
    expect(fakeSupabase.calls[0].filters).toContainEqual(['neq', 'id', 'w-open'])
  })

  test('returns an empty list without a second query when the exercise was never logged', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    expect(await getLastSets('e1')).toEqual([])
    expect(fakeSupabase.calls).toHaveLength(1)
  })
})

test('getExerciseHistory flattens the workout date and sorts oldest first', async () => {
  fakeSupabase.reset(() => ({
    data: [
      { id: 'c', workout_id: 'w2', set_number: 1, workout: { date: '2026-11-10' } },
      { id: 'b', workout_id: 'w1', set_number: 2, workout: { date: '2026-11-03' } },
      { id: 'a', workout_id: 'w1', set_number: 1, workout: { date: '2026-11-03' } },
    ],
  }))
  const rows = await getExerciseHistory('e1')
  expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  expect(rows[0]).toMatchObject({ date: '2026-11-03' })
  expect(rows[0]).not.toHaveProperty('workout')
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', filters: [['eq', 'exercise_id', 'e1']] })
})
