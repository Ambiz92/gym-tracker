import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import type { Call, FakeResult } from './fakeSupabase'
import {
  addPlanExercise,
  addSession,
  archivePlan,
  createPlanWithSession,
  deactivatePlan,
  deletePlan,
  duplicateSession,
  getActivePlanHead,
  listPlanSummaries,
  duplicatePlan,
  removeSession,
  renamePlan,
  restorePlan,
  restoreSession,
  reorderPlanExercises,
  restorePlanExercise,
  reorderSessions,
  setActivePlan,
  updatePlanExercise,
  updateSession,
} from './plans'
import type { PlanExerciseDetail, SessionDetail } from './activePlan'
import type { PlanExercise, PlanSession } from '../types/db'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'violates check', code: '23514' } }
const summary = (c: Call) => `${c.table}.${c.op}`

// Local "today" of the tests (late evening: the UTC date would already be the next day in UTC+ zones).
const TODAY = '2026-11-21'
const isSlotDeletion = (c: Call) => c.table === 'scheduled_session' && c.op === 'delete'

/** The only slots a cleanup may read for deletion: planned, workout-less, dated today or later, of the given sessions. */
const futurePlannedFilters = (sessionIds: string[]) => [
  ['in', 'plan_session_id', sessionIds],
  ['eq', 'status', 'planned'],
  ['is', 'workout_id', null],
  ['gte', 'date', TODAY],
]

const isSlotRead = (c: Call) => c.table === 'scheduled_session' && c.op === 'select'

/** The cleanup reads, then deletes by id: one future slot of `sessionId`, no workout completing it. */
const cleanupReads = (c: Call, sessionId = 's1'): FakeResult | undefined => {
  if (isSlotRead(c)) return { data: [{ id: 'f1', plan_session_id: sessionId, date: TODAY }] }
  return c.table === 'workout' ? { data: [] } : undefined
}

/** The same four calls every slot cleanup makes after the sessions are known. */
const CLEANUP_CALLS = ['scheduled_session.select', 'workout.select', 'scheduled_session.delete']

/** Nothing but slot deletions may delete or change history-bearing tables. */
const historyCalls = (calls: Call[]) => calls.filter((c) => c.op !== 'select' && ['workout', 'set_log'].includes(c.table))

beforeEach(() => {
  fakeSupabase.reset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 21, 23, 30))
})
afterEach(() => vi.useRealTimers())

