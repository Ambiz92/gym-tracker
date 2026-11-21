import { beforeEach, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import {
  archiveExercise,
  createExercise,
  deleteExercise,
  listAdoptedCatalogIds,
  listExerciseUsage,
  listExercises,
  updateExercise,
} from './exercises'

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

test('listAdoptedCatalogIds collects the catalog links of every copy, archived included, skipping personal exercises', async () => {
  fakeSupabase.reset(() => ({ data: [{ catalog_id: 'c1' }, { catalog_id: null }, { catalog_id: 'c2' }, { catalog_id: 'c1' }] }))
  expect(await listAdoptedCatalogIds()).toEqual(new Set(['c1', 'c2']))
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'exercise', op: 'select', columns: 'catalog_id', filters: [] })
})

test('listExerciseUsage counts each plan once per exercise, filtering archived sessions and plans in the query', async () => {
  const row = (exercise_id: string, plan_id: string) => ({ exercise_id, plan_session: { plan_id } })
  fakeSupabase.reset(() => ({ data: [row('e1', 'p1'), row('e1', 'p1'), row('e1', 'p2'), row('e2', 'p1')] }))
  expect(await listExerciseUsage()).toEqual(new Map([['e1', 2], ['e2', 1]]))
  expect(fakeSupabase.calls).toHaveLength(1)
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'plan_exercise',
    filters: [['eq', 'plan_session.archived', false], ['eq', 'plan_session.plan.archived', false]],
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

test('deleteExercise maps a plan reference (foreign key violation) to in_use', async () => {
  fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : { error: { message: 'fk', code: '23503' } }))
  await expect(deleteExercise('e1')).rejects.toMatchObject({ name: 'DataError', code: 'in_use' })
})

test('deleteExercise keeps other database errors as they are', async () => {
  fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : { error: { message: 'denied', code: '42501' } }))
  await expect(deleteExercise('e1')).rejects.toMatchObject({ code: '42501' })
})

test('failures surface as DataError', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
  await expect(listExercises()).rejects.toBeInstanceOf(DataError)
  await expect(listExerciseUsage()).rejects.toBeInstanceOf(DataError)
  await expect(archiveExercise('e1')).rejects.toBeInstanceOf(DataError)
})
