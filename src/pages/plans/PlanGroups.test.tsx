import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { PlanSummary } from '../../data/plans'
import { NameForm } from './NameForm'
import { PlanGroups } from './PlanGroups'

function plan(id: string, overrides: Partial<PlanSummary> = {}): PlanSummary {
  return { id, owner_id: 'u1', name: `Scheda ${id}`, is_active: false, archived: false, sessionCount: 3, exerciseCount: 19, ...overrides }
}

const render = (plans: PlanSummary[], { busy = false, error = null as string | null } = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PlanGroups plans={plans} busy={busy} error={error} onActivate={() => {}} />
    </MemoryRouter>,
  )

const radio = (html: string, name: string) => html.match(new RegExp(`<input[^>]*aria-label="Attiva ${name}"[^>]*>`))?.[0] ?? ''

test('first use: no plans invites to create one', () => {
  expect(render([])).toContain('Nessuna scheda. Creane una per iniziare.')
})

test('lists the active plan first, then the others, then the archived ones, each linking to its editor', () => {
  const html = render([plan('a'), plan('b', { is_active: true }), plan('c', { archived: true })])
  expect(html.indexOf('Scheda attiva')).toBeLessThan(html.indexOf('Altre schede'))
  expect(html.indexOf('Altre schede')).toBeLessThan(html.indexOf('Archiviate'))
  expect(html).toContain('href="/plans/a"')
  expect(html).toContain('Archiviata')
  expect(html).toContain('3 sessioni · 19 esercizi')
})

test('every live plan has a radio, checked on the active one; archived plans have none', () => {
  const html = render([plan('a'), plan('b', { is_active: true }), plan('c', { archived: true })])
  expect(radio(html, 'Scheda a')).toContain('type="radio"')
  expect(radio(html, 'Scheda a')).not.toContain('checked')
  expect(radio(html, 'Scheda b')).toContain('checked')
  expect(radio(html, 'Scheda c')).toBe('')
  expect(html.match(/type="radio"/g)).toHaveLength(2)
  expect(html).not.toContain('>Attiva<')
})

test('the radios are blocked while an activation is in flight', () => {
  const html = render([plan('a'), plan('b', { is_active: true })], { busy: true })
  expect(radio(html, 'Scheda a')).toContain('disabled')
  expect(radio(html, 'Scheda b')).toContain('disabled')
})

test('a failed activation is announced as an alert', () => {
  expect(render([plan('a')], { error: 'Attivazione non riuscita.' })).toMatch(/role="alert"[^>]*>Attivazione non riuscita\./)
})

test('says so when no plan is active, so the state after a failed switch is visible', () => {
  const html = render([plan('a'), plan('b')])
  expect(html).toContain('role="status"')
  expect(html).toContain('Nessuna scheda attiva')
})

test('hides the groups that are empty', () => {
  const html = render([plan('a', { is_active: true })])
  expect(html).not.toContain('Altre schede')
  expect(html).not.toContain('Archiviate')
})

test('the name form shows a failure as an alert and blocks the button while busy', () => {
  const html = renderToStaticMarkup(
    <NameForm noun="scheda" submitLabel="Crea scheda" busy error="Creazione non riuscita." onSubmit={() => {}} onCancel={() => {}} />,
  )
  expect(html).toContain('role="alert"')
  expect(html).toContain('Creazione non riuscita.')
  expect(html).toMatch(/<button(?=[^>]*aria-busy="true")(?=[^>]*disabled)/)
})