describe('setActivePlan', () => {
  const isLookup = (call: Call) => call.table === 'plan' && call.op === 'select'
  const isDeactivation = (call: Call) => call.op === 'update' && call.filters[0][0] === 'eq' && call.filters[0][1] === 'is_active'
  const isActivation = (call: Call) => call.op === 'update' && (call.payload as { is_active: boolean }).is_active && !isDeactivation(call)

  /** Fake where the target exists and the old plan is deactivated; `overrides` replace single steps. */
  const scenario = (
    overrides: { activation?: FakeResult; restore?: FakeResult; lookup?: FakeResult; sessions?: FakeResult; slots?: FakeResult } = {},
  ) =>
    fakeSupabase.reset((call) => {
      if (isLookup(call)) return overrides.lookup ?? { data: { archived: false } }
      if (isDeactivation(call)) return { data: [{ id: 'old' }] }
      if (isActivation(call)) return overrides.activation ?? { data: [{ id: 'new' }] }
      if (call.table === 'plan_session') return overrides.sessions ?? { data: [{ id: 's-old-1' }, { id: 's-old-2' }] }
      if (isSlotDeletion(call)) return overrides.slots
      return cleanupReads(call, 's-old-1') ?? overrides.restore
    })

  test('checks the target, deactivates the old plan, then activates the new one', async () => {
    scenario()
    expect(await setActivePlan('new')).toEqual({ ok: true })

    expect(fakeSupabase.calls).toHaveLength(3 + 1 + CLEANUP_CALLS.length)
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan', op: 'select', filters: [['eq', 'id', 'new']], mode: 'maybeSingle' })
    expect(fakeSupabase.calls[1]).toMatchObject({
      table: 'plan',
      op: 'update',
      payload: { is_active: false },
      filters: [
        ['eq', 'is_active', true],
        ['neq', 'id', 'new'],
      ],
    })
    expect(fakeSupabase.calls[2]).toMatchObject({
      table: 'plan',
      op: 'update',
      payload: { is_active: true },
      filters: [['eq', 'id', 'new']],
      columns: 'id',
    })
  })

  test('then removes the future planned slots of the previous plan only, after the switch is saved', async () => {
    scenario()
    await setActivePlan('new')

    expect(fakeSupabase.calls.slice(3).map(summary)).toEqual(['plan_session.select', ...CLEANUP_CALLS])
    expect(fakeSupabase.calls[3]).toMatchObject({ filters: [['in', 'plan_id', ['old']]] })
    expect(fakeSupabase.calls[4].filters).toEqual(futurePlannedFilters(['s-old-1', 's-old-2']))
    expect(fakeSupabase.calls[6]).toMatchObject({ op: 'delete', filters: [['in', 'id', ['f1']], ['eq', 'status', 'planned'], ['is', 'workout_id', null], ['gte', 'date', TODAY]] })
    expect(historyCalls(fakeSupabase.calls)).toEqual([])
  })

  test('a failing slot cleanup is reported, not thrown: the switch stands', async () => {
    scenario({ slots: failure })
    const result = await setActivePlan('new')

    expect(result).toMatchObject({ ok: false, error: { name: 'DataError', code: '23514' } })
    expect(fakeSupabase.calls.filter((c) => c.table === 'plan').map((c) => c.payload)).toEqual([
      undefined,
      { is_active: false },
      { is_active: true },
    ])
  })

  test('a failing session lookup is reported the same way and deletes nothing', async () => {
    scenario({ sessions: failure })
    expect(await setActivePlan('new')).toMatchObject({ ok: false })
    expect(fakeSupabase.calls.some(isSlotDeletion)).toBe(false)
  })

  test('a rolled-back or failed switch leaves every slot alone', async () => {
    scenario({ activation: failure })
    await expect(setActivePlan('new')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls.some((c) => c.table === 'scheduled_session' || c.table === 'plan_session')).toBe(false)
  })

  test('refuses a missing target before touching the active plan', async () => {
    scenario({ lookup: { data: null } })
    await expect(setActivePlan('ghost')).rejects.toMatchObject({ name: 'DataError', code: 'not_found' })
    expect(fakeSupabase.calls).toHaveLength(1)
  })

  test('refuses an archived target before touching the active plan', async () => {
    scenario({ lookup: { data: { archived: true } } })
    await expect(setActivePlan('old-news')).rejects.toMatchObject({ name: 'DataError', code: 'archived' })
    expect(fakeSupabase.calls).toHaveLength(1)
  })

  test('puts the old plan back when the activation fails, and still throws', async () => {
    scenario({ activation: failure })
    await expect(setActivePlan('new')).rejects.toMatchObject({ code: '23514' })

    expect(fakeSupabase.calls).toHaveLength(4)
    expect(fakeSupabase.calls[3]).toMatchObject({
      payload: { is_active: true },
      filters: [['in', 'id', ['old']]],
    })
  })

  test('puts the old plan back when the activation matches no row (RLS-hidden), and throws not_found', async () => {
    scenario({ activation: { data: [] } })
    await expect(setActivePlan('new')).rejects.toMatchObject({ name: 'DataError', code: 'not_found' })

    expect(fakeSupabase.calls).toHaveLength(4)
    expect(fakeSupabase.calls[3]).toMatchObject({ payload: { is_active: true }, filters: [['in', 'id', ['old']]] })
  })

  test('reports that no plan is active when the restore fails too', async () => {
    scenario({ activation: failure, restore: failure })
    const error = await setActivePlan('new').catch((e) => e)
    expect(error).toBeInstanceOf(DataError)
    expect(error.message).toContain('no plan is active')
    expect(error.code).toBe('23514')
  })

  test('does not activate anything when the deactivation fails', async () => {
    fakeSupabase.reset((call) => (isLookup(call) ? { data: { archived: false } } : failure))
    await expect(setActivePlan('new')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls).toHaveLength(2)
  })

  test('with no previously active plan there is nothing to restore', async () => {
    fakeSupabase.reset((call) => {
      if (isLookup(call)) return { data: { archived: false } }
      return { data: [] }
    })
    await expect(setActivePlan('new')).rejects.toMatchObject({ code: 'not_found' })
    expect(fakeSupabase.calls).toHaveLength(3)
  })

  test('with no previous active plan there is no slot cleanup', async () => {
    fakeSupabase.reset((call) => {
      if (isLookup(call)) return { data: { archived: false } }
      return { data: isActivation(call) ? [{ id: 'new' }] : [] }
    })
    expect(await setActivePlan('new')).toEqual({ ok: true })
    expect(fakeSupabase.calls).toHaveLength(3)
  })
})

