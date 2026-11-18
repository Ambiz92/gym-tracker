import { beforeEach, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fetchAllTables } from './export'
import { fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const TABLE_NAMES = ['exercise', 'plan', 'plan_session', 'plan_exercise', 'warmup_item', 'workout', 'set_log']

const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: `r${start + i}` }))

beforeEach(() => fakeSupabase.reset())

test('reads every table in full, unfiltered so archived rows are included', async () => {
  fakeSupabase.reset(() => ({ data: rows(2) }))
  const tables = await fetchAllTables()

  expect(Object.keys(tables).sort()).toEqual(TABLE_NAMES.slice().sort())
  expect(fakeSupabase.calls.map((call) => call.table).sort()).toEqual(TABLE_NAMES.slice().sort())
  for (const call of fakeSupabase.calls) {
    expect(call).toMatchObject({ op: 'select', filters: [], orders: [{ column: 'id' }] })
  }
})

test('a table with more than 1000 rows is read page by page', async () => {
  fakeSupabase.reset((call) => {
    if (call.table !== 'set_log') return { data: [] }
    return { data: call.range![0] === 0 ? rows(1000) : rows(250, 1000) }
  })
  const tables = await fetchAllTables()

  expect(tables.set_log).toHaveLength(1250)
  expect(tables.set_log[1249]).toEqual({ id: 'r1249' })
  const setLogRanges = fakeSupabase.calls.filter((call) => call.table === 'set_log').map((call) => call.range)
  expect(setLogRanges).toEqual([[0, 999], [1000, 1999]])
})

test('a failing table rejects the whole export instead of producing a partial backup', async () => {
  fakeSupabase.reset((call) => (call.table === 'workout' ? { error: { message: 'boom', code: 'XX000' } } : { data: [] }))
  await expect(fetchAllTables()).rejects.toBeInstanceOf(DataError)
})
