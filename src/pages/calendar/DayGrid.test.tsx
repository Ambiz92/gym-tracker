import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { gridWeeks } from './model'
import { DayGrid } from './DayGrid'
import { groupByDay, resolveSlots } from '../../lib/scheduleStatus'

const slot = (id: string, date: string, status: 'planned' | 'done' | 'skipped' = 'planned') => ({
  id,
  date,
  status,
  plan_session_id: 's1',
})

function render(view: 'month' | 'week', selected: string, slots = [slot('a', '2026-11-19', 'done'), slot('b', '2026-11-27')]) {
  const views = resolveSlots(slots, { today: '2026-11-21', workouts: [], startableSessionIds: new Set(['s1']) })
  return renderToStaticMarkup(
    <DayGrid view={view} weeks={gridWeeks(view, selected)} selected={selected} today="2026-11-21" groups={groupByDay(views)} onSelect={() => undefined} />,
  )
}

const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? []

test('November 2026 is six Monday-first rows of seven day buttons under weekday headers', () => {
  const html = render('month', '2026-11-21')
  expect(buttons(html)).toHaveLength(42)
  expect(html.match(/<th[^>]*>(\w+)</g)).toHaveLength(7)
  expect(html).toMatch(/<th scope="col">Lun<\/th>.*<th scope="col">Dom<\/th>/)
  expect(html).toContain('<caption class="visually-hidden">novembre 2026</caption>')
})

test('each cell is a button with the full spoken name of its day', () => {
  const html = render('month', '2026-11-21')
  expect(html).toContain('aria-label="giovedì 19 novembre, 1 sessione, fatta"')
  expect(html).toContain('aria-label="venerdì 27 novembre, 1 sessione, in programma"')
  expect(html).toContain('aria-label="sabato 21 novembre, nessuna sessione"')
})

test('the selected day is pressed and the only tab stop; today carries aria-current', () => {
  const html = render('month', '2026-11-27')
  const cells = buttons(html)
  expect(cells.filter((cell) => cell.includes('aria-pressed="true"'))).toHaveLength(1)
  expect(cells.filter((cell) => cell.includes('tabindex="0"'))).toHaveLength(1)
  expect(cells.find((cell) => cell.includes('tabindex="0"'))).toContain('venerdì 27 novembre')
  expect(cells.filter((cell) => cell.includes('aria-current="date"'))).toHaveLength(1)
  expect(cells.find((cell) => cell.includes('aria-current="date"'))).toContain('sabato 21 novembre')
})

test('the dot shape follows the day: full for done, ring for planned, none for an empty day', () => {
  const html = render('month', '2026-11-21')
  expect(html).toContain('cal-dot--full')
  expect(html).toContain('cal-dot--empty')
  expect(html).not.toContain('cal-dot--struck')
  expect(html.match(/cal-dot /g)).toHaveLength(2)
})

test('a skipped day gets the struck dot', () => {
  expect(render('month', '2026-11-21', [slot('c', '2026-11-18', 'skipped')])).toContain('cal-dot--struck')
})

test('days of the neighbouring months are muted padding in the month view only', () => {
  expect(render('month', '2026-11-21').match(/cal-cell--outside/g)).toHaveLength(12)
  expect(render('week', '2026-11-30')).not.toContain('cal-cell--outside')
})

test('the week view is a single row of seven days from Monday', () => {
  const html = render('week', '2026-11-21')
  expect(buttons(html)).toHaveLength(7)
  expect(html).toContain('lunedì 16 novembre')
  expect(html).toContain('domenica 22 novembre')
  expect(html).toContain('<caption class="visually-hidden">16 nov – 22 nov</caption>')
})
