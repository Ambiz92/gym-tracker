import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { groupByDay, resolveSlots } from '../../lib/scheduleStatus'
import type { ScheduledSession } from '../../types/db'
import { DayPanel } from './DayPanel'

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

function render(date: string, slots: ScheduledSession[], props: { startable?: string[]; canPlan?: boolean; periodHasSlots?: boolean; refreshing?: boolean } = {}) {
  const views = resolveSlots(slots, { today: TODAY, workouts: [], startableSessionIds: new Set(props.startable ?? ['s1']) })
  return renderToStaticMarkup(
    <MemoryRouter>
      <DayPanel
        date={date}
        today={TODAY}
        refreshing={props.refreshing ?? false}
        group={groupByDay(views).get(date)}
        periodHasSlots={props.periodHasSlots ?? slots.length > 0}
        canPlan={props.canPlan ?? true}
        onChanged={() => undefined}
        onPlan={() => undefined}
      />
    </MemoryRouter>,
  )
}

test('names the day and lists its slots with their state', () => {
  const html = render('2026-11-27', [slot('a', '2026-11-27')])
  expect(html).toContain('venerdì 27 novembre')
  expect(html).toContain('Upper body')
  expect(html).toContain('>in programma<')
})

test('an upcoming slot can be moved to today, skipped and deleted', () => {
  const html = render('2026-11-27', [slot('a', '2026-11-27')])
  expect(html).toContain('aria-label="Sposta a oggi: Upper body"')
  expect(html).toContain('aria-label="Salta: Upper body"')
  expect(html).toContain('aria-label="Elimina: Upper body"')
})

test('an overdue slot is marked "da recuperare" and offers no delete', () => {
  const html = render('2026-11-18', [slot('a', '2026-11-18')])
  expect(html).toContain('cal-tag cal-tag--alert">da recuperare<')
  expect(html).toContain('Sposta a oggi')
  expect(html).toContain('Salta')
  expect(html).not.toContain('Elimina')
})

test('done and skipped slots are history: a label and no action at all', () => {
  const html = render('2026-11-18', [slot('a', '2026-11-18', { status: 'done' }), slot('b', '2026-11-18', { status: 'skipped', session_name: 'Lower body' })])
  expect(html).toContain('>fatta<')
  expect(html).toContain('>saltata<')
  expect(html).not.toContain('<button')
})

test('a slot of an archived session is greyed out with its label and keeps its actions', () => {
  const html = render('2026-11-27', [slot('a', '2026-11-27', { plan_session_id: null })], { startable: [] })
  expect(html).toContain('cal-slot cal-slot--archived')
  expect(html).toContain('>archiviata<')
  expect(html).toContain('Elimina')
})

test('a slot dated today cannot be moved to today', () => {
  const html = render(TODAY, [slot('a', TODAY)])
  expect(html).not.toContain('Sposta a oggi')
  expect(html).toContain('Salta')
})

test('planning is offered from today on, not on a past day', () => {
  expect(render('2026-11-27', [])).toContain('>Pianifica<')
  expect(render(TODAY, [])).toContain('>Pianifica<')
  expect(render('2026-11-20', [])).not.toContain('Pianifica')
})

test('without an active plan it points to the plans instead of offering the picker', () => {
  const html = render('2026-11-27', [], { canPlan: false })
  expect(html).not.toContain('>Pianifica<')
  expect(html).toContain('href="/plans"')
})

test('the empty period shows the empty-state sentence, a busy period the day-level one', () => {
  expect(render('2026-11-27', [])).toContain('Nessuna sessione in programma. Tocca un giorno per aggiungerne una.')
  const html = render('2026-11-27', [], { periodHasSlots: true })
  expect(html).toContain('Nessuna sessione in questo giorno.')
  expect(html).not.toContain('Tocca un giorno')
})

test('nothing is being confirmed or reported on first render', () => {
  const html = render('2026-11-27', [slot('a', '2026-11-27')])
  expect(html).not.toContain('Conferma eliminazione')
  expect(html).not.toContain('role="alert"')
})

test('while the range reloads the panel stays, marked busy; otherwise it is not', () => {
  expect(render('2026-11-27', [slot('a', '2026-11-27')], { refreshing: true })).toMatch(/<section[^>]*aria-busy="true"/)
  expect(render('2026-11-27', [slot('a', '2026-11-27')])).not.toContain('aria-busy')
})
