import { beforeEach, expect, test, vi } from 'vitest'
import { fakeSupabase } from './fakeSupabase'
import { listArchivedExercises } from './exercisesArchived'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

beforeEach(() => fakeSupabase.reset())

test('listArchivedExercises reads archived rows ordered by name', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'e1' }] }))
  expect(await listArchivedExercises()).toEqual([{ id: 'e1' }])
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'exercise',
    filters: [['eq', 'archived', true]],
    orders: [{ column: 'name', ascending: true }],
  })
})

test('listArchivedExercises surfaces a database error', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'boom', code: '42501' } }))
  await expect(listArchivedExercises()).rejects.toMatchObject({ name: 'DataError', code: '42501' })
})
