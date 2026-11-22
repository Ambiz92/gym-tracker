import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadAthleteData } from './athletes'
import type { Call, FakeResult } from './fakeSupabase'
import { FAKE_USER_ID, fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const ATHLETE = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b'

const workout = { id: 'w1', date: '2026-11-20', session_name: 'A', notes: 'spalla ok', set_log: [] }
const exercise = { id: 'e1', name: 'Panca', equipment: 'barbell', archived: false, starting_weight_kg: 40, notes: null }
const plan = { id: 'p1', name: 'Scheda', is_active: true, plan_session: [] }

/** Link lookup answers `linked`; each data table answers its own rows. */
function handler(linked: boolean, overrides: Partial<Record<string, FakeResult>> = {}) {
  const tables: Record<string, FakeResult> = {
    workout: { data: [workout] },
    exercise: { data: [exercise] },
    set_log: { data: [{ exercise_id: 'e1', weight_kg: 42.5, workout: { date: '2026-11-20' } }] },
    plan: { data: [plan] },
    ...overrides,
  }
  return (call: Call): FakeResult => (call.table === 'coach_athlete' ? { data: linked ? [{ id: 'l1' }] : [] } : tables[call.table])
}

beforeEach(() => fakeSupabase.reset())

describe('loadAthleteData', () => {
  test('returns workouts with notes, exercises, sets with their dates and plans', async () => {
    fakeSupabase.reset(handler(true))
    expect(await loadAthleteData(ATHLETE, 10)).toEqual({
      workouts: [workout],
      exercises: [exercise],
      sets: [{ exercise_id: 'e1', weight_kg: 42.5, date: '2026-11-20' }],
      plans: [plan],
    })
  })

  test('reads only, and every data read is pinned to the athlete', async () => {
    fakeSupabase.reset(handler(true))
    await loadAthleteData(ATHLETE, 10)
    const dataCalls = fakeSupabase.calls.filter((call) => call.table !== 'coach_athlete')
    expect(dataCalls.map((call) => call.table).sort()).toEqual(['exercise', 'plan', 'set_log', 'workout'])
    for (const call of dataCalls) expect(call).toMatchObject({ op: 'select', ownerId: ATHLETE })
    expect(fakeSupabase.calls.every((call) => call.op === 'select')).toBe(true)
    expect(fakeSupabase.calls.some((call) => call.ownerId === FAKE_USER_ID)).toBe(false)
  })

  test('limits the workouts, newest first, and leaves archived plans and sessions out', async () => {
    fakeSupabase.reset(handler(true))
    await loadAthleteData(ATHLETE, 7)
    const byTable = (table: string) => fakeSupabase.calls.find((call) => call.table === table)!
    expect(byTable('workout')).toMatchObject({
      limit: 7,
      orders: [{ column: 'date', ascending: false }, { column: 'created_at', ascending: false }],
    })
    expect(byTable('plan').filters).toEqual([['eq', 'archived', false], ['eq', 'plan_session.archived', false]])
  })

  test('without an active link nothing is read at all', async () => {
    fakeSupabase.reset(handler(false))
    await expect(loadAthleteData(ATHLETE, 10)).rejects.toMatchObject({ code: 'not_linked' })
    expect(fakeSupabase.calls.map((call) => call.table)).toEqual(['coach_athlete'])
  })

  test('a route id that is not a uuid is refused before any request', async () => {
    await expect(loadAthleteData('../../x', 10)).rejects.toMatchObject({ code: 'invalid_athlete' })
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('a failed read is thrown', async () => {
    fakeSupabase.reset(handler(true, { plan: { error: { message: 'boom', code: 'XX000' } } }))
    await expect(loadAthleteData(ATHLETE, 10)).rejects.toMatchObject({ name: 'DataError', code: 'XX000' })
  })

  test('reads the sets page by page', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ exercise_id: 'e1', weight_kg: i, workout: { date: '2026-11-20' } }))
    let pages = 0
    fakeSupabase.reset((call) => {
      if (call.table !== 'set_log') return handler(true)(call)
      pages += 1
      return { data: pages === 1 ? full : [full[0]] }
    })
    const { sets } = await loadAthleteData(ATHLETE, 10)
    expect(sets).toHaveLength(1001)
    expect(fakeSupabase.calls.filter((call) => call.table === 'set_log').map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
  })
})
