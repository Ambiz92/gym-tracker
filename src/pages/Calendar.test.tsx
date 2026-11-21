import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Calendar } from './Calendar'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 21, 10, 0))
})

afterEach(() => vi.useRealTimers())

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>,
  )

test('opens on the month of today with today selected, while the data loads', () => {
  const html = render()
  expect(html).toContain('<h1')
  expect(html).toContain('Calendario')
  expect(html).toMatch(/aria-live="polite"[^>]*>novembre 2026</)
  expect(html).toMatch(/aria-label="sabato 21 novembre, nessuna sessione"[^>]*aria-pressed="true"/)
})

test('while loading it shows the skeleton and neither the day panel, the picker nor an error', () => {
  const html = render()
  expect(html).toContain('Carico il calendario')
  expect(html).not.toContain('Pianifica')
  expect(html).not.toContain('<dialog')
  expect(html).not.toContain('role="alert"')
})

test('explains the dots in a legend with text, not colour', () => {
  const html = render()
  expect(html).toContain('aria-label="Legenda"')
  for (const word of ['fatta', 'in programma', 'saltata']) expect(html).toContain(word)
})
