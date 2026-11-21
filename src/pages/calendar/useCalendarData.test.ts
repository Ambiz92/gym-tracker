import { beforeEach, expect, test, vi } from 'vitest'
import type { ScheduledSession } from '../../types/db'
import { groupSlots, loadRange } from './useCalendarData'

const mocks = vi.hoisted(() => ({
  listSlots: vi.fn(),
  listWorkoutDays: vi.fn(),
  healReconciledSlots: vi.fn(),
}))
vi.mock('../../data/schedule', () => ({ listSlots: mocks.listSlots, healReconciledSlots: mocks.healReconciledSlots }))
vi.mock('../../data/history', () => ({ listWorkoutDays: mocks.listWorkoutDays }))
vi.mock('../../data/activePlan', () => ({ getActivePlan: vi.fn() }))

beforeEach(() => vi.resetAllMocks())

function slot(id: string, date: string, over: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    id,
    owner_id: 'o',
    plan_session_id: 's1',
    session_name: 'Upper body',
    date,
    status: 'planned',
    workout_id: null,
    series_id: null,
    created_at: '2026-11-01T08:00:00Z',
    ...over,
  }
}

const sessions = [{ id: 's1', name: 'Upper body' }]

test('groups the slots by day with a dot each', () => {
  const groups = groupSlots(
    { slots: [slot('a', '2026-11-27'), slot('b', '2026-11-28', { status: 'skipped' })], workouts: [] },
    sessions,
    '2026-11-21',
  )
  expect(groups.get('2026-11-27')?.dot).toBe('empty')
  expect(groups.get('2026-11-28')?.dot).toBe('struck')
  expect(groups.size).toBe(2)
})

test('a planned past slot with a workout of that session and day counts as done', () => {
  const groups = groupSlots(
    { slots: [slot('a', '2026-11-18')], workouts: [{ id: 'w1', session_id: 's1', date: '2026-11-18' }] },
    sessions,
    '2026-11-21',
  )
  expect(groups.get('2026-11-18')?.views[0]?.state).toBe('done')
})

test('only the sessions given are startable, so the others read as archived', () => {
  const groups = groupSlots({ slots: [slot('a', '2026-11-27', { plan_session_id: 'gone' })], workouts: [] }, sessions, '2026-11-21')
  expect(groups.get('2026-11-27')?.views[0]?.startable).toBe(false)
})

test('loading a range persists the done states it derives from the workouts it just read', async () => {
  const slots = [slot('a', '2026-11-18')]
  const workouts = [{ id: 'w1', session_id: 's1', date: '2026-11-18' }]
  mocks.listSlots.mockResolvedValue(slots)
  mocks.listWorkoutDays.mockResolvedValue(workouts)
  mocks.healReconciledSlots.mockResolvedValue(undefined)

  await expect(loadRange('2026-11-01', '2026-11-30')).resolves.toEqual({ from: '2026-11-01', to: '2026-11-30', slots, workouts })
  expect(mocks.healReconciledSlots).toHaveBeenCalledWith(slots, workouts)
})
