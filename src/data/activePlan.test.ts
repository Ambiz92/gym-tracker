import { beforeEach, expect, test, vi } from 'vitest'
import { getActivePlan } from './activePlan'
import { DataError } from './client'
import { fakeSupabase } from './fakeSupabase'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./fakeSupabase')).fakeSupabase }))

beforeEach(() => fakeSupabase.reset())

test('returns null when no plan is active', async () => {
  expect(await getActivePlan()).toBeNull()
  expect(fakeSupabase.calls[0]).toMatchObject({
    table: 'plan',
    filters: [['eq', 'is_active', true]],
    mode: 'maybeSingle',
  })
})

test('orders sessions, exercises and warm-ups by position and renames the embeds', async () => {
  const exercise = { id: 'e1', name: 'Squat' }
  fakeSupabase.reset(() => ({
    data: {
      id: 'p1',
      name: 'Plan',
      plan_session: [
        {
          id: 's2',
          position: 1,
          plan_exercise: [],
          warmup_item: [],
        },
        {
          id: 's1',
          position: 0,
          plan_exercise: [
            { id: 'x2', position: 1, exercise },
            { id: 'x1', position: 0, exercise },
          ],
          warmup_item: [
            { id: 'w2', position: 1 },
            { id: 'w1', position: 0 },
          ],
        },
      ],
    },
  }))

  const plan = await getActivePlan()

  expect(plan).not.toHaveProperty('plan_session')
  expect(plan?.sessions.map((s) => s.id)).toEqual(['s1', 's2'])
  expect(plan?.sessions[0].exercises.map((x) => x.id)).toEqual(['x1', 'x2'])
  expect(plan?.sessions[0].exercises[0].exercise).toBe(exercise)
  expect(plan?.sessions[0].warmup.map((w) => w.id)).toEqual(['w1', 'w2'])
  expect(plan?.sessions[0]).not.toHaveProperty('plan_exercise')
})

test('throws a DataError when the query fails', async () => {
  fakeSupabase.reset(() => ({ error: { message: 'boom', code: 'XX000' } }))
  await expect(getActivePlan()).rejects.toBeInstanceOf(DataError)
})
