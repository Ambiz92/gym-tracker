import type { PostgrestError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError, ensureOk, inUseError, isReferenced, unwrap, unwrapOrNull } from './client'
import { fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const pgError = { message: 'permission denied', code: '42501', details: '', hint: '', name: 'PostgrestError' } as PostgrestError

beforeEach(() => fakeSupabase.reset())

describe('unwrap', () => {
  test('returns the data', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2])
  })

  test('throws a DataError carrying code and cause on a supabase error', () => {
    const run = () => unwrap({ data: null, error: pgError })
    expect(run).toThrow(DataError)
    try {
      run()
    } catch (e) {
      expect(e).toMatchObject({ message: 'permission denied', code: '42501', cause: pgError })
    }
  })

  test('throws when the payload is empty without an error', () => {
    expect(() => unwrap({ data: null, error: null })).toThrow(DataError)
  })

  test('does not hide the error when data is also present', () => {
    expect(() => unwrap({ data: [1], error: pgError })).toThrow(DataError)
  })
})

describe('unwrapOrNull', () => {
  test('returns null for an empty payload and throws on error', () => {
    expect(unwrapOrNull({ data: null, error: null })).toBeNull()
    expect(() => unwrapOrNull({ data: null, error: pgError })).toThrow(DataError)
  })
})

describe('ensureOk', () => {
  test('passes without error and throws with one', () => {
    expect(() => ensureOk({ error: null })).not.toThrow()
    expect(() => ensureOk({ error: pgError })).toThrow(DataError)
  })
})

describe('isReferenced', () => {
  test('is false without querying when there are no ids', async () => {
    expect(await isReferenced('workout', 'session_id', [])).toBe(false)
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('queries one row for the given ids', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'w1' }] }))
    expect(await isReferenced('workout', 'session_id', ['s1', 's2'])).toBe(true)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'workout',
      op: 'select',
      filters: [['in', 'session_id', ['s1', 's2']]],
      limit: 1,
    })
  })

  test('is false when nothing matches and throws when the query fails', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    expect(await isReferenced('workout', 'session_id', ['s1'])).toBe(false)
    fakeSupabase.reset(() => ({ error: pgError }))
    await expect(isReferenced('workout', 'session_id', ['s1'])).rejects.toBeInstanceOf(DataError)
  })
})

test('inUseError has the in_use code', () => {
  expect(inUseError('The plan')).toMatchObject({ code: 'in_use', name: 'DataError' })
})
