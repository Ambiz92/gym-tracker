import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { HistoryLoaded } from './HistoryList'
import type { ExerciseSummary, SessionSummary } from './model'

let desktop = false
vi.mock('../../hooks/useIsDesktop', () => ({ useIsDesktop: () => desktop }))

const sessions: SessionSummary[] = [
  { id: 'w1', title: 'Upper body', detail: 'oggi · 2 esercizi · 6 serie', exercises: [{ exerciseId: 'e1', name: 'Panca', sets: ['3×8 · 30 kg'] }] },
]
const exercises: ExerciseSummary[] = [
  { id: 'e1', name: 'Panca piana', archived: false, lastWeightKg: 30, variationPct: 20, lastDate: '2026-11-17' },
]

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <HistoryLoaded sessions={sessions} exercises={exercises} />
    </MemoryRouter>,
  )

beforeEach(() => {
  desktop = false
})

test('on the phone both lists are stacked and there is no switch', () => {
  const html = render()
  expect(html).toContain('Ultime sessioni')
  expect(html).toContain('Panca piana')
  expect(html).not.toContain('history-switch')
})

test('on desktop the switch starts on the exercises and hides the sessions', () => {
  desktop = true
  const html = render()
  expect(html).toMatch(/aria-pressed="true"[^>]*>Per esercizio</)
  expect(html).toMatch(/aria-pressed="false"[^>]*>Per sessione</)
  expect(html).toContain('Panca piana')
  expect(html).not.toContain('Ultime sessioni')
})