test('archivePlan clears is_active in the same update (check constraint)', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'p1' }] }))
  await archivePlan('p1')
  expect(fakeSupabase.calls[0]).toMatchObject({
    op: 'update',
    payload: { archived: true, is_active: false },
    columns: 'id',
  })
})

describe.each([
  ['deactivatePlan', deactivatePlan],
  ['archivePlan', archivePlan],
])('%s removes the future planned slots of the plan', (_name, run) => {
  const handler = (slots?: FakeResult, sessions?: FakeResult) => (call: Call) => {
    if (call.table === 'plan_session') return sessions ?? { data: [{ id: 's1' }] }
    if (isSlotDeletion(call)) return slots
    return cleanupReads(call) ?? { data: [{ id: 'p1' }] }
  }

  test('after the plan update, and only those of its own sessions', async () => {
    fakeSupabase.reset(handler())
    expect(await run('p1')).toEqual({ ok: true })

    expect(fakeSupabase.calls.map(summary)).toEqual(['plan.update', 'plan_session.select', ...CLEANUP_CALLS])
    expect(fakeSupabase.calls[1]).toMatchObject({ filters: [['in', 'plan_id', ['p1']]] })
    expect(fakeSupabase.calls[2].filters).toEqual(futurePlannedFilters(['s1']))
    expect(historyCalls(fakeSupabase.calls)).toEqual([])
  })

  test('a failing cleanup is reported and the plan change stands', async () => {
    fakeSupabase.reset(handler(failure))
    expect(await run('p1')).toMatchObject({ ok: false, error: { code: '23514' } })
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan', op: 'update' })
  })

  test('a plan that does not match is not_found and nothing else runs', async () => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(run('ghost')).rejects.toMatchObject({ code: 'not_found' })
    expect(fakeSupabase.calls).toHaveLength(1)
  })
})

describe('single-row updates fail when no row matches', () => {
  const updates: [string, () => Promise<unknown>, object][] = [
    ['renamePlan', () => renamePlan('p1', 'New'), { table: 'plan', payload: { name: 'New' } }],
    ['archivePlan', () => archivePlan('p1'), { table: 'plan' }],
    ['restorePlan', () => restorePlan('p1'), { table: 'plan', payload: { archived: false } }],
    ['updateSession', () => updateSession('s1', { name: 'B' }), { table: 'plan_session', payload: { name: 'B' } }],
    ['updatePlanExercise', () => updatePlanExercise('x1', { target_sets: 4 }), { table: 'plan_exercise', payload: { target_sets: 4 } }],
  ]

  test.each(updates)('%s updates by id, asks for the id back and succeeds on a match', async (_name, run, expected) => {
    fakeSupabase.reset(() => ({ data: [{ id: 'row' }] }))
    await run()
    expect(fakeSupabase.calls[0]).toMatchObject({ ...expected, op: 'update', columns: 'id' })
    expect(fakeSupabase.calls[0].filters).toHaveLength(1)
    expect(fakeSupabase.calls[0].filters[0].slice(0, 2)).toEqual(['eq', 'id'])
  })

  test.each(updates)('%s throws not_found on an empty result', async (_name, run) => {
    fakeSupabase.reset(() => ({ data: [] }))
    await expect(run()).rejects.toMatchObject({ name: 'DataError', code: 'not_found' })
  })
})

