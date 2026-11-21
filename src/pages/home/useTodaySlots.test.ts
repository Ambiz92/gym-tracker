import { beforeEach, expect, test, vi } from 'vitest'
import { loadSchedule } from './useTodaySlots'

const mocks = vi.hoisted(() => ({
  listSlots: vi.fn(),
  listWorkoutDays: vi.fn(),
  healReconciledSlots: vi.fn(),
}))
vi.mock('../../data/schedule', () => ({ listSlots: mocks.listSlots, healReconciledSlots: mocks.healReconciledSlots }))
vi.mock('../../data/history', () => ({ listWorkoutDays: mocks.listWorkoutDays }))

beforeEach(() => vi.resetAllMocks())

test('reads the lookback window up to today and persists the done states reconciliation derives', async () => {
  const slots = [{ id: 'a' }]
  const workouts = [{ id: 'w1', session_id: 's1', date: '2026-11-18' }]
  mocks.listSlots.mockResolvedValue(slots)
  mocks.listWorkoutDays.mockResolvedValue(workouts)
  mocks.healReconciledSlots.mockResolvedValue(undefined)

  await expect(loadSchedule('2026-11-21')).resolves.toEqual({ slots, workouts })
  expect(mocks.listSlots).toHaveBeenCalledWith('2026-09-22', '2026-11-21')
  expect(mocks.healReconciledSlots).toHaveBeenCalledWith(slots, workouts)
})
