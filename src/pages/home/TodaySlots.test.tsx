import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { ScheduledSession } from '../../types/db'
import { TodaySlots } from './TodaySlots'
import type { ScheduleData, TodaySlotsState } from './useTodaySlots'

const TODAY = '2026-11-21'
const reload = () => undefined

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

function render(schedule: TodaySlotsState, props: { startable?: string[]; canStart?: boolean } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <TodaySlots schedule={schedule} today={TODAY} startableSessionIds={new Set(props.startable ?? ['s1'])} canStart={props.canStart ?? true} />
    </MemoryRouter>,
  )
}

const ready = (slots: ScheduledSession[], workouts: ScheduleData['workouts'] = []): TodaySlotsState => ({ status: 'ready', data: { slots, workouts }, reload })

test("today's slot links to the session with only the slot id", () => {
  const html = render(ready([slot('a', TODAY)]))
  expect(html).toContain('In programma oggi')
  expect(html).toContain('href="/session/s1?slot=a"')
  expect(html).toContain('>Inizia<')
  expect(html).not.toContain('Da recuperare')
})

test('an overdue slot is listed apart with the start link, "Sposta a oggi" and "Salta"', () => {
  const html = render(ready([slot('a', '2026-11-18')]))
  expect(html).toContain('Da recuperare')
  expect(html).not.toContain('In programma oggi')
  expect(html).toContain('previsto il 18.11')
  expect(html).toContain('href="/session/s1?slot=a"')
  expect(html).toContain('aria-label="Sposta a oggi: Upper body"')
  expect(html).toContain('aria-label="Salta: Upper body"')
})

test('a slot dated today can be skipped but not moved to today', () => {
  const html = render(ready([slot('a', TODAY)]))
  expect(html).toContain('aria-label="Salta: Upper body"')
  expect(html).not.toContain('Sposta a oggi')
})

test('a slot of an archived session has no start link, keeps its actions and says so', () => {
  const html = render(ready([slot('a', '2026-11-18', { plan_session_id: null })]), { startable: [] })
  expect(html).not.toContain('href=')
  expect(html).not.toContain('Inizia')
  expect(html).toContain('>archiviata<')
  expect(html).toContain('Salta')
})

test('on desktop nothing starts a session, the actions stay', () => {
  const html = render(ready([slot('a', TODAY), slot('b', '2026-11-18')]), { canStart: false })
  expect(html).not.toContain('Inizia')
  expect(html).not.toContain('href=')
  expect(html).toContain('Upper body')
  expect(html).toContain('Sposta a oggi')
})

test('done and skipped slots, and a slot reconciled by a workout, are not shown', () => {
  const html = render(
    ready([slot('a', TODAY, { status: 'done' }), slot('b', '2026-11-19', { status: 'skipped' }), slot('c', '2026-11-18')], [{ id: 'w1', session_id: 's1', date: '2026-11-18' }]),
  )
  expect(html).toBe('')
})

test('with nothing scheduled it renders nothing at all', () => {
  expect(render(ready([]))).toBe('')
})

test('while loading it renders nothing', () => {
  expect(render({ status: 'loading', reload })).toBe('')
})

test('a failed read shows a small note, not an alert, and no error detail', () => {
  const html = render({ status: 'error', error: new Error('boom'), reload })
  expect(html).toContain('Non riesco a caricare le sessioni in programma.')
  expect(html).not.toContain('role="alert"')
  expect(html).not.toContain('boom')
})
