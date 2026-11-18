import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import type { Call, FakeResult } from './fakeSupabase'
import {
  addPlanExercise,
  addSession,
  archivePlan,
  deletePlan,
  listPlanSummaries,
  duplicatePlan,
  removeSession,
  renamePlan,
  restorePlan,
  restoreSession,
  reorderPlanExercises,
  reorderSessions,
  setActivePlan,
  updatePlanExercise,
  updateSession,
} from './plans'
import type { PlanExercise, PlanSession } from '../types/db'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'violates check', code: '23514' } }
const summary = (c: Call) => `${c.table}.${c.op}`

beforeEach(() => fakeSupabase.reset())

describe('setActivePlan', () => {
  const isLookup = (call: Call) => call.op === 'select'
  const isDeactivation = (call: Call) => call.op === 'update' && call.filters[0][0] === 'eq' && call.filters[0][1] === 'is_active'
  const isActivation = (call: Call) => call.op === 'update' && (call.payload as { is_active: boolean }).is_active && !isDeactivation(call)

  /** Fake where the target exists and the old plan is deactivated; `overrides` replace single steps. */
  const scenario = (overrides: { activation?: FakeResult; restore?: FakeResult; lookup?: FakeResult } = {}) =>
    fakeSupabase.reset((call) => {
      if (isLookup(call)) return overrides.lookup ?? { data: { archived: false } }
      if (isDeactivation(call)) return { data: [{ id: 'old' }] }
      if (isActivation(call)) return overrides.activation ?? { data: [{ id: 'new' }] }
      return overrides.restore
    })

  test('checks the target, deactivates the old plan, then activates the new one', async () => {
    scenario()
    await setActivePlan('new')

    expect(fakeSupabase.calls).toHaveLength(3)
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

describe('single-row updates fail when no row matches', () => {
  const updates: [string, () => Promise<void>, object][] = [
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
  test('with workouts it is archived, not deleted, so the history stays linked', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'w1' }] }))
    expect(await removeSession('s1')).toBe('archived')
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', 'plan_session.update'])
    expect(fakeSupabase.calls[1]).toMatchObject({ payload: { archived: true }, filters: [['eq', 'id', 's1']] })
  })

  test('without workouts it is deleted', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : undefined))
    expect(await removeSession('s1')).toBe('deleted')
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', 'plan_session.delete'])
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

  test('deletePlan deletes a plan without history', async () => {
    fakeSupabase.reset((call) => (call.table === 'plan_session' ? { data: [{ id: 's1' }] } : call.op === 'select' ? { data: [] } : undefined))
    await deletePlan('p1')
    expect(fakeSupabase.calls.at(-1)).toMatchObject({ table: 'plan', op: 'delete', filters: [['eq', 'id', 'p1']] })
  })

  test('deletePlan with no sessions deletes without querying workouts', async () => {
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
