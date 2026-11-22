import { beforeEach, expect, test, vi } from 'vitest'
import type { CatalogExercise } from '../types/db'
import { adoptCatalogExercise, listCatalog } from './catalog'
import { FAKE_USER_ID, fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const entry: CatalogExercise = {
  id: 'c1',
  slug: 'bench-press',
  name_it: 'Panca piana',
  name_en: 'Bench press',
  synonyms: [],
  equipment: 'barbell',
  primary_muscle: 'Petto',
  secondary_muscles: ['Tricipiti'],
  execution_steps: 'Spingi',
  source: 'test',
  source_id: 'x',
}

const UNIQUE_VIOLATION = { message: 'duplicate key', code: '23505' }

beforeEach(() => fakeSupabase.reset())

test('listCatalog reads the catalog ordered by Italian name', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'c1' }] }))
  expect(await listCatalog()).toEqual([{ id: 'c1' }])
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'exercise_catalog',
    op: 'select',
    orders: [{ column: 'name_it', ascending: true }, { column: 'id', ascending: true }],
  })
})

test('the catalog is shared reference data: no owner filter', async () => {
  fakeSupabase.reset(() => ({ data: [] }))
  await listCatalog()
  expect(fakeSupabase.calls[0].ownerId).toBeUndefined()
})

test('listCatalog surfaces a database error', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'denied', code: '42501' } }))
  await expect(listCatalog()).rejects.toMatchObject({ name: 'DataError', code: '42501' })
})

test('adoptCatalogExercise inserts the copy without an owner_id and returns it', async () => {
  fakeSupabase.reset(() => ({ data: { id: 'e1', catalog_id: 'c1' } }))
  expect(await adoptCatalogExercise(entry)).toEqual({ id: 'e1', catalog_id: 'c1' })
  expect(fakeSupabase.calls).toHaveLength(1)
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'exercise',
    op: 'insert',
    payload: {
      name: 'Panca piana',
      equipment: 'barbell',
      muscles: 'Petto, Tricipiti',
      execution_steps: 'Spingi',
      catalog_id: 'c1',
    },
  })
  expect(fakeSupabase.calls[0].payload).not.toHaveProperty('owner_id')
})

test('adopting an entry already adopted returns the existing copy untouched', async () => {
  const existing = { id: 'e1', catalog_id: 'c1', archived: false }
  fakeSupabase.reset((call) => (call.op === 'insert' ? { error: UNIQUE_VIOLATION } : { data: existing }))
  expect(await adoptCatalogExercise(entry)).toEqual(existing)
  expect(fakeSupabase.calls.map((call) => call.op)).toEqual(['insert', 'select'])
  expect(fakeSupabase.calls[1]).toMatchObject({ table: 'exercise', ownerId: FAKE_USER_ID, filters: [['eq', 'catalog_id', 'c1']] })
})

test('adopting an entry whose copy is archived restores that same row', async () => {
  fakeSupabase.reset((call) => {
    if (call.op === 'insert') return { error: UNIQUE_VIOLATION }
    if (call.op === 'select') return { data: { id: 'e1', archived: true } }
    return { data: { id: 'e1', archived: false } }
  })
  expect(await adoptCatalogExercise(entry)).toEqual({ id: 'e1', archived: false })
  expect(fakeSupabase.calls.map((call) => call.op)).toEqual(['insert', 'select', 'update'])
  expect(fakeSupabase.calls[2]).toMatchObject({
    op: 'update',
    payload: { archived: false },
    filters: [['eq', 'id', 'e1']],
  })
})

test('adoption keeps any other insert error as it is, without looking for an existing copy', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'denied', code: '42501' } }))
  await expect(adoptCatalogExercise(entry)).rejects.toMatchObject({ name: 'DataError', code: '42501' })
  expect(fakeSupabase.calls).toHaveLength(1)
})

test('adoption fails when the duplicate cannot be found afterwards', async () => {
  fakeSupabase.reset((call) => (call.op === 'insert' ? { error: UNIQUE_VIOLATION } : undefined))
  await expect(adoptCatalogExercise(entry)).rejects.toMatchObject({ name: 'DataError' })
})
