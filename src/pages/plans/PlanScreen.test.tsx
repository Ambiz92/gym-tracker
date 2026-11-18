import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { SessionDetail } from '../../data/activePlan'
import { PlanManage } from './PlanManage'
import { PlanScreen } from './PlanScreen'
import { SessionRows } from './SessionRows'

function session(id: string, overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id,
    owner_id: 'u1',
    plan_id: 'p1',
    name: `Sessione ${id}`,
    subtitle: null,
    position: 0,
    is_optional: false,
    archived: false,
    exercises: [],
    warmup: [],
    ...overrides,
  }
}

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

test('sessions link to their editor and show the exercise count and the bonus flag', () => {
  const html = inRouter(
    <SessionRows
      planId="p1"
      sessions={[session('a'), session('b', { is_optional: true, exercises: [{} as SessionDetail['exercises'][number]] })]}
      busy={false}
      onMove={() => {}}
    />,
  )
  expect(html).toContain('href="/plans/p1/sessions/a"')
  expect(html).toContain('0 esercizi')
  expect(html).toContain('1 esercizio · bonus')
})

test('the first session cannot go up and the last cannot go down', () => {
  const html = inRouter(<SessionRows planId="p1" sessions={[session('a'), session('b')]} busy={false} onMove={() => {}} />)
  expect(html).toMatch(/<button[^>]*aria-label="Sposta su Sessione a"[^>]*disabled/)
  expect(html).not.toMatch(/<button(?=[^>]*aria-label="Sposta giù Sessione a")(?=[^>]*disabled)/)
  expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta giù Sessione b")(?=[^>]*disabled)/)
})

test('every move button is blocked while a request is in flight', () => {
  const html = inRouter(<SessionRows planId="p1" sessions={[session('a'), session('b')]} busy onMove={() => {}} />)
  expect(html.match(/<button[^>]*disabled/g)).toHaveLength(4)
})

test('a plan without sessions says so', () => {
  expect(inRouter(<SessionRows planId="p1" sessions={[]} busy={false} onMove={() => {}} />)).toContain('non ha ancora sessioni')
})

test('manage offers archive or restore and a delete that needs a confirmation', () => {
  const props = { name: 'Forza', busy: false, error: null, onArchive: () => {}, onDelete: () => {} }
  const active = renderToStaticMarkup(<PlanManage {...props} archived={false} />)
  expect(active).toContain('Archivia')
  expect(active).toContain('Elimina scheda')
  expect(active).not.toContain('Elimina definitivamente')
  expect(renderToStaticMarkup(<PlanManage {...props} archived />)).toContain('Ripristina')
})

test('manage shows a refused delete as an alert', () => {
  const html = renderToStaticMarkup(
    <PlanManage name="Forza" archived={false} busy={false} error="La scheda ha allenamenti nello storico: archiviala invece di eliminarla." onArchive={() => {}} onDelete={() => {}} />,
  )
  expect(html).toMatch(/role="alert"[^>]*>La scheda ha allenamenti/)
})

test('a plan screen shows the status, the way to activate an inactive plan and the sessions', () => {
  const plan = { id: 'p1', owner_id: 'u1', name: 'Forza', is_active: false, archived: false, sessions: [session('a')] }
  const html = inRouter(<PlanScreen initial={plan} />)
  expect(html).toContain('Non attiva')
  expect(html).toContain('Imposta come attiva')
  expect(html).toContain('Sessione a')
  expect(html).toContain('1 sessione')
})

test('the active plan has no activate button and an archived one cannot be activated', () => {
  const base = { id: 'p1', owner_id: 'u1', name: 'Forza', sessions: [] }
  expect(inRouter(<PlanScreen initial={{ ...base, is_active: true, archived: false }} />)).not.toContain('Imposta come attiva')
  const archived = inRouter(<PlanScreen initial={{ ...base, is_active: false, archived: true }} />)
  expect(archived).not.toContain('Imposta come attiva')
  expect(archived).toContain('Archiviata')
})
