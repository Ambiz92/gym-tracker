import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ScheduledSession } from '../types/db'
import type { Call, FakeResult } from './fakeSupabase'
import { fakeSupabase } from './fakeSupabase'
import {
  deleteFuturePlannedSlots,
  deleteSlot,
  getSlot,
  healReconciledSlots,
  linkWorkout,
  listSlots,
  moveSlot,
  moveSlotToToday,
  reopenSlot,
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

describe('getSlot', () => {
  test('reads one slot by id', async () => {
    fakeSupabase.reset(() => ({ data: slot }))
    expect(await getSlot('x1')).toEqual(slot)
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'scheduled_session', op: 'select', filters: [['eq', 'id', 'x1']], mode: 'maybeSingle' })
  })

  test('is null for an unknown id', async () => {
    fakeSupabase.reset(() => ({ data: null }))
    expect(await getSlot('nope')).toBeNull()
  })
})

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

/**
 * Handler for the guarded actions: the slot read returns `row`, the workout lookup returns `workouts`,
 * and any write returns `write`.
 */
function guarded({ row = slot, workouts = [], write = { data: [{ id: 'x1' }] } }: { row?: object | null; workouts?: object[]; write?: FakeResult } = {}) {
  return (call: Call): FakeResult => {
    if (call.table === 'workout') return { data: workouts }
    if (call.op === 'select') return { data: row }
    return write
  }
}

const writes = (calls: Call[]) => calls.filter((call) => call.op !== 'select')

