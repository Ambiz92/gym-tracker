import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CoachLink } from '../../../types/db'
import { LinksStub, makeLink, ME, OTHER } from '../../coach/fakeLinks'
import { CoachSection } from './CoachSection'

let aal2: boolean | null = true
vi.mock('../../../auth/useAal2', () => ({ useAal2: () => ({ aal2, loading: aal2 === null, retry: () => undefined }) }))

beforeEach(() => {
  aal2 = true
})

interface Links {
  asAthlete?: CoachLink[]
  asCoach?: CoachLink[]
}

function render({ asAthlete = [], asCoach = [] }: Links = {}, fixed?: 'loading' | Error) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LinksStub fixed={fixed ?? { asAthlete, asCoach }}>
        <CoachSection />
      </LinksStub>
    </MemoryRouter>,
  )
}

const asCoach = (overrides: Partial<CoachLink>) => makeLink({ coach_id: ME, athlete_id: OTHER, ...overrides })

/** The button with this label, as its opening tag. */
const button = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}`))?.[0] ?? ''

describe('without links', () => {
  test('shows my code with its copy button and the request form with the consent text', () => {
    const html = render()
    expect(html).toContain(`<code>${ME}</code>`)
    expect(html).toContain('Copia il codice')
    expect(html).toContain('Chiedi a un allenatore')
    expect(html).toContain('Cosa vede il tuo allenatore')
    expect(html).not.toContain('Testo provvisorio')
    expect(html).not.toContain('Il tuo allenatore')
    expect(html).not.toContain('I miei atleti')
    expect(html).not.toContain('Richieste in arrivo')
  })

  test('the copy confirmation is a live region that takes no space until it has a message', () => {
    expect(render()).toContain('<p role="status" class="visually-hidden"></p>')
  })

  test('the request cannot be sent before the consent box is ticked', () => {
    expect(button(render(), 'Invia la richiesta')).toContain('disabled')
  })
})

describe('as an athlete', () => {
  test('a pending request shows its state and the withdraw action instead of the form', () => {
    const html = render({ asAthlete: [makeLink()] })
    expect(html).toContain('Il tuo allenatore')
    expect(html).toContain('codice 9a7b0c1d…')
    expect(html).toContain('In attesa di risposta')
    expect(html).toContain('Ritira la richiesta')
    expect(html).toContain('<bdi>Marta</bdi>')
    expect(html).not.toContain('Chiedi a un allenatore')
  })

  test('an active link offers the revoke', () => {
    const html = render({ asAthlete: [makeLink({ status: 'active', accepted_at: '2026-11-21T09:00:00Z' })] })
    expect(html).toContain('>Attivo ·')
    expect(html).toContain('Revoca l’accesso')
  })

  test('a revoked link is over: the request form is back', () => {
    const html = render({ asAthlete: [makeLink({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })] })
    expect(html).toContain('Chiedi a un allenatore')
    expect(html).not.toContain('Il tuo allenatore')
  })
})

describe('as a coach', () => {
  const pending = asCoach({ id: 'p1' })
  const active = asCoach({ id: 'a1', status: 'active', athlete_label: 'Luca', accepted_at: '2026-11-21T09:00:00Z' })

  test('lists incoming requests with accept and decline, and my athletes with the revoke', () => {
    const html = render({ asCoach: [pending, active] })
    expect(html).toContain('Richieste in arrivo')
    expect(html).toContain('Accetta')
    expect(html).toContain('Rifiuta')
    expect(html).toContain('I miei atleti')
    expect(html).toContain('<bdi>Luca</bdi>')
    expect(html).toContain('Revoca l’accesso')
  })

  test('at aal1 the accept is disabled and a prompt leads to the second factor', () => {
    aal2 = false
    const html = render({ asCoach: [pending] })
    expect(html).toContain('serve il secondo fattore')
    expect(html).toContain('href="/login/enroll"')
    expect(button(html, 'Accetta')).toContain('disabled')
    expect(button(html, 'Rifiuta')).not.toContain('disabled')
  })

  test('at aal2 there is no prompt and the accept is enabled', () => {
    const html = render({ asCoach: [pending] })
    expect(html).not.toContain('serve il secondo fattore')
    expect(button(html, 'Accetta')).not.toContain('disabled')
  })

  test('while aal2 is still unknown nothing is prompted yet, but the accept stays disabled', () => {
    aal2 = null
    const html = render({ asCoach: [pending] })
    expect(html).not.toContain('serve il secondo fattore')
    expect(button(html, 'Accetta')).toContain('disabled')
  })

  test('with only revoked links as coach there is nothing to prompt', () => {
    aal2 = false
    const html = render({ asCoach: [asCoach({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })] })
    expect(html).not.toContain('serve il secondo fattore')
    expect(html).not.toContain('I miei atleti')
  })
})

test('a name written by someone else is rendered as text, never as markup', () => {
  const html = render({ asCoach: [asCoach({ athlete_label: '<img src=x onerror=alert(1)>' })] })
  expect(html).not.toContain('<img')
  expect(html).toContain('<bdi>&lt;img src=x onerror=alert(1)&gt;</bdi>')
})

test('while loading it shows a status line, and a failed load a retryable alert', () => {
  expect(render({}, 'loading')).toContain('Caricamento')
  const html = render({}, new Error('boom'))
  expect(html).toContain('role="alert"')
  expect(html).toContain('Riprova')
  expect(html).not.toContain('Copia il codice')
})
