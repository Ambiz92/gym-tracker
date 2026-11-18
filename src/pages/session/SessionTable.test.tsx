import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { SessionTable } from './SessionTable'
import type { SessionDetail } from '../../data/activePlan'

function session(id: string, name: string, exercises: number, isOptional = false): SessionDetail {
  return {
    id,
    owner_id: 'o',
    plan_id: 'p',
    name,
    subtitle: null,
    position: 0,
    is_optional: isOptional,
    archived: false,
    exercises: Array.from({ length: exercises }, () => ({}) as SessionDetail['exercises'][number]),
    warmup: [],
  }
}

function render(nextId: string | null) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SessionTable
        sessions={[session('s1', 'Upper body', 7), session('s2', 'Lower body e core', 7), session('s3', 'Full body', 5, true)]}
        lastDates={new Map([['s1', '2026-11-13'], ['s2', '2026-11-10']])}
        nextId={nextId}
      />
    </MemoryRouter>,
  )
}

test('lists each session with the last date, the exercise count and a link to it', () => {
  const html = render('s2')
  expect(html).toContain('href="/session/s1"')
  expect(html).toContain('<td>13.11</td>')
  expect(html).toContain('<td>7</td>')
  expect(html).toContain('<td>mai fatta</td>')
})

test('marks the next session and the bonus one', () => {
  const html = render('s2')
  expect(html.match(/session-table__row--next/g)).toHaveLength(1)
  expect(html).toMatch(/Lower body e core<\/a><span class="session-table__tag">prossima/)
  expect(html).toContain('session-table__bonus">bonus')
})

test('marks no row when there is no next session', () => {
  expect(render(null)).not.toContain('session-table__row--next')
})
