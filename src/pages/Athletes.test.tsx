import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CoachLink } from '../types/db'
import { AthleteView } from './AthleteView'
import { Athletes } from './Athletes'
import { LinksStub, makeLink, ME, OTHER } from './coach/fakeLinks'

let aal2: boolean | null | 'loading' = true
vi.mock('../auth/useAal2', () => ({
  useAal2: () => ({ aal2: aal2 === 'loading' ? null : aal2, loading: aal2 === 'loading', retry: () => undefined }),
}))

beforeEach(() => {
  aal2 = true
})

const ATHLETE = '5d4a4e6f-3f2b-4c1e-9a7b-0c1d2e3f4a5b'
const asCoach = (overrides: Partial<CoachLink> = {}) =>
  makeLink({ id: 'a1', coach_id: ME, athlete_id: ATHLETE, status: 'active', athlete_label: 'Luca', accepted_at: '2026-11-21T09:00:00Z', ...overrides })

function renderAt(path: string, asCoachLinks: CoachLink[], fixed?: 'loading' | Error) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <LinksStub fixed={fixed ?? { asAthlete: [], asCoach: asCoachLinks }}>
        <Routes>
          <Route path="/athletes" element={<Athletes />} />
          <Route path="/athletes/:athleteId" element={<AthleteView />} />
        </Routes>
      </LinksStub>
    </MemoryRouter>,
  )
}

describe('Atleti list', () => {
  test('lists the active athletes by the name they chose, each linking to its view', () => {
    const html = renderAt('/athletes', [asCoach(), asCoach({ id: 'a2', athlete_id: OTHER, athlete_label: 'Sara' }), asCoach({ id: 'a3', status: 'pending', athlete_label: 'Attesa' })])
    expect(html).toContain(`href="/athletes/${ATHLETE}"`)
    expect(html).toContain(`href="/athletes/${OTHER}"`)
    expect(html).toContain('Luca')
    expect(html).toContain('Sara')
    expect(html).not.toContain('Attesa')
    expect(html).toContain('athlete-list')
  })

  test('without active athletes it points to Altro', () => {
    const html = renderAt('/athletes', [asCoach({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })])
    expect(html).toContain('Nessun atleta attivo.')
    expect(html).toContain('href="/more"')
  })

  test('at aal1 it prompts for the second factor', () => {
    aal2 = false
    expect(renderAt('/athletes', [asCoach()])).toContain('serve il secondo fattore')
  })

  test('a failed load is a retryable alert', () => {
    expect(renderAt('/athletes', [], new Error('boom'))).toContain('role="alert"')
  })
})

describe('Atleta view', () => {
  test('names the athlete in a banner that says it is read-only', () => {
    const html = renderAt(`/athletes/${ATHLETE}`, [asCoach()])
    expect(html).toContain('Stai guardando i dati di <bdi>Luca</bdi>')
    expect(html).toContain('Puoi solo leggere')
    expect(html).toContain('href="/athletes"')
  })

  test('at aal2 it starts loading the data', () => {
    expect(renderAt(`/athletes/${ATHLETE}`, [asCoach()])).toContain('Caricamento')
  })

  test('while the level is read it shows a skeleton, and when reading failed a retryable alert without a prompt', () => {
    aal2 = 'loading'
    expect(renderAt(`/athletes/${ATHLETE}`, [asCoach()])).toContain('Caricamento')
    aal2 = null
    const html = renderAt(`/athletes/${ATHLETE}`, [asCoach()])
    expect(html).toContain('Non riesco a verificare il secondo fattore')
    expect(html).toContain('Riprova')
    expect(html).not.toContain('Attiva il secondo fattore')
    expect(html).not.toContain('Caricamento')
  })

  test('at aal1 it asks for the second factor and loads nothing', () => {
    aal2 = false
    const html = renderAt(`/athletes/${ATHLETE}`, [asCoach()])
    expect(html).toContain('serve il secondo fattore')
    expect(html).not.toContain('Caricamento')
  })

  test.each([
    ['an id that is not linked', `/athletes/${OTHER}`, [asCoach()]],
    ['a pending link', `/athletes/${ATHLETE}`, [asCoach({ status: 'pending', accepted_at: null })]],
    ['a revoked link', `/athletes/${ATHLETE}`, [asCoach({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })]],
    ['an id that is not a uuid', '/athletes/..%2F..', [asCoach()]],
  ])('%s is not found, and shows nothing of the data', (_name, path, links) => {
    const html = renderAt(path, links)
    expect(html).toContain('Atleta non trovato.')
    expect(html).not.toContain('Stai guardando')
    expect(html).not.toContain('Caricamento')
  })

  test('the name is rendered as text, never as markup', () => {
    const html = renderAt(`/athletes/${ATHLETE}`, [asCoach({ athlete_label: '<script>x</script>' })])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
