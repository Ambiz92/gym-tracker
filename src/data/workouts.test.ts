import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import { createWorkout, deleteSet, getExerciseHistory, getLastWorkoutsSets, logSet } from './workouts'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'boom', code: 'XX000' } }

beforeEach(() => fakeSupabase.reset())

describe('createWorkout', () => {
  test('writes the caller local date and the session snapshot', async () => {
    fakeSupabase.reset(() => ({ data: { id: 'w1' } }))
    const workout = await createWorkout({ date: '2026-11-17', sessionId: 's1', sessionName: 'A' })
    expect(workout).toEqual({ id: 'w1' })
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'workout',
      op: 'upsert',
      payload: { date: '2026-11-17', session_id: 's1', session_name: 'A' },
      mode: 'single',
    })
  })

  test('upserts on the client-generated id so a retry does not create a second workout', async () => {
    fakeSupabase.reset(() => ({ data: { id: 'w-draft' } }))
    const input = { id: 'w-draft', date: '2026-11-17', sessionId: 's1', sessionName: 'A' }
    await createWorkout(input)
    await createWorkout(input)

    for (const call of fakeSupabase.calls) {
      expect(call).toMatchObject({ op: 'upsert', options: { onConflict: 'id' }, payload: { id: 'w-draft' } })
    }
  })
})

describe('logSet', () => {
  const set = { workout_id: 'w1', exercise_id: 'e1', set_number: 1, reps: 8, weight_kg: 20, equipment_used: 'barbell' as const }

  test('stores the set and returns the stored row', async () => {
    fakeSupabase.reset(() => ({ data: { id: 'l1' } }))
    expect(await logSet(set)).toEqual({ id: 'l1' })
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', op: 'upsert', payload: set })
  })

  test('upserts on the set identity so retrying a stored set succeeds', async () => {
    fakeSupabase.reset(() => ({ data: { id: 'l-draft' } }))
    await logSet({ ...set, id: 'l-draft' })
    expect(fakeSupabase.calls[0]).toMatchObject({
      options: { onConflict: 'workout_id,exercise_id,set_number' },
      payload: { id: 'l-draft' },
    })
  })
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

describe('getLastWorkoutsSets', () => {
  const set = (id: string, set_number: number) => ({ id, set_number })

  test('reads the latest workouts with the exercise in one request, newest first', async () => {
    fakeSupabase.reset(() => ({
      data: [
        { id: 'w9', set_log: [set('l2', 2), set('l1', 1)] },
        { id: 'w8', set_log: [set('l3', 1)] },
      ],
    }))
    expect(await getLastWorkoutsSets('e1', 2)).toEqual([[set('l1', 1), set('l2', 2)], [set('l3', 1)]])

    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'workout',
      columns: 'id, set_log!inner(*)',
      filters: [['eq', 'set_log.exercise_id', 'e1']],
      orders: [
        { column: 'date', ascending: false },
        { column: 'created_at', ascending: false },
      ],
      limit: 2,
    })
  })

  test('excludes the open workout', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await getLastWorkoutsSets('e1', 2, 'w-open')
    expect(fakeSupabase.calls[0].filters).toContainEqual(['neq', 'id', 'w-open'])
  })

  test('returns an empty list when the exercise was never logged', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    expect(await getLastWorkoutsSets('e1', 2)).toEqual([])
  })

  test('surfaces failures as DataError', async () => {
    fakeSupabase.reset(() => failure)
    await expect(getLastWorkoutsSets('e1', 2)).rejects.toBeInstanceOf(DataError)
  })
})

describe('getExerciseHistory', () => {
  const row = (n: number) => ({ id: `l${n}`, workout_id: 'w1', set_number: n, workout: { date: '2026-11-03' } })

  test('flattens the workout date and asks the database for date, workout, set order', async () => {
    fakeSupabase.reset(() => ({
      data: [
        { id: 'a', workout_id: 'w1', set_number: 1, workout: { date: '2026-11-03' } },
        { id: 'b', workout_id: 'w1', set_number: 2, workout: { date: '2026-11-03' } },
      ],
    }))
    const rows = await getExerciseHistory('e1')
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows[0]).toMatchObject({ date: '2026-11-03' })
    expect(rows[0]).not.toHaveProperty('workout')
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'set_log',
      filters: [['eq', 'exercise_id', 'e1']],
      orders: [
        { column: 'workout(date)', ascending: true },
        { column: 'workout_id', ascending: true },
        { column: 'set_number', ascending: true },
      ],
      range: [0, 999],
    })
  })

  test('keeps reading pages until a short one, so rows beyond 1000 are not dropped', async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => row(i)), Array.from({ length: 1000 }, (_, i) => row(1000 + i)), [row(2000)]]
    fakeSupabase.reset((call) => ({ data: pages[call.range![0] / 1000] }))

    const rows = await getExerciseHistory('e1')
    expect(rows).toHaveLength(2001)
    expect(rows.at(-1)?.id).toBe('l2000')
    expect(fakeSupabase.calls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  test('an exact multiple of the page size ends with one empty page', async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => row(i)), []]
    fakeSupabase.reset((call) => ({ data: pages[call.range![0] / 1000] }))
    expect(await getExerciseHistory('e1')).toHaveLength(1000)
    expect(fakeSupabase.calls).toHaveLength(2)
  })

  test('a failing page is thrown, not truncated', async () => {
    fakeSupabase.reset((call) => (call.range![0] === 0 ? { data: Array.from({ length: 1000 }, (_, i) => row(i)) } : failure))
    await expect(getExerciseHistory('e1')).rejects.toBeInstanceOf(DataError)
  })
})