describe('updates only touch planned slots', () => {
  const planned = [['eq', 'id', 'x1'], ['eq', 'status', 'planned']]
  const guardedUpdates: [string, () => Promise<void>, object][] = [
    ['moveSlot', () => moveSlot('x1', '2026-12-01'), { date: '2026-12-01' }],
    ['moveSlotToToday', () => moveSlotToToday('x1'), { date: '2026-11-21' }],
    ['skipSlot', () => skipSlot('x1'), { status: 'skipped' }],
  ]
  const updates: [string, () => Promise<void>, object][] = [
    ...guardedUpdates,
    ['linkWorkout', () => linkWorkout('x1', 'w1'), { workout_id: 'w1', status: 'done' }],
  ]

  test.each(updates)('%s is one update filtered on id and status planned', async (_name, run, payload) => {
    fakeSupabase.reset(guarded())
    await run()
    expect(writes(fakeSupabase.calls)).toHaveLength(1)
    expect(writes(fakeSupabase.calls)[0]).toMatchObject({ table: 'scheduled_session', op: 'update', payload, filters: planned, columns: 'id' })
  })

  test.each(updates)('%s refuses a slot that is not planned (done, skipped or unknown) with not_planned', async (_name, run) => {
    fakeSupabase.reset(guarded({ write: { data: [] } }))
    await expect(run()).rejects.toMatchObject({ name: 'DataError', code: 'not_planned' })
  })

  test('moveSlotToToday uses the local date, not the UTC one', async () => {
    vi.setSystemTime(new Date(2026, 10, 21, 0, 30))
    fakeSupabase.reset(guarded())
    await moveSlotToToday('x1')
    expect(writes(fakeSupabase.calls)[0].payload).toEqual({ date: '2026-11-21' })
  })

  test('moving onto a day that already has the session is already_scheduled', async () => {
    fakeSupabase.reset(guarded({ write: duplicate }))
    await expect(moveSlot('x1', '2026-12-01')).rejects.toMatchObject({ code: 'already_scheduled' })
  })

  test('a past target date is refused before any request', async () => {
    await expect(moveSlot('x1', '2026-11-20')).rejects.toMatchObject({ name: 'DataError', code: 'past_date' })
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('a failed update is thrown with its own code', async () => {
    fakeSupabase.reset(guarded({ write: { error: { message: 'boom', code: 'XX000' } } }))
    await expect(skipSlot('x1')).rejects.toMatchObject({ code: 'XX000' })
  })

  test('no update ever sends owner_id or touches a table other than slots and the workout lookup', async () => {
    fakeSupabase.reset(guarded())
    for (const [, run] of updates) await run()
    expect(writes(fakeSupabase.calls).every((call) => call.table === 'scheduled_session')).toBe(true)
    for (const call of writes(fakeSupabase.calls)) expect(call.payload).not.toHaveProperty('owner_id')
  })
})

describe('a planned slot already completed by a workout is untouchable', () => {
  const actions: [string, () => Promise<void>][] = [
    ['moveSlot', () => moveSlot('x1', '2026-12-01')],
    ['moveSlotToToday', () => moveSlotToToday('x1')],
    ['skipSlot', () => skipSlot('x1')],
    ['deleteSlot', () => deleteSlot('x1')],
  ]
  const today = { ...slot, date: '2026-11-21' }

  test.each(actions)('%s throws already_done and writes nothing when the session has a workout that day', async (_name, run) => {
    fakeSupabase.reset(guarded({ row: today, workouts: [{ id: 'w1' }] }))
    await expect(run()).rejects.toMatchObject({ name: 'DataError', code: 'already_done' })
    expect(writes(fakeSupabase.calls)).toEqual([])
  })

  test('the lookup is for the slot session and date', async () => {
    fakeSupabase.reset(guarded({ row: today, workouts: [{ id: 'w1' }] }))
    await expect(skipSlot('x1')).rejects.toThrow()
    expect(fakeSupabase.calls.find((call) => call.table === 'workout')).toMatchObject({
      op: 'select',
      filters: [['eq', 'session_id', 's1'], ['eq', 'date', '2026-11-21']],
    })
  })

  test.each(actions)('%s goes ahead when no workout matches', async (_name, run) => {
    fakeSupabase.reset(guarded({ row: today }))
    await run()
    expect(writes(fakeSupabase.calls)).toHaveLength(1)
  })

  test.each(actions)('%s skips the workout lookup for a slot that is not planned or has no session', async (_name, run) => {
    fakeSupabase.reset(guarded({ row: { ...today, status: 'done' }, write: { data: [] } }))
    await expect(run()).rejects.toMatchObject({ code: expect.stringMatching(/^not_/) })
    expect(fakeSupabase.calls.some((call) => call.table === 'workout')).toBe(false)
  })

  test('a failing lookup stops the action', async () => {
    fakeSupabase.reset((call) => (call.table === 'workout' ? { error: { message: 'boom', code: 'XX000' } } : { data: today }))
    await expect(skipSlot('x1')).rejects.toMatchObject({ code: 'XX000' })
    expect(writes(fakeSupabase.calls)).toEqual([])
  })
})

describe('deleteSlot', () => {
  test('deletes by id only when planned and dated today or later', async () => {
    fakeSupabase.reset(guarded())
    await deleteSlot('x1')
    expect(writes(fakeSupabase.calls)).toHaveLength(1)
    expect(writes(fakeSupabase.calls)[0]).toMatchObject({
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
    fakeSupabase.reset(guarded({ write: { data: [] } }))
    await expect(deleteSlot('x1')).rejects.toMatchObject({ name: 'DataError', code: 'not_deletable' })
  })
})

describe('healReconciledSlots', () => {
  const planned: ScheduledSession = { ...slot, owner_id: 'o', status: 'planned', workout_id: null, series_id: null, created_at: '2026-11-01T08:00:00Z' } as ScheduledSession
  const workout = { id: 'w1', session_id: 's1', date: '2026-11-27' }

  test('links each planned slot a workout of its session and day completes', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'x1' }] }))
    await healReconciledSlots([planned, { ...planned, id: 'x2', date: '2026-11-28' }], [workout])
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      op: 'update',
      payload: { workout_id: 'w1', status: 'done' },
      filters: [['eq', 'id', 'x1'], ['eq', 'status', 'planned']],
    })
  })

  test('does nothing when no slot is completed by a workout', async () => {
    await healReconciledSlots([planned], [])
    await healReconciledSlots([{ ...planned, status: 'done' }, { ...planned, status: 'skipped' }], [workout])
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('a failed or refused link is silent', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(healReconciledSlots([planned], [workout])).resolves.toBeUndefined()
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(healReconciledSlots([planned], [workout])).resolves.toBeUndefined()
  })
})