describe('reorder', () => {
  const session = (id: string, name: string): PlanSession => ({
    id,
    owner_id: 'me',
    plan_id: 'p1',
    name,
    subtitle: null,
    position: 99,
    is_optional: false,
    archived: false,
  })

  test('reorderSessions sends one upsert on id with all not-null columns and fresh positions', async () => {
    await reorderSessions([session('s2', 'B'), session('s1', 'A')])

    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'plan_session',
      op: 'upsert',
      options: { onConflict: 'id' },
      payload: [
        { id: 's2', plan_id: 'p1', name: 'B', subtitle: null, is_optional: false, archived: false, position: 0 },
        { id: 's1', plan_id: 'p1', name: 'A', subtitle: null, is_optional: false, archived: false, position: 1 },
      ],
    })
    const [first] = fakeSupabase.calls[0].payload as object[]
    expect(first).not.toHaveProperty('owner_id')
  })

  test('reorderPlanExercises drops joined data and carries every not-null column', async () => {
    const row = {
      id: 'x1',
      owner_id: 'me',
      session_id: 's1',
      exercise_id: 'e1',
      position: 5,
      target_sets: 3,
      target_reps: 8,
      target_unit: 'reps',
      suggested_weight_kg: null,
      suggested_weight_max_kg: null,
      exercise: { id: 'e1' },
    } as PlanExercise
    await reorderPlanExercises([row])

    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan_exercise', op: 'upsert', options: { onConflict: 'id' } })
    expect(fakeSupabase.calls[0].payload).toEqual([
      {
        id: 'x1',
        session_id: 's1',
        exercise_id: 'e1',
        position: 0,
        target_sets: 3,
        target_reps: 8,
        target_unit: 'reps',
        suggested_weight_kg: null,
        suggested_weight_max_kg: null,
      },
    ])
  })

  test('a failed upsert is thrown', async () => {
    fakeSupabase.reset(() => failure)
    await expect(reorderSessions([session('s1', 'A')])).rejects.toBeInstanceOf(DataError)
  })
})

describe('append position', () => {
  test('addSession goes after the last session', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [{ position: 2 }] } : { data: { id: 's4' } }))
    await addSession('p1', { name: 'D' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_session.select', 'plan_session.insert'])
    expect(fakeSupabase.calls[1].payload).toEqual({ name: 'D', plan_id: 'p1', position: 3 })
  })

  test('addPlanExercise starts at 0 in an empty session', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : { data: { id: 'x1' } }))
    await addPlanExercise('s1', { exercise_id: 'e1', target_sets: 3, target_reps: 8 })
    expect(fakeSupabase.calls[1].payload).toMatchObject({ session_id: 's1', position: 0 })
  })
})

describe('removing a session', () => {
  /** The history check answers `logged`; the slot cleanup reads find one future slot and no workout. */
  const removalReads = (logged: boolean) => (call: Call) => {
    if (call.table === 'workout' && call.columns === 'id') return { data: logged ? [{ id: 'w1' }] : [] }
    return call.table === 'plan_session' ? { data: [{ id: 's1' }] } : cleanupReads(call)
  }

  test('with workouts it is archived first, then its future slots go: the session id stays, so they are still findable', async () => {
    fakeSupabase.reset(removalReads(true))
    expect(await removeSession('s1')).toBe('archived')
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', 'plan_session.update', ...CLEANUP_CALLS])
    expect(fakeSupabase.calls[1]).toMatchObject({ payload: { archived: true }, filters: [['eq', 'id', 's1']] })
  })

  test('without workouts its slots go first, then it is deleted (deleting would null the slots session)', async () => {
    fakeSupabase.reset(removalReads(false))
    expect(await removeSession('s1')).toBe('deleted')
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', ...CLEANUP_CALLS, 'plan_session.delete'])
  })

  test('only deletes its future planned slots, so past, done and skipped ones stay and no workout is touched', async () => {
    fakeSupabase.reset(removalReads(false))
    await removeSession('s1')
    expect(fakeSupabase.calls.filter(isSlotDeletion)).toHaveLength(1)
    expect(fakeSupabase.calls.find(isSlotRead)!.filters).toEqual(futurePlannedFilters(['s1']))
    expect(historyCalls(fakeSupabase.calls)).toEqual([])
  })

  test('a failing slot cleanup stops a delete before the session is touched', async () => {
    fakeSupabase.reset((call) => (isSlotDeletion(call) ? failure : removalReads(false)(call)))
    await expect(removeSession('s1')).rejects.toMatchObject({ name: 'DataError', code: '23514' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', ...CLEANUP_CALLS])
  })

  test('a failing archive deletes no slot', async () => {
    fakeSupabase.reset((call) => (call.table === 'plan_session' ? failure : removalReads(true)(call)))
    await expect(removeSession('s1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', 'plan_session.update'])
  })

  test('a failing cleanup after an archive is thrown, the session stays archived', async () => {
    fakeSupabase.reset((call) => (isSlotDeletion(call) ? failure : removalReads(true)(call)))
    await expect(removeSession('s1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.map(summary)).toContain('plan_session.update')
  })

  test('a failing history check deletes no slot', async () => {
    fakeSupabase.reset(() => failure)
    await expect(removeSession('s1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select'])
  })

  test('restoring puts the session after the last one and unarchives it', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [{ position: 4 }] } : { data: [{ id: 's1' }] }))
    expect(await restoreSession('p1', 's1')).toBe(5)
    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan_session', filters: [['eq', 'plan_id', 'p1']] })
    expect(fakeSupabase.calls[1]).toMatchObject({ op: 'update', payload: { archived: false, position: 5 } })
  })
})

