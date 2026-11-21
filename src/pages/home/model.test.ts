import { expect, test } from 'vitest'
import { resolveSlots } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'
import { lookbackStart, OVERDUE_LOOKBACK_DAYS, todayBlock } from './model'

const TODAY = '2026-11-21'

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

const block = (slots: ScheduledSession[], workouts: { session_id: string | null; date: string }[] = []) =>
  todayBlock(resolveSlots(slots, { today: TODAY, workouts, startableSessionIds: new Set(['s1']) }), TODAY)

const ids = (views: { slot: { id: string } }[]) => views.map((view) => view.slot.id)

test('splits what is still to do today from what is overdue, keeping the order', () => {
  const result = block([slot('old', '2026-11-10'), slot('now', TODAY), slot('recent', '2026-11-19')])
  expect(ids(result.today)).toEqual(['now'])
  expect(ids(result.overdue)).toEqual(['old', 'recent'])
})

test('done and skipped slots are history, also when a workout reconciles a planned one', () => {
  const result = block(
    [slot('a', TODAY, { status: 'done' }), slot('b', '2026-11-19', { status: 'skipped' }), slot('c', '2026-11-18'), slot('d', TODAY, { plan_session_id: 's9' })],
    [{ session_id: 's1', date: '2026-11-18' }],
  )
  expect(ids(result.today)).toEqual(['d'])
  expect(ids(result.overdue)).toEqual([])
})

test('nothing scheduled gives an empty block', () => {
  expect(block([])).toEqual({ today: [], overdue: [] })
})

test('the overdue lookback starts a fixed number of days back', () => {
  expect(OVERDUE_LOOKBACK_DAYS).toBe(60)
  expect(lookbackStart(TODAY)).toBe('2026-09-22')
})
