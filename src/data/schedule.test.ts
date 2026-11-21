import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fakeSupabase } from './fakeSupabase'
import {
  deleteFuturePlannedSlots,
  deleteSlot,
  linkWorkout,
  listSlots,
  moveSlot,
  moveSlotToToday,
  scheduleRepeating,
  scheduleSession,
  skipSlot,
} from './schedule'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const duplicate = { error: { message: 'duplicate key value', code: '23505' } }
const slot = { id: 'x1', plan_session_id: 's1', session_name: 'A', date: '2026-11-27', status: 'planned' }

beforeEach(() => {
  fakeSupabase.reset()
  // Late evening local time: the UTC date would already be the next day in a UTC+ zone.
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 21, 23, 30))
})
afterEach(() => vi.useRealTimers())

describe('listSlots', () => {
  test('reads the inclusive date range ordered by date', async () => {
    fakeSupabase.reset(() => ({ data: [slot] }))
    expect(await listSlots('2026-11-01', '2026-11-30')).toEqual([slot])
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'select',
      filters: [
        ['gte', 'date', '2026-11-01'],
        ['lte', 'date', '2026-11-30'],
      ],
      orders: [
        { column: 'date', ascending: true },
        { column: 'created_at', ascending: true },
      ],
    })
  })

  test('a failed query is thrown as a DataError', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(listSlots('2026-11-01', '2026-11-30')).rejects.toMatchObject({ name: 'DataError', code: 'XX000' })
  })
})

describe('scheduleSession', () => {
  test('inserts one slot with the date it is given, and no owner, status or default date', async () => {
    fakeSupabase.reset(() => ({ data: slot }))
    expect(await scheduleSession('s1', 'A', '2026-11-27')).toEqual(slot)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'insert',
      payload: { plan_session_id: 's1', session_name: 'A', date: '2026-11-27' },
      mode: 'single',
    })
    expect(Object.keys(fakeSupabase.calls[0].payload as object).sort()).toEqual(['date', 'plan_session_id', 'session_name'])
  })

  test('the same session twice on one day is a clear already_scheduled error', async () => {
    fakeSupabase.reset(() => duplicate)
    await expect(scheduleSession('s1', 'A', '2026-11-27')).rejects.toMatchObject({
      name: 'DataError',
      code: 'already_scheduled',
      cause: { code: '23505' },
    })
  })

  test('other failures keep their own code', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'violates check', code: '23514' } }))
    await expect(scheduleSession('s1', '', '2026-11-27')).rejects.toMatchObject({ code: '23514' })
  })
})

describe('scheduleRepeating', () => {
  test('sends one batch insert of weekly local dates sharing a series_id', async () => {
    fakeSupabase.reset(() => ({ data: [slot] }))
    await scheduleRepeating('s1', 'A', '2026-10-22', 3)

    expect(fakeSupabase.calls).toHaveLength(1)
    const [call] = fakeSupabase.calls
    expect(call).toMatchObject({ table: 'scheduled_session', op: 'insert' })
    const rows = call.payload as { date: string; series_id: string; plan_session_id: string; session_name: string }[]
    // 2026-10-25 is the end of daylight saving in Europe: the dates must stay a week apart.
    expect(rows.map((row) => row.date)).toEqual(['2026-10-22', '2026-10-29', '2026-11-05'])
    expect(new Set(rows.map((row) => row.series_id)).size).toBe(1)
    expect(rows[0].series_id).toMatch(/^[0-9a-f-]{36}$/)
    for (const row of rows) expect(row).toMatchObject({ plan_session_id: 's1', session_name: 'A' })
  })

  test('different batches get different series', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await scheduleRepeating('s1', 'A', '2026-11-27', 2)
    await scheduleRepeating('s1', 'A', '2026-11-27', 2)
    const [first, second] = fakeSupabase.calls.map((call) => (call.payload as { series_id: string }[])[0].series_id)
    expect(first).not.toBe(second)
  })

  test('a clash on any day rejects the batch with already_scheduled', async () => {
    fakeSupabase.reset(() => duplicate)
    await expect(scheduleRepeating('s1', 'A', '2026-11-27', 4)).rejects.toMatchObject({ code: 'already_scheduled' })
  })

  test('an invalid number of weeks is refused before any request', async () => {
    await expect(scheduleRepeating('s1', 'A', '2026-11-27', 0)).rejects.toBeInstanceOf(RangeError)
    await expect(scheduleRepeating('s1', 'A', '2026-11-27', 13)).rejects.toBeInstanceOf(RangeError)
    expect(fakeSupabase.calls).toHaveLength(0)
  })
})

