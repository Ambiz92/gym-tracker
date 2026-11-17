import { beforeEach, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import { archiveExercise, createExercise, deleteExercise, listExercises, updateExercise } from './exercises'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

beforeEach(() => fakeSupabase.reset())

test('listExercises reads non-archived rows ordered by name', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'e1' }] }))
  expect(await listExercises()).toEqual([{ id: 'e1' }])
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'exercise',
    filters: [['eq', 'archived', false]],
    orders: [{ column: 'name', ascending: true }],
  })
})

test('createExercise and updateExercise return the stored row', async () => {
  fakeSupabase.reset(() => ({ data: { id: 'e1' } }))
  await createExercise({ name: 'Squat', equipment: 'barbell' })
  await updateExercise('e1', { name: 'Back squat' })
  expect(fakeSupabase.calls[0]).toMatchObject({ op: 'insert', payload: { name: 'Squat', equipment: 'barbell' } })
  expect(fakeSupabase.calls[1]).toMatchObject({
    op: 'update',
    payload: { name: 'Back squat' },
    filters: [['eq', 'id', 'e1']],
  })
})

test('archiveExercise sets archived instead of deleting', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'e1' }] }))
  await archiveExercise('e1')
  expect(fakeSupabase.calls[0]).toMatchObject({
    op: 'update',
    payload: { archived: true },
    filters: [['eq', 'id', 'e1']],
    columns: 'id',
  })
})

test('archiveExercise throws not_found when no row matched', async () => {
  fakeSupabase.reset(() => ({ data: [] }))
  await expect(archiveExercise('missing')).rejects.toMatchObject({ code: 'not_found' })
})

test('deleteExercise refuses when a set was logged and deletes nothing', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'l1' }] }))
  await expect(deleteExercise('e1')).rejects.toMatchObject({ name: 'DataError', code: 'in_use' })
  expect(fakeSupabase.calls.map((c) => c.op)).toEqual(['select'])
})

test('deleteExercise deletes an unused exercise', async () => {
  fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : undefined))
  await deleteExercise('e1')
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'set_log', op: 'select' })
  expect(fakeSupabase.calls[1]).toMatchObject({ table: 'exercise', op: 'delete', filters: [['eq', 'id', 'e1']] })
})

test('failures surface as DataError', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
  await expect(listExercises()).rejects.toBeInstanceOf(DataError)
  await expect(archiveExercise('e1')).rejects.toBeInstanceOf(DataError)
})