describe('delete refuses when history references the rows', () => {
  test('deletePlan checks the workouts of all its sessions', async () => {
    fakeSupabase.reset((call) => {
      if (call.table === 'plan_session') return { data: [{ id: 's1' }, { id: 's2' }] }
      return { data: [{ id: 'w1' }] }
    })
    await expect(deletePlan('p1')).rejects.toMatchObject({ code: 'in_use' })
    expect(fakeSupabase.calls[1]).toMatchObject({ table: 'workout', filters: [['in', 'session_id', ['s1', 's2']]] })
    expect(fakeSupabase.calls.map((c) => c.op)).not.toContain('delete')
  })

  test('deletePlan removes the future planned slots of its sessions, then deletes the plan', async () => {
    fakeSupabase.reset((call) => (call.table === 'plan_session' ? { data: [{ id: 's1' }] } : call.op === 'select' && call.table === 'workout' && call.columns === 'id' ? { data: [] } : cleanupReads(call)))
    await deletePlan('p1')
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_session.select', 'workout.select', ...CLEANUP_CALLS, 'plan.delete'])
    expect(fakeSupabase.calls.find(isSlotRead)!.filters).toEqual(futurePlannedFilters(['s1']))
    expect(fakeSupabase.calls.at(-1)).toMatchObject({ table: 'plan', op: 'delete', filters: [['eq', 'id', 'p1']] })
    expect(historyCalls(fakeSupabase.calls)).toEqual([])
  })

  test('a failing slot cleanup stops deletePlan before the plan is deleted', async () => {
    fakeSupabase.reset((call) => (isSlotDeletion(call) ? failure : call.table === 'plan_session' ? { data: [{ id: 's1' }] } : call.columns === 'id' ? { data: [] } : cleanupReads(call)))
    await expect(deletePlan('p1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.some((c) => c.table === 'plan' && c.op === 'delete')).toBe(false)
  })

  test('deletePlan with no sessions deletes without querying workouts or slots', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : undefined))
    await deletePlan('p1')
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_session.select', 'plan.delete'])
  })
})

describe('listPlanSummaries', () => {
  test('counts the live sessions and exercises per plan, ignoring archived sessions, and drops the embeds', async () => {
    fakeSupabase.reset(() => ({
      data: [
        {
          id: 'p1',
          name: 'A',
          plan_session: [
            { id: 's1', archived: false, plan_exercise: [{ id: 'x1' }, { id: 'x2' }] },
            { id: 's2', archived: false, plan_exercise: [{ id: 'x3' }] },
            { id: 's3', archived: true, plan_exercise: [{ id: 'x4' }] },
          ],
        },
        { id: 'p2', name: 'B', plan_session: [] },
      ],
    }))

    const plans = await listPlanSummaries()

    expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan', orders: [{ column: 'name', ascending: true }] })
    expect(plans.map(({ id, sessionCount, exerciseCount }) => [id, sessionCount, exerciseCount])).toEqual([
      ['p1', 2, 3],
      ['p2', 0, 0],
    ])
    expect(plans[0]).not.toHaveProperty('plan_session')
  })

  test('a failed query is thrown', async () => {
    fakeSupabase.reset(() => failure)
    await expect(listPlanSummaries()).rejects.toBeInstanceOf(DataError)
  })
})

