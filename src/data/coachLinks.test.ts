import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CoachLink } from '../types/db'
import { acceptLink, loadCoachLinks, requestCoach, revokeLink } from './coachLinks'
import type { Call } from './fakeSupabase'
import { FAKE_USER_ID, fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const COACH = '9a7b0c1d-2e3f-4a5b-8c1e-5d4a4e6f3f2b'
const row = { id: 'l1', coach_id: COACH, athlete_id: FAKE_USER_ID, status: 'pending', athlete_label: 'Marta' } as CoachLink

const failure = (code: string, message: string) => ({ error: { code, message } })

beforeEach(() => fakeSupabase.reset())

describe('loadCoachLinks', () => {
  test('reads both sides newest first, filtered on the party, and returns the user id as the code', async () => {
    const asCoach = { ...row, id: 'l2' }
    fakeSupabase.reset((call: Call) => ({ data: call.filters.some(([, column]) => column === 'coach_id') ? [asCoach] : [row] }))
    expect(await loadCoachLinks()).toEqual({ userId: FAKE_USER_ID, asAthlete: [row], asCoach: [asCoach] })
    expect(fakeSupabase.calls).toHaveLength(2)
    expect(fakeSupabase.calls).toMatchObject([
      { table: 'coach_athlete', op: 'select', filters: [['eq', 'athlete_id', FAKE_USER_ID]], orders: [{ column: 'created_at', ascending: false }] },
      { table: 'coach_athlete', op: 'select', filters: [['eq', 'coach_id', FAKE_USER_ID]], orders: [{ column: 'created_at', ascending: false }] },
    ])
  })

  test('a failed read is thrown, not shown as an empty list', async () => {
    fakeSupabase.reset(() => failure('XX000', 'boom'))
    await expect(loadCoachLinks()).rejects.toMatchObject({ name: 'DataError', code: 'XX000' })
  })

  test('refuses without a session', async () => {
    fakeSupabase.userId = null
    await expect(loadCoachLinks()).rejects.toMatchObject({ code: 'not_signed_in' })
  })
})

describe('requestCoach', () => {
  test('inserts only the coach and the label, never the athlete, status or timestamps', async () => {
    fakeSupabase.reset(() => ({ data: row }))
    expect(await requestCoach(COACH, 'Marta')).toEqual(row)
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'coach_athlete', op: 'insert', mode: 'single' })
    expect(fakeSupabase.calls[0].payload).toEqual({ coach_id: COACH, athlete_label: 'Marta' })
  })

  test.each([
    ['an unknown coach uuid', failure('23503', 'insert or update on table "coach_athlete" violates foreign key constraint'), 'unknown_coach'],
    ['a malformed uuid', failure('22P02', 'invalid input syntax for type uuid'), 'invalid_code'],
    ['the athlete’s own code', failure('23514', 'new row for relation "coach_athlete" violates check constraint "coach_athlete_not_self"'), 'self_link'],
    ['a label the database refuses', failure('23514', 'new row for relation "coach_athlete" violates check constraint "coach_athlete_athlete_label_check"'), 'invalid_label'],
    ['a second link with the same coach', failure('23505', 'duplicate key value violates unique constraint "coach_athlete_pair_key"'), 'link_exists'],
    ['a second open link', failure('23505', 'duplicate key value violates unique constraint "coach_athlete_one_open_link_per_athlete"'), 'already_has_coach'],
    ['a refused insert', failure('42501', 'new row violates row-level security policy for table "coach_athlete"'), 'not_allowed'],
  ])('maps %s to %s', async (_name, result, code) => {
    fakeSupabase.reset(() => result)
    await expect(requestCoach(COACH, 'Marta')).rejects.toMatchObject({ name: 'DataError', code, cause: { code: result.error.code } })
  })

  test('keeps the code of a failure it has no wording for', async () => {
    fakeSupabase.reset(() => failure('23505', 'duplicate key value violates unique constraint "something_else"'))
    await expect(requestCoach(COACH, 'Marta')).rejects.toMatchObject({ code: '23505' })
    fakeSupabase.reset(() => failure('XX000', 'boom'))
    await expect(requestCoach(COACH, 'Marta')).rejects.toMatchObject({ code: 'XX000' })
  })
})

describe('status changes', () => {
  test('accept sends only status active, for a pending row of that id', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'l1' }] }))
    await acceptLink('l1')
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'coach_athlete',
      op: 'update',
      payload: { status: 'active' },
      columns: 'id',
      filters: [['eq', 'id', 'l1'], ['in', 'status', ['pending']]],
    })
  })

  test('revoke sends only status revoked, for a pending or active row', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'l1' }] }))
    await revokeLink('l1')
    expect(fakeSupabase.calls[0]).toMatchObject({
      op: 'update',
      payload: { status: 'revoked' },
      filters: [['eq', 'id', 'l1'], ['in', 'status', ['pending', 'active']]],
    })
  })

  test.each([
    ['accept', acceptLink],
    ['revoke', revokeLink],
  ])('%s of a row that no longer matches is not_found', async (_name, run) => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(run('l1')).rejects.toMatchObject({ code: 'not_found' })
  })

  test('a refusal of the trigger or the policy (aal1 with an enrolled factor, forbidden transition) is not_allowed', async () => {
    fakeSupabase.reset(() => failure('42501', 'coach_athlete: transition revoked to active not allowed'))
    await expect(acceptLink('l1')).rejects.toMatchObject({ code: 'not_allowed' })
    await expect(revokeLink('l1')).rejects.toMatchObject({ code: 'not_allowed' })
  })
})
