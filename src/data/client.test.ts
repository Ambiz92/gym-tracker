import type { PostgrestError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { athleteReader, DataError, ensureAffected, ensureOk, inUseError, isReferenced, linkTable, own, unwrap, unwrapOrNull } from './client'
import { FAKE_USER_ID, fakeSupabase } from './fakeSupabase'

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

describe('ensureAffected', () => {
  test('passes when at least one row matched', () => {
    expect(() => ensureAffected({ data: [{ id: 'a' }], error: null })).not.toThrow()
  })

  test('throws not_found when nothing matched', () => {
    expect(() => ensureAffected({ data: [], error: null })).toThrow(expect.objectContaining({ code: 'not_found' }))
    expect(() => ensureAffected({ data: null, error: null })).toThrow(expect.objectContaining({ code: 'not_found' }))
  })

  test('throws the database error first', () => {
    expect(() => ensureAffected({ data: [], error: pgError })).toThrow(expect.objectContaining({ code: '42501' }))
  })
})

describe('error code normalization', () => {
  test('an empty code becomes null', () => {
    expect(() => ensureOk({ error: Object.assign({}, pgError, { code: '' }) })).toThrow(expect.objectContaining({ code: null }))
  })
})

describe('own', () => {
  test('scopes select, update and delete to the signed-in owner, next to the caller filters', async () => {
    const plans = await own('plan')
    await plans.select('id').eq('id', 'p1')
    await plans.update({ name: 'New' }).eq('id', 'p1')
    await plans.delete().eq('id', 'p1')
    expect(fakeSupabase.calls).toMatchObject([
      { table: 'plan', op: 'select', ownerId: FAKE_USER_ID, filters: [['eq', 'id', 'p1']] },
      { table: 'plan', op: 'update', ownerId: FAKE_USER_ID, filters: [['eq', 'id', 'p1']] },
      { table: 'plan', op: 'delete', ownerId: FAKE_USER_ID, filters: [['eq', 'id', 'p1']] },
    ])
  })

  test('leaves insert and upsert to the database default and the policies', async () => {
    const plans = await own('plan')
    await plans.insert({ name: 'New' })
    await plans.upsert({ id: 'p1', name: 'New' }, { onConflict: 'id' })
    expect(fakeSupabase.calls.map((call) => [call.op, call.ownerId])).toEqual([
      ['insert', undefined],
      ['upsert', undefined],
    ])
  })

  test('filters by the user the session belongs to when the account changes', async () => {
    fakeSupabase.userId = 'user-2'
    await (await own('workout')).select()
    expect(fakeSupabase.calls[0]).toMatchObject({ ownerId: 'user-2' })
  })

  test('refuses without a session', async () => {
    fakeSupabase.userId = null
    await expect(own('plan')).rejects.toMatchObject({ name: 'DataError', code: 'not_signed_in' })
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('surfaces a session read failure as a DataError', async () => {
    fakeSupabase.sessionError = { message: 'storage unavailable', code: 'session_not_found' }
    await expect(own('plan')).rejects.toMatchObject({ name: 'DataError', code: 'session_not_found', message: 'storage unavailable' })
  })
})

describe('linkTable', () => {
  test('filters each read on the party and sends writes as they are', async () => {
    const links = await linkTable()
    expect(links.userId).toBe(FAKE_USER_ID)
    await links.asAthlete('id')
    await links.asCoach('id')
    await links.insert({ coach_id: 'c1' })
    await links.update({ status: 'revoked' }).eq('id', 'l1')
    expect(fakeSupabase.calls).toMatchObject([
      { table: 'coach_athlete', op: 'select', filters: [['eq', 'athlete_id', FAKE_USER_ID]] },
      { table: 'coach_athlete', op: 'select', filters: [['eq', 'coach_id', FAKE_USER_ID]] },
      { table: 'coach_athlete', op: 'insert', payload: { coach_id: 'c1' } },
      { table: 'coach_athlete', op: 'update', payload: { status: 'revoked' }, filters: [['eq', 'id', 'l1']] },
    ])
  })

  test('has no delete and no upsert', async () => {
    expect(Object.keys(await linkTable()).sort()).toEqual(['asAthlete', 'asCoach', 'insert', 'update', 'userId'])
  })

  test('refuses without a session', async () => {
    fakeSupabase.userId = null
    await expect(linkTable()).rejects.toMatchObject({ code: 'not_signed_in' })
  })
})

describe('athleteReader', () => {
  const ATHLETE = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b'

  test('checks the active link first, then pins every read to the athlete', async () => {
    fakeSupabase.reset((call) => (call.table === 'coach_athlete' ? { data: [{ id: 'l1' }] } : { data: [] }))
    const reader = await athleteReader(ATHLETE)
    await reader.table('workout').select('id').eq('id', 'w1')
    expect(fakeSupabase.calls).toMatchObject([
      {
        table: 'coach_athlete',
        op: 'select',
        filters: [['eq', 'coach_id', FAKE_USER_ID], ['eq', 'athlete_id', ATHLETE], ['eq', 'status', 'active']],
      },
      { table: 'workout', op: 'select', ownerId: ATHLETE, filters: [['eq', 'id', 'w1']] },
    ])
  })

  test('exposes select only: there is no way to write through it', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'l1' }] }))
    const reader = await athleteReader(ATHLETE)
    expect(Object.keys(reader)).toEqual(['table'])
    expect(Object.keys(reader.table('set_log'))).toEqual(['select'])
  })

  test('refuses an id that is not a uuid before any request', async () => {
    await expect(athleteReader("x' or owner_id.neq.y")).rejects.toMatchObject({ code: 'invalid_athlete' })
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('refuses an athlete without an active link as coach', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(athleteReader(ATHLETE)).rejects.toMatchObject({ code: 'not_linked' })
    expect(fakeSupabase.calls).toHaveLength(1)
  })

  test('refuses without a session', async () => {
    fakeSupabase.userId = null
    await expect(athleteReader(ATHLETE)).rejects.toMatchObject({ code: 'not_signed_in' })
  })

  test('a failing link lookup is a DataError, never an open reader', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(athleteReader(ATHLETE)).rejects.toMatchObject({ name: 'DataError', code: 'XX000' })
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
      ownerId: FAKE_USER_ID,
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
