import { expect, test } from 'vitest'
import type { ScheduledSession } from '../../types/db'
import { groupSlots } from './useCalendarData'

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
    { slots: [slot('a', '2026-11-18')], workouts: [{ session_id: 's1', date: '2026-11-18' }] },
    sessions,
    '2026-11-21',
  )
  expect(groups.get('2026-11-18')?.views[0]?.state).toBe('done')
})

test('only the sessions given are startable, so the others read as archived', () => {
  const groups = groupSlots({ slots: [slot('a', '2026-11-27', { plan_session_id: 'gone' })], workouts: [] }, sessions, '2026-11-21')
  expect(groups.get('2026-11-27')?.views[0]?.startable).toBe(false)
})