describe('duplicatePlan', () => {
  const source = {
    id: 'p1',
    name: 'Forza',
    is_active: true,
    archived: false,
    plan_session: [
      {
        id: 's2',
        position: 1,
        name: 'B',
        subtitle: 'Gambe',
        is_optional: true,
        archived: false,
        plan_exercise: [],
        warmup_item: [{ id: 'w1', position: 0, name: 'Cerchi', reps_text: '10', note: null }],
      },
      {
        id: 's1',
        position: 0,
        name: 'A',
        subtitle: null,
        is_optional: false,
        archived: false,
        plan_exercise: [
          {
            id: 'x1',
            position: 0,
            exercise_id: 'e1',
            target_sets: 3,
            target_reps: 8,
            target_unit: 'reps',
            suggested_weight_kg: 20,
            suggested_weight_max_kg: null,
            exercise: { id: 'e1' },
          },
        ],
        warmup_item: [],
      },
      { id: 's0', position: 2, name: 'Old', archived: true, plan_exercise: [], warmup_item: [] },
    ],
  }

  /** Source tree on the read, a new plan on the plan insert, `failOn` a failure on that table's insert. */
  const scenario = (failOn?: string, cleanup?: FakeResult) =>
    fakeSupabase.reset((call) => {
      if (call.op === 'select') return { data: source }
      if (call.table === 'plan' && call.op === 'insert') return { data: { id: 'copy', name: 'Forza (copia)', is_active: false } }
      if (call.op === 'delete') return cleanup
      if (call.table === failOn) return failure
      return undefined
    })

  test('copies live sessions, exercises and warm-ups under new ids and positions', async () => {
    scenario()
    const copy = await duplicatePlan('p1')

    expect(copy.id).toBe('copy')
    expect(fakeSupabase.calls.map(summary)).toEqual([
      'plan.select',
      'plan.insert',
      'plan_session.insert',
      'plan_exercise.insert',
      'warmup_item.insert',
    ])
    expect(fakeSupabase.calls[1].payload).toEqual({ name: 'Forza (copia)' })

    const sessions = fakeSupabase.calls[2].payload as { id: string; plan_id: string; name: string; position: number }[]
    expect(sessions.map(({ plan_id, name, position }) => [plan_id, name, position])).toEqual([
      ['copy', 'A', 0],
      ['copy', 'B', 1],
    ])
    expect(sessions.map((s) => s.id)).not.toContain('s1')
    expect(sessions[1]).toMatchObject({ subtitle: 'Gambe', is_optional: true })

    expect(fakeSupabase.calls[3].payload).toEqual([
      {
        session_id: sessions[0].id,
        exercise_id: 'e1',
        position: 0,
        target_sets: 3,
        target_reps: 8,
        target_unit: 'reps',
        suggested_weight_kg: 20,
        suggested_weight_max_kg: null,
      },
    ])
    expect(fakeSupabase.calls[4].payload).toEqual([
      { session_id: sessions[1].id, position: 0, name: 'Cerchi', reps_text: '10', note: null },
    ])
  })

  test('keeps the copy name within the name limit', async () => {
    fakeSupabase.reset((call) => {
      if (call.op === 'select') return { data: { ...source, name: 'x'.repeat(120), plan_session: [] } }
      return { data: { id: 'copy' } }
    })
    await duplicatePlan('p1')
    const { name } = fakeSupabase.calls[1].payload as { name: string }
    expect(name).toHaveLength(120)
    expect(name.endsWith(' (copia)')).toBe(true)
  })

  test('a plan without sessions is copied without further inserts', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: { ...source, plan_session: [] } } : { data: { id: 'copy' } }))
    await duplicatePlan('p1')
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan.select', 'plan.insert'])
  })

  test('a missing source is not_found and nothing is created', async () => {
    fakeSupabase.reset()
    await expect(duplicatePlan('ghost')).rejects.toMatchObject({ code: 'not_found' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan.select'])
  })

  test('a failure midway deletes the half-built copy and rethrows', async () => {
    scenario('plan_exercise')
    await expect(duplicatePlan('p1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.at(-1)).toMatchObject({ table: 'plan', op: 'delete', filters: [['eq', 'id', 'copy']] })
    expect(fakeSupabase.calls.map(summary)).not.toContain('warmup_item.insert')
  })

  test('says so when the half-built copy cannot be removed either', async () => {
    scenario('plan_session', failure)
    await expect(duplicatePlan('p1')).rejects.toMatchObject({ name: 'DataError', code: 'partial_copy' })
  })

  test('a failed plan insert leaves nothing to clean up', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: source } : failure))
    await expect(duplicatePlan('p1')).rejects.toMatchObject({ code: '23514' })
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan.select', 'plan.insert'])
  })
})

