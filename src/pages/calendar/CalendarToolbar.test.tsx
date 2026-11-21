import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CalendarToolbar } from './CalendarToolbar'

const render = (view: 'month' | 'week') =>
  renderToStaticMarkup(<CalendarToolbar view={view} selected="2026-11-21" onShift={() => undefined} onToday={() => undefined} onView={() => undefined} />)

test('the period name sits in a polite live region so a change is announced', () => {
  expect(render('month')).toMatch(/aria-live="polite"[^>]*>novembre 2026</)
  expect(render('week')).toMatch(/aria-live="polite"[^>]*>16 nov – 22 nov</)
})

test('the arrows are named after what they move', () => {
  expect(render('month')).toContain('aria-label="Mese precedente"')
  expect(render('month')).toContain('aria-label="Mese successivo"')
  expect(render('week')).toContain('aria-label="Settimana precedente"')
  expect(render('week')).toContain('aria-label="Settimana successiva"')
})

test('offers Oggi and a switch that shows the current view as pressed', () => {
  const html = render('week')
  expect(html).toContain('>Oggi<')
  expect(html).toContain('aria-label="Vai a oggi"')
  expect(html).toMatch(/aria-pressed="false"[^>]*>Mese</)
  expect(html).toMatch(/aria-pressed="true"[^>]*>Settimana</)
})
