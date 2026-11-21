import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CalendarData } from './calendar/useCalendarData'
import { Calendar } from './Calendar'

const mocks = vi.hoisted(() => ({ data: null as unknown }))
vi.mock('./calendar/useCalendarData', () => ({ useCalendarData: () => mocks.data }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 21, 10, 0))
})
afterEach(() => vi.useRealTimers())

function render(data: Partial<Extract<CalendarData, { status: 'loading' | 'ready' }>>) {
  mocks.data = { status: 'ready', loaded: true, groups: new Map(), sessions: [], hasPlan: true, reload: () => undefined, ...data }
  return renderToStaticMarkup(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>,
  )
}

test('before the range has loaded once it shows the skeleton and no day panel', () => {
  const html = render({ status: 'loading', loaded: false })
  expect(html).toContain('Carico il calendario')
  expect(html).not.toContain('cal-day-heading')
})

test('a reload of a loaded range with no slots left keeps the day panel, marked busy, and no skeleton', () => {
  const html = render({ status: 'loading', loaded: true })
  expect(html).not.toContain('Carico il calendario')
  expect(html).toMatch(/<section[^>]*aria-labelledby="cal-day-heading"[^>]*aria-busy="true"/)
})

test('once loaded the panel is not busy', () => {
  const html = render({})
  expect(html).toContain('cal-day-heading')
  expect(html).not.toContain('aria-busy')
})