describe('createPlanWithSession', () => {
  /** `existing` plans on the first read, the new plan on the plan insert, `failOn` a failure on that table's insert. */
  const scenario = (existing: object[], failOn?: string, cleanup?: FakeResult) =>
    fakeSupabase.reset((call) => {
      if (call.table === 'plan' && call.op === 'select') return { data: existing }
      if (call.table === 'plan' && call.op === 'insert') return { data: { id: 'new', name: 'Forza', ...(call.payload as object) } }
      if (call.op === 'delete') return cleanup
      if (call.table === 'plan_session' && call.op === 'select') return { data: [] }
      if (call.table === failOn) return failure
      return { data: { id: 's1' } }
    })

  test('the very first plan starts active, with a first session called A', async () => {
    scenario([])
    const plan = await createPlanWithSession('Forza')

    expect(plan.is_active).toBe(true)
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan.select', 'plan.insert', 'plan_session.select', 'plan_session.insert'])
    expect(fakeSupabase.calls[1].payload).toEqual({ name: 'Forza', is_active: true })
    expect(fakeSupabase.calls[3].payload).toEqual({ name: 'A', plan_id: 'new', position: 0 })
  })

  test('a later plan is a draft that does not touch the active one', async () => {
    scenario([{ id: 'old' }])
    const plan = await createPlanWithSession('Forza')

    expect(plan.is_active).toBe(false)
    expect(fakeSupabase.calls[1].payload).toEqual({ name: 'Forza', is_active: false })
    expect(fakeSupabase.calls.some((call) => call.op === 'update')).toBe(false)
  })

  test('removes the empty plan when the first session cannot be added, so a retry does not duplicate it', async () => {
    scenario([], 'plan_session')
    await expect(createPlanWithSession('Forza')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls.at(-1)).toMatchObject({ table: 'plan', op: 'delete', filters: [['eq', 'id', 'new']] })
  })

  test('says so when even the cleanup fails', async () => {
    scenario([], 'plan_session', failure)
    await expect(createPlanWithSession('Forza')).rejects.toMatchObject({ code: 'partial_create' })
  })
})

test('getActivePlanHead reads the active plan, or nothing', async () => {
  fakeSupabase.reset(() => ({ data: { id: 'p1', name: 'Forza' } }))
  expect(await getActivePlanHead()).toEqual({ id: 'p1', name: 'Forza' })
  expect(fakeSupabase.calls[0]).toMatchObject({ table: 'plan', filters: [['eq', 'is_active', true]], mode: 'maybeSingle' })

  fakeSupabase.reset(() => ({ data: null }))
  expect(await getActivePlanHead()).toBeNull()
})

test('deactivatePlan clears only that plan, and fails when it matches no row', async () => {
  fakeSupabase.reset(() => ({ data: [{ id: 'p1' }] }))
  await deactivatePlan('p1')
  expect(fakeSupabase.calls[0]).toMatchObject({ op: 'update', payload: { is_active: false }, filters: [['eq', 'id', 'p1']] })

  fakeSupabase.reset(() => ({ data: [] }))
  await expect(deactivatePlan('ghost')).rejects.toMatchObject({ code: 'not_found' })
})

