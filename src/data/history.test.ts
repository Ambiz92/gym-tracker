import type { PostgrestError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import { getHistoryExercise, listHistoryExercises, listLoggedSets, listRecentWorkouts, listWorkoutDays } from './history'
import { readAllRows } from './paging'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

beforeEach(() => fakeSupabase.reset())

describe('readAllRows', () => {
  // The fake reports errors untyped; the real client types them as PostgrestError.
  const fetchPage = async (from: number, to: number) =>
    (await fakeSupabase.from('t').select().range(from, to)) as { data: unknown; error: PostgrestError | null }
  const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: start + i }))

  test('keeps reading until a short page, so nothing is cut at 1000 rows', async () => {
    fakeSupabase.reset((call) => ({ data: call.range![0] === 0 ? rows(1000) : call.range![0] === 1000 ? rows(1000, 1000) : rows(5, 2000) }))
    const all = await readAllRows(fetchPage)
    expect(all).toHaveLength(2005)
    expect(fakeSupabase.calls.map((call) => call.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  test('an exact multiple of the page size ends on an empty page', async () => {
    fakeSupabase.reset((call) => ({ data: call.range![0] === 0 ? rows(1000) : [] }))
    expect(await readAllRows(fetchPage)).toHaveLength(1000)
    expect(fakeSupabase.calls).toHaveLength(2)
  })

  test('an error on any page rejects instead of returning a partial list', async () => {
    fakeSupabase.reset((call) =>
      call.range![0] === 0 ? { data: rows(1000) } : { error: { message: 'boom', code: 'XX000' } },
    )
    await expect(readAllRows(fetchPage)).rejects.toBeInstanceOf(DataError)
  })
})

test('listHistoryExercises does not filter out archived exercises', async () => {
  fakeSupabase.reset(() => ({ data: [] }))
  await listHistoryExercises()
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'exercise', filters: [], orders: [{ column: 'name' }] })
})

describe('getHistoryExercise', () => {
  test('returns the exercise or null when it does not exist', async () => {
    fakeSupabase.reset(() => ({ data: { id: 'e1' } }))
    expect(await getHistoryExercise('e1')).toEqual({ id: 'e1' })
    fakeSupabase.reset(() => ({ data: null }))
    expect(await getHistoryExercise('e2')).toBeNull()
  })

  test('treats a malformed id as missing but surfaces other failures', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'invalid input syntax for type uuid', code: '22P02' } }))
    expect(await getHistoryExercise('not-a-uuid')).toBeNull()
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(getHistoryExercise('e1')).rejects.toBeInstanceOf(DataError)
  })
})

test('listLoggedSets flattens the workout date onto each set and pages on a unique order', async () => {
  fakeSupabase.reset(() => ({ data: [{ exercise_id: 'e1', weight_kg: 20, workout: { date: '2026-11-17' } }] }))
  expect(await listLoggedSets()).toEqual([{ exercise_id: 'e1', weight_kg: 20, date: '2026-11-17' }])
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', orders: [{ column: 'id' }], range: [0, 999] })
})

describe('listLoggedSets across pages', () => {
  const page = (count: number) =>
    Array.from({ length: count }, () => ({ exercise_id: 'e1', weight_kg: 20, workout: { date: '2026-11-17' } }))

  test('scopes every page to whoever is signed in when it is read', async () => {
    fakeSupabase.reset((call) => {
      if (call.range![0] === 0) {
        fakeSupabase.userId = 'user-2'
        return { data: page(1000) }
      }
      return { data: page(1) }
    })
    expect(await listLoggedSets()).toHaveLength(1001)
    expect(fakeSupabase.calls.map((call) => call.ownerId)).toEqual(['user-1', 'user-2'])
  })

  test('rejects when the session is gone before a later page', async () => {
    fakeSupabase.reset(() => {
      fakeSupabase.userId = null
      return { data: page(1000) }
    })
    await expect(listLoggedSets()).rejects.toMatchObject({ name: 'DataError', code: 'not_signed_in' })
    expect(fakeSupabase.calls).toHaveLength(1)
  })
})

test('listRecentWorkouts asks for the newest workouts first', async () => {
  fakeSupabase.reset(() => ({ data: [] }))
  await listRecentWorkouts(10)
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'workout',
    orders: [{ column: 'date', ascending: false }, { column: 'created_at', ascending: false }],
    limit: 10,
  })
})

test('listWorkoutDays reads only id, session and date, bounded on both ends', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'w1', session_id: 's1', date: '2026-11-17' }] }))
  expect(await listWorkoutDays('2026-11-01', '2026-11-30')).toEqual([{ id: 'w1', session_id: 's1', date: '2026-11-17' }])
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'workout',
    op: 'select',
    columns: 'id, session_id, date',
    filters: [['gte', 'date', '2026-11-01'], ['lte', 'date', '2026-11-30']],
  })
})
