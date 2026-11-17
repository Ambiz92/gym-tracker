import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'
import type { Call } from './fakeSupabase'
import {
  addPlanExercise,
  addSession,
  archivePlan,
  deletePlan,
  removeSession,
  reorderPlanExercises,
  reorderSessions,
  setActivePlan,
} from './plans'
import type { PlanExercise, PlanSession } from '../types/db'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

const failure = { error: { message: 'violates check', code: '23514' } }
const summary = (c: Call) => `${c.table}.${c.op}`

beforeEach(() => fakeSupabase.reset())

describe('setActivePlan', () => {
  test('deactivates the old plan first, then activates the new one', async () => {
    fakeSupabase.reset((call) => (call.columns === 'id' ? { data: [{ id: 'old' }] } : undefined))
    await setActivePlan('new')

    expect(fakeSupabase.calls).toHaveLength(2)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'plan',
      op: 'update',
      payload: { is_active: false },
      filters: [
        ['eq', 'is_active', true],
        ['neq', 'id', 'new'],
      ],
    })
    expect(fakeSupabase.calls[1]).toMatchObject({
      table: 'plan',
      op: 'update',
      payload: { is_active: true },
      filters: [['eq', 'id', 'new']],
    })
  })

  test('puts the old plan back when the activation fails, and still throws', async () => {
    fakeSupabase.reset((call) => {
      if (call.columns === 'id') return { data: [{ id: 'old' }] }
      return (call.payload as { is_active: boolean }).is_active && call.filters[0][0] === 'eq' ? failure : undefined
    })
    await expect(setActivePlan('archived')).rejects.toMatchObject({ code: '23514' })

    expect(fakeSupabase.calls).toHaveLength(3)
    expect(fakeSupabase.calls[2]).toMatchObject({
      payload: { is_active: true },
      filters: [['in', 'id', ['old']]],
    })
  })

  test('reports that no plan is active when the restore fails too', async () => {
    fakeSupabase.reset((call) => (call.columns === 'id' ? { data: [{ id: 'old' }] } : failure))
    const error = await setActivePlan('archived').catch((e) => e)
    expect(error).toBeInstanceOf(DataError)
    expect(error.message).toContain('no plan is active')
  })

  test('does not touch anything else when the first request fails', async () => {
    fakeSupabase.reset(() => failure)
    await expect(setActivePlan('new')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls).toHaveLength(1)
  })

  test('with no previously active plan there is nothing to restore', async () => {
    fakeSupabase.reset((call) => (call.columns === 'id' ? { data: [] } : failure))
    await expect(setActivePlan('new')).rejects.toBeInstanceOf(DataError)
    expect(fakeSupabase.calls).toHaveLength(2)
  })
})

test('archivePlan clears is_active in the same update (check constraint)', async () => {
  await archivePlan('p1')
  expect(fakeSupabase.calls[0]).toMatchObject({ op: 'update', payload: { archived: true, is_active: false } })
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
  })

  test('reorderSessions sends one upsert on id with all not-null columns and fresh positions', async () => {
    await reorderSessions([session('s2', 'B'), session('s1', 'A')])

    expect(fakeSupabase.calls).toHaveLength(1)
    expect(fakeSupabase.calls[0]).toMatchObject({
      table: 'plan_session',
      op: 'upsert',
      options: { onConflict: 'id' },
      payload: [
        { id: 's2', plan_id: 'p1', name: 'B', subtitle: null, is_optional: false, position: 0 },
        { id: 's1', plan_id: 'p1', name: 'A', subtitle: null, is_optional: false, position: 1 },
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

describe('delete refuses when history references the rows', () => {
  test('removeSession with workouts', async () => {
    fakeSupabase.reset(() => ({ data: [{ id: 'w1' }] }))
    await expect(removeSession('s1')).rejects.toMatchObject({ code: 'in_use' })
    expect(fakeSupabase.calls.map((c) => c.op)).toEqual(['select'])
  })

  test('removeSession without workouts deletes', async () => {
    fakeSupabase.reset((call) => (call.op === 'select' ? { data: [] } : undefined))
    await removeSession('s1')
    expect(fakeSupabase.calls.map(summary)).toEqual(['workout.select', 'plan_session.delete'])
  })

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