describe('reopenSlot', () => {
  test('puts back to planned only a done slot linked to that workout', async () => {
    await reopenSlot('x1', 'w1')
    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'update',
      payload: { status: 'planned', workout_id: null },
      filters: [['eq', 'id', 'x1'], ['eq', 'status', 'done'], ['eq', 'workout_id', 'w1']],
    })
  })

  test('a failure is silent', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(reopenSlot('x1', 'w1')).resolves.toBeUndefined()
  })
})

describe('deleteFuturePlannedSlots', () => {
  const futureSlots = [
    { id: 'a', plan_session_id: 's1', date: '2026-11-21' },
    { id: 'b', plan_session_id: 's1', date: '2026-11-28' },
    { id: 'c', plan_session_id: 's2', date: '2026-11-21' },
  ]
  const handler = (workouts: object[]) => (call: Call): FakeResult | undefined =>
    call.op === 'select' ? { data: call.table === 'workout' ? workouts : futureSlots } : undefined

  test('reads only planned, workout-less slots from today on, of the given sessions', async () => {
    fakeSupabase.reset(handler([]))
    await deleteFuturePlannedSlots(['s1', 's2'])
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'select',
      filters: [
        ['in', 'plan_session_id', ['s1', 's2']],
        ['eq', 'status', 'planned'],
        ['is', 'workout_id', null],
        ['gte', 'date', '2026-11-21'],
      ],
    })
  })

  test('deletes them in one statement that repeats the safety filters', async () => {
    fakeSupabase.reset(handler([]))
    await deleteFuturePlannedSlots(['s1', 's2'])
    expect(writes(fakeSupabase.calls)).toHaveLength(1)
    expect(writes(fakeSupabase.calls)[0]).toMatchObject({
      table: 'scheduled_session',
      op: 'delete',
      filters: [
        ['in', 'id', ['a', 'b', 'c']],
        ['eq', 'status', 'planned'],
        ['is', 'workout_id', null],
        ['gte', 'date', '2026-11-21'],
      ],
    })
  })

  test('spares a slot its session already has a workout for (link failed), and only that one', async () => {
    fakeSupabase.reset(handler([{ session_id: 's1', date: '2026-11-21' }]))
    await deleteFuturePlannedSlots(['s1', 's2'])
    expect(fakeSupabase.calls[1]).toMatchObject({ table: 'workout', op: 'select', filters: [['in', 'session_id', ['s1', 's2']], ['gte', 'date', '2026-11-21']] })
    expect(writes(fakeSupabase.calls)[0].filters[0]).toEqual(['in', 'id', ['b', 'c']])
  })

  test('deletes nothing when every slot is completed by a workout', async () => {
    fakeSupabase.reset(handler([{ session_id: 's1', date: '2026-11-21' }, { session_id: 's1', date: '2026-11-28' }, { session_id: 's2', date: '2026-11-21' }]))
    await deleteFuturePlannedSlots(['s1', 's2'])
    expect(writes(fakeSupabase.calls)).toEqual([])
  })

  test('no slot to remove means no workout lookup and no delete', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await deleteFuturePlannedSlots(['s1'])
    expect(fakeSupabase.calls).toHaveLength(1)
  })

  test('no sessions means no request', async () => {
    await deleteFuturePlannedSlots([])
    expect(fakeSupabase.calls).toHaveLength(0)
  })

  test('a failure is thrown', async () => {
    fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
    await expect(deleteFuturePlannedSlots(['s1'])).rejects.toMatchObject({ code: 'XX000' })
  })

  test('a failing delete is thrown too', async () => {
    fakeSupabase.reset((call) => (call.op === 'delete' ? { error: { message: 'boom', code: 'XX000' } } : handler([])(call)))
    await expect(deleteFuturePlannedSlots(['s1'])).rejects.toMatchObject({ code: 'XX000' })
  })
})
