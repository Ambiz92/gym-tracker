import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import { deleteWorkout, getLastWorkoutDates, saveWorkoutNotes } from './sessionLog'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'boom', code: 'XX000' } }

beforeEach(() => fakeSupabase.reset())

describe('getLastWorkoutDates', () => {
  test('asks for the newest workout with sets of each session and skips sessions never done', async () => {
    fakeSupabase.reset((call) => {
      const sessionId = call.filters.find(([method, column]) => method === 'eq' && column === 'session_id')?.[2]
      return { data: sessionId === 's1' ? [{ date: '2026-11-13' }] : [] }
    })
    const dates = await getLastWorkoutDates(['s1', 's2'])

    expect([...dates]).toEqual([['s1', '2026-11-13']])
    expect(fakeSupabase.calls).toHaveLength(2)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'workout',
      columns: 'date, set_log!inner(id)',
      orders: [{ column: 'date', ascending: false }],
      limit: 1,
    })
  })

  test('makes no request for an empty plan', async () => {
    expect((await getLastWorkoutDates([])).size).toBe(0)
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('surfaces a database error', async () => {
    fakeSupabase.reset(() => failure)
    await expect(getLastWorkoutDates(['s1'])).rejects.toBeInstanceOf(DataError)
  })
})

describe('saveWorkoutNotes', () => {
  test('updates the notes of the workout', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'w1' }] }))
    await saveWorkoutNotes('w1', 'bene')
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'workout', op: 'update', payload: { notes: 'bene' }, filters: [['eq', 'id', 'w1']] })
  })

  test('fails when no workout matched', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(saveWorkoutNotes('w1', 'bene')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('deleteWorkout', () => {
  test('deletes by id', async () => {
    await deleteWorkout('w1')
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'workout', op: 'delete', filters: [['eq', 'id', 'w1']] })
  })

  test('surfaces a database error', async () => {
    fakeSupabase.reset(() => failure)
    await expect(deleteWorkout('w1')).rejects.toBeInstanceOf(DataError)
  })
})