describe('updates only touch planned slots', () => {
  const planned = [['eq', 'id', 'x1'], ['eq', 'status', 'planned']]
  const updates: [string, () => Promise<void>, object][] = [
    ['moveSlot', () => moveSlot('x1', '2026-12-01'), { date: '2026-12-01' }],
    ['moveSlotToToday', () => moveSlotToToday('x1'), { date: '2026-11-21' }],
    ['skipSlot', () => skipSlot('x1'), { status: 'skipped' }],
    ['linkWorkout', () => linkWorkout('x1', 'w1'), { workout_id: 'w1', status: 'done' }],
  ]

  test.each(updates)('%s is one update filtered on id and status planned', async (_name, run, payload) => {
    fakeSupabase.reset(() => ({ data: [{ id: 'x1' }] }))
    await run()
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'scheduled_session', op: 'update', payload, filters: planned, columns: 'id' })
  })

  test.each(updates)('%s refuses a slot that is not planned (done, skipped or unknown) with not_planned', async (_name, run) => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(run()).rejects.toMatchObject({ name: 'DataError', code: 'not_planned' })
  })

  test('moveSlotToToday uses the local date, not the UTC one', async () => {
    vi.setSystemTime(new Date(2026, 10, 21, 0, 30))
    fakeSupabase.reset(() => ({ data: [{ id: 'x1' }] }))
    await moveSlotToToday('x1')
    expect(fakeSupabase.calls[0].payload).toEqual({ date: '2026-11-21' })
  })

  test('moving onto a day that already has the session is already_scheduled', async () => {
    fakeSupabase.reset(() => duplicate)
    await expect(moveSlot('x1', '2026-12-01')).rejects.toMatchObject({ code: 'already_scheduled' })
  })

  test('a failed update is thrown with its own code', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(skipSlot('x1')).rejects.toMatchObject({ code: 'XX000' })
  })

  test('no update ever sends owner_id or touches another table', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'x1' }] }))
    for (const [, run] of updates) await run()
    expect(fakeSupabase.calls.every((call) => call.table === 'scheduled_session')).toBe(true)
    for (const call of fakeSupabase.calls) expect(call.payload).not.toHaveProperty('owner_id')
  })
})

describe('deleteSlot', () => {
  test('deletes by id only when planned and dated today or later', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'x1' }] }))
    await deleteSlot('x1')
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'delete',
      filters: [
        ['eq', 'id', 'x1'],
        ['eq', 'status', 'planned'],
        ['gte', 'date', '2026-11-21'],
      ],
      columns: 'id',
    })
  })

  test('refuses a done, skipped or past slot with not_deletable', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(deleteSlot('x1')).rejects.toMatchObject({ name: 'DataError', code: 'not_deletable' })
  })
})

describe('deleteFuturePlannedSlots', () => {
  test('one delete limited to planned, workout-less slots from today on, of the given sessions', async () => {
    await deleteFuturePlannedSlots(['s1', 's2'])
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'delete',
      filters: [
        ['in', 'plan_session_id', ['s1', 's2']],
        ['eq', 'status', 'planned'],
        ['is', 'workout_id', null],
        ['gte', 'date', '2026-11-21'],
      ],
    })
  })

  test('no sessions means no request', async () => {
    await deleteFuturePlannedSlots([])
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('a failure is thrown', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(deleteFuturePlannedSlots(['s1'])).rejects.toMatchObject({ code: 'XX000' })
  })
})
