import { beforeEach, expect, test, vi } from 'vitest'
import { scheduleRepeating, scheduleSession } from '../../data/schedule'
import { dateProblem, saveSchedule } from './saveSchedule'

vi.mock('../../data/schedule', () => ({ scheduleSession: vi.fn(), scheduleRepeating: vi.fn() }))

const session = { id: 's1', name: 'Upper body' }

beforeEach(() => vi.clearAllMocks())

test('one week plans a single slot', async () => {
  await saveSchedule(session, '2026-11-27', 1)
  expect(scheduleSession).toHaveBeenCalledWith('s1', 'Upper body', '2026-11-27')
  expect(scheduleRepeating).not.toHaveBeenCalled()
})

test('more weeks plan a weekly series starting on the chosen day', async () => {
  await saveSchedule(session, '2026-11-27', 4)
  expect(scheduleRepeating).toHaveBeenCalledWith('s1', 'Upper body', '2026-11-27', 4)
  expect(scheduleSession).not.toHaveBeenCalled()
})

test('a data-layer failure reaches the caller', async () => {
  vi.mocked(scheduleSession).mockRejectedValueOnce(new Error('boom'))
  await expect(saveSchedule(session, '2026-11-27', 1)).rejects.toThrow('boom')
})

test('dateProblem accepts today and later, and refuses a past or missing day', () => {
  expect(dateProblem('2026-11-21', '2026-11-21')).toBeNull()
  expect(dateProblem('2027-01-05', '2026-11-21')).toBeNull()
  expect(dateProblem('2026-11-20', '2026-11-21')).toBe('Scegli un giorno da oggi in poi.')
  expect(dateProblem('', '2026-11-21')).toBe('Scegli un giorno.')
  expect(dateProblem('275760-09-13', '2026-11-21')).toBe('Scegli un giorno.')
})
