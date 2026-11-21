import { describe, expect, it } from 'vitest'
import { groupByDay, resolveSlots, type ScheduleContext, type SlotRow } from './scheduleStatus'

const TODAY = '2026-11-21'

function slot(overrides: Partial<SlotRow> = {}): SlotRow {
  return { id: 's1', date: '2026-11-25', status: 'planned', plan_session_id: 'A', ...overrides }
}

function context(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
  return { today: TODAY, workouts: [], startableSessionIds: new Set(['A', 'B']), ...overrides }
}

const stateOf = (row: SlotRow, ctx: ScheduleContext = context()) => resolveSlots([row], ctx)[0]!.state

describe('resolveSlots state', () => {
  it('is upcoming for a planned slot in the future and today', () => {
    expect(stateOf(slot({ date: '2026-11-22' }))).toBe('upcoming')
    expect(stateOf(slot({ date: TODAY }))).toBe('upcoming')
  })

  it('is to recover for a past planned slot without workout', () => {
    expect(stateOf(slot({ date: '2026-11-20' }))).toBe('to_recover')
    expect(stateOf(slot({ date: '2025-12-31' }))).toBe('to_recover')
  })

  it('compares dates across month and year ends', () => {
    expect(stateOf(slot({ date: '2026-12-01' }), context({ today: '2026-11-30' }))).toBe('upcoming')
    expect(stateOf(slot({ date: '2026-12-31' }), context({ today: '2027-01-01' }))).toBe('to_recover')
  })

  it('keeps the stored done and skipped states, whatever the date', () => {
    expect(stateOf(slot({ status: 'done', date: '2026-11-01' }))).toBe('done')
    expect(stateOf(slot({ status: 'done', date: '2026-12-01' }))).toBe('done')
    expect(stateOf(slot({ status: 'skipped', date: '2026-11-01' }))).toBe('skipped')
    expect(stateOf(slot({ status: 'skipped', date: '2026-12-01' }))).toBe('skipped')
  })
})

describe('resolveSlots reconciliation', () => {
  const workouts = [{ session_id: 'A', date: '2026-11-18' }]

  it('counts a planned slot as done when its session has a workout on that date', () => {
    expect(stateOf(slot({ date: '2026-11-18' }), context({ workouts }))).toBe('done')
  })

  it('also reconciles a slot on a future date or today', () => {
    expect(stateOf(slot({ date: TODAY }), context({ workouts: [{ session_id: 'A', date: TODAY }] }))).toBe('done')
  })

  it('does not match another session or another date', () => {
    expect(stateOf(slot({ date: '2026-11-18', plan_session_id: 'B' }), context({ workouts }))).toBe('to_recover')
    expect(stateOf(slot({ date: '2026-11-19' }), context({ workouts }))).toBe('to_recover')
  })

  it('never matches a workout without a session, nor a slot whose session was deleted', () => {
    const orphanWorkout = [{ session_id: null, date: '2026-11-18' }]
    expect(stateOf(slot({ date: '2026-11-18', plan_session_id: null }), context({ workouts: orphanWorkout }))).toBe('to_recover')
    expect(stateOf(slot({ date: '2026-11-18', plan_session_id: null }), context({ workouts }))).toBe('to_recover')
  })

  it('leaves an explicitly skipped slot skipped', () => {
    expect(stateOf(slot({ date: '2026-11-18', status: 'skipped' }), context({ workouts }))).toBe('skipped')
  })
})

describe('resolveSlots startable', () => {
  it('allows starting an upcoming or to-recover slot of a startable session', () => {
    const [upcoming, toRecover] = resolveSlots([slot({ date: TODAY }), slot({ id: 's2', date: '2026-11-10' })], context())
    expect(upcoming!.startable).toBe(true)
    expect(toRecover!.startable).toBe(true)
  })

  it('blocks starting an archived session, whatever the date', () => {
    const views = resolveSlots([slot({ plan_session_id: 'ARCHIVED' }), slot({ id: 's2', plan_session_id: 'ARCHIVED', date: '2026-11-10' })], context())
    expect(views.map((view) => view.startable)).toEqual([false, false])
    expect(views.map((view) => view.state)).toEqual(['upcoming', 'to_recover'])
  })

  it('blocks starting a slot whose session was deleted', () => {
    expect(resolveSlots([slot({ plan_session_id: null })], context())[0]!.startable).toBe(false)
  })

  it('blocks starting done and skipped slots', () => {
    const views = resolveSlots([slot({ status: 'done' }), slot({ id: 's2', status: 'skipped' })], context())
    expect(views.map((view) => view.startable)).toEqual([false, false])
  })

  it('keeps the input order and the slot objects', () => {
    const first = slot({ id: 'x', date: '2026-11-30' })
    const second = slot({ id: 'y', date: '2026-11-01' })
    const views = resolveSlots([first, second], context())
    expect(views.map((view) => view.slot)).toEqual([first, second])
  })
})

describe('groupByDay', () => {
  const group = (rows: SlotRow[], ctx: ScheduleContext = context()) => groupByDay(resolveSlots(rows, ctx))

  it('groups slots by date and omits empty days', () => {
    const days = group([
      slot({ id: '1', date: '2026-11-25' }),
      slot({ id: '2', date: '2026-11-25', plan_session_id: 'B' }),
      slot({ id: '3', date: '2026-11-27' }),
    ])
    expect([...days.keys()]).toEqual(['2026-11-25', '2026-11-27'])
    expect(days.get('2026-11-25')!.views.map((view) => view.slot.id)).toEqual(['1', '2'])
    expect(days.get('2026-11-26')).toBeUndefined()
  })

  it('gives an empty dot to upcoming and to-recover days', () => {
    const days = group([slot({ id: '1', date: '2026-11-25' }), slot({ id: '2', date: '2026-11-10' })])
    expect(days.get('2026-11-25')!.dot).toBe('empty')
    expect(days.get('2026-11-10')!.dot).toBe('empty')
  })

  it('gives a full dot to a done day, including one reconciled from a workout', () => {
    const days = group(
      [slot({ id: '1', status: 'done', date: '2026-11-12' }), slot({ id: '2', date: '2026-11-18' })],
      context({ workouts: [{ session_id: 'A', date: '2026-11-18' }] }),
    )
    expect(days.get('2026-11-12')!.dot).toBe('full')
    expect(days.get('2026-11-18')!.dot).toBe('full')
  })

  it('gives a struck dot to a day where everything was skipped', () => {
    const days = group([
      slot({ id: '1', status: 'skipped', date: '2026-11-12' }),
      slot({ id: '2', status: 'skipped', date: '2026-11-12', plan_session_id: 'B' }),
    ])
    expect(days.get('2026-11-12')!.dot).toBe('struck')
  })

  it('lets something still to do win, then done over skipped', () => {
    const days = group([
      slot({ id: '1', status: 'done', date: '2026-11-25' }),
      slot({ id: '2', date: '2026-11-25', plan_session_id: 'B' }),
      slot({ id: '3', status: 'done', date: '2026-11-12' }),
      slot({ id: '4', status: 'skipped', date: '2026-11-12', plan_session_id: 'B' }),
    ])
    expect(days.get('2026-11-25')!.dot).toBe('empty')
    expect(days.get('2026-11-12')!.dot).toBe('full')
  })

  it('returns an empty map without slots', () => {
    expect(group([]).size).toBe(0)
  })
})
