import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import type { CoachLink } from '../../../types/db'
import { LinksStub, makeLink, ME, OTHER } from '../../coach/fakeLinks'
import { CoachSection } from './CoachSection'

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
  test('shows my code with its copy button and the link form with the consent text', () => {
    const html = render()
    expect(html).toContain(`<code>${ME}</code>`)
    expect(html).toContain('Copia il codice')
    expect(html).toContain('sono gli atleti a collegarsi a te')
    expect(html).toContain('Collegati al tuo allenatore')
    expect(html).toContain('Se confermi, il tuo allenatore potrà solo leggere questi dati')
    expect(html).not.toContain('Testo provvisorio')
    expect(html).not.toContain('coach-subhead">Il tuo allenatore')
    expect(html).not.toContain('I miei atleti')
  })

  test('the copy confirmation is a live region that takes no space until it has a message', () => {
    expect(render()).toContain('<p role="status" class="visually-hidden"></p>')
  })

  test('the link cannot be confirmed before the consent box is ticked', () => {
    expect(button(render(), 'Collegami al mio allenatore')).toContain('disabled')
  })
})

describe('as an athlete', () => {
  test('an active link shows its state and the revoke instead of the form', () => {
    const html = render({ asAthlete: [makeLink()] })
    expect(html).toContain('coach-subhead">Il tuo allenatore')
    expect(html).toContain('codice 9a7b0c1d…')
    expect(html).toContain('Attivo ·')
    expect(html).toContain('dal 20 nov')
    expect(html).toContain('<bdi>Marta</bdi>')
    expect(html).toContain('Revoca l’accesso')
    expect(html).not.toContain('Collegati al tuo allenatore')
  })

  test('a legacy pending link is shown as revocable and still blocks a second one', () => {
    const html = render({ asAthlete: [makeLink({ status: 'pending', accepted_at: null })] })
    expect(html).toContain('In sospeso')
    expect(html).toContain('Revoca l’accesso')
    expect(html).not.toContain('Collegati al tuo allenatore')
  })

  test('a revoked link is over: the link form is back', () => {
    const html = render({ asAthlete: [makeLink({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })] })
    expect(html).toContain('Collegati al tuo allenatore')
    expect(html).not.toContain('coach-subhead">Il tuo allenatore')
    expect(html).not.toContain('Revoca l’accesso')
  })
})

describe('as a coach', () => {
  const active = asCoach({ id: 'a1', athlete_label: 'Luca' })

  test('lists my athletes with the revoke, and no request to answer', () => {
    const html = render({ asCoach: [active] })
    expect(html).toContain('I miei atleti')
    expect(html).toContain('<bdi>Luca</bdi>')
    expect(html).toContain('Attivo ·')
    expect(html).toContain('Revoca l’accesso')
    expect(html).not.toContain('Richieste in arrivo')
    expect(html).not.toContain('Accetta')
    expect(html).not.toContain('Rifiuta')
  })

  test('a legacy pending row can still be revoked', () => {
    const html = render({ asCoach: [asCoach({ status: 'pending', accepted_at: null })] })
    expect(html).toContain('In sospeso')
    expect(html).toContain('Revoca l’accesso')
  })

  test('with only revoked links as coach there is nothing to show', () => {
    const html = render({ asCoach: [asCoach({ status: 'revoked', revoked_at: '2026-11-21T09:00:00Z', revoked_by: ME })] })
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