describe('duplicateSession', () => {
  const bench = { id: 'e1', name: 'Panca' }
  const source = {
    id: 's1',
    plan_id: 'p1',
    name: 'A',
    subtitle: 'Petto',
    is_optional: true,
    position: 0,
    archived: false,
    exercises: [
      { id: 'x2', session_id: 's1', exercise_id: 'e2', position: 1, target_sets: 4, target_reps: 30, target_unit: 'seconds', suggested_weight_kg: null, suggested_weight_max_kg: null, exercise: { id: 'e2', name: 'Plank' } },
      { id: 'x1', session_id: 's1', exercise_id: 'e1', position: 0, target_sets: 3, target_reps: 8, target_unit: 'reps', suggested_weight_kg: 20, suggested_weight_max_kg: 25, exercise: bench },
    ],
    warmup: [{ id: 'w1', session_id: 's1', position: 0, name: 'Cerchi', reps_text: '10', note: null }],
  } as unknown as SessionDetail

  /** The copy on the session insert, the inserted rows echoed back with ids; `failOn` fails that table's insert. */
  const scenario = (failOn?: string, cleanup?: FakeResult) =>
    fakeSupabase.reset((call) => {
      if (call.op === 'select') return { data: [{ position: 1 }] }
      if (call.op === 'delete') return cleanup
      if (call.table === failOn) return failure
      if (call.table === 'plan_session') return { data: { id: 's9', plan_id: 'p1', ...(call.payload as object) } }
      return { data: (call.payload as object[]).map((row, index) => ({ id: `n${index}`, ...row })) }
    })

  test('copies the session after the last one with its exercises and warm-ups, targets and order intact', async () => {
    scenario()
    const copy = await duplicateSession(source, 'B')

    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_session.select', 'plan_session.insert', 'plan_exercise.insert', 'warmup_item.insert'])
    expect(fakeSupabase.calls[1].payload).toEqual({ plan_id: 'p1', name: 'B', subtitle: 'Petto', is_optional: true, position: 2 })
    expect(fakeSupabase.calls[2].payload).toEqual([
      { session_id: 's9', exercise_id: 'e2', position: 1, target_sets: 4, target_reps: 30, target_unit: 'seconds', suggested_weight_kg: null, suggested_weight_max_kg: null },
      { session_id: 's9', exercise_id: 'e1', position: 0, target_sets: 3, target_reps: 8, target_unit: 'reps', suggested_weight_kg: 20, suggested_weight_max_kg: 25 },
    ])
    expect(fakeSupabase.calls[3].payload).toEqual([{ session_id: 's9', position: 0, name: 'Cerchi', reps_text: '10', note: null }])

    expect(copy).toMatchObject({ id: 's9', name: 'B', position: 2 })
    expect(copy.exercises.map((row) => [row.exercise_id, row.exercise.name, row.position])).toEqual([
      ['e1', 'Panca', 0],
      ['e2', 'Plank', 1],
    ])
    expect(copy.warmup.map((item) => item.name)).toEqual(['Cerchi'])
  })

  test('an empty session is copied without touching the exercise or warm-up tables', async () => {
    scenario()
    const copy = await duplicateSession({ ...source, exercises: [], warmup: [] }, 'B')
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_session.select', 'plan_session.insert'])
    expect(copy.exercises).toEqual([])
  })

  test('deletes the half-built session when a table fails', async () => {
    scenario('warmup_item')
    await expect(duplicateSession(source, 'B')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls.at(-1)).toMatchObject({ table: 'plan_session', op: 'delete', filters: [['eq', 'id', 's9']] })
  })

  test('says so when even the cleanup fails', async () => {
    scenario('plan_exercise', failure)
    await expect(duplicateSession(source, 'B')).rejects.toMatchObject({ code: 'partial_session' })
  })
})

describe('restorePlanExercise', () => {
  const detail = (id: string, position: number): PlanExerciseDetail =>
    ({
      id,
      session_id: 's1',
      exercise_id: `e-${id}`,
      position,
      target_sets: 4,
      target_reps: 10,
      target_unit: 'reps',
      suggested_weight_kg: 12.5,
      suggested_weight_max_kg: null,
      exercise: { id: `e-${id}`, name: `Esercizio ${id}` },
    }) as PlanExerciseDetail

  /** The session has positions up to 1; the insert answers with the new row. */
  const scenario = () =>
    fakeSupabase.reset((call) => {
      if (call.op === 'select') return { data: [{ position: 1 }] }
      if (call.op === 'insert') return { data: { id: 'new', ...(call.payload as object) } }
      return undefined
    })

  test('puts the exercise back in its old place with the same target', async () => {
    scenario()
    const ordered = await restorePlanExercise(detail('b', 1), 1, [detail('a', 0), detail('c', 2)])

    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_exercise.select', 'plan_exercise.insert', 'plan_exercise.upsert'])
    expect(fakeSupabase.calls[1].payload).toEqual({
      exercise_id: 'e-b',
      target_sets: 4,
      target_reps: 10,
      target_unit: 'reps',
      suggested_weight_kg: 12.5,
      suggested_weight_max_kg: null,
      session_id: 's1',
      position: 2,
    })
    expect(ordered.map((row) => row.exercise.name)).toEqual(['Esercizio a', 'Esercizio b', 'Esercizio c'])
    const upserted = fakeSupabase.calls[2].payload as { id: string; position: number }[]
    expect(upserted.map((row) => [row.id, row.position])).toEqual([['a', 0], ['new', 1], ['c', 2]])
  })

  test('an exercise that was the last needs no reorder', async () => {
    scenario()
    const ordered = await restorePlanExercise(detail('c', 2), 2, [detail('a', 0), detail('b', 1)])
    expect(fakeSupabase.calls.map(summary)).toEqual(['plan_exercise.select', 'plan_exercise.insert'])
    expect(ordered.map((row) => row.id)).toEqual(['a', 'b', 'new'])
  })
})
