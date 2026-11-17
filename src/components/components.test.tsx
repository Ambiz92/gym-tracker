import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { AppRoutes } from '../App'
import { Field } from './Field'
import { PageHeader } from './PageHeader'
import { PrimaryButton } from './PrimaryButton'
import { RowLink } from './RowLink'

function renderAt(path: string, ui: ReactElement) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)
}

function renderApp(path: string) {
  return renderAt(path, <AppRoutes />)
}

test('tab bar links the four tabs and marks only the current one', () => {
  const html = renderApp('/plans')
  for (const href of ['href="/"', 'href="/plans"', 'href="/history"', 'href="/more"']) {
    expect(html).toContain(href)
  }
  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html).toMatch(/aria-current="page"[^>]*>Schede</)
})

test('the Oggi tab is current only on the home route', () => {
  expect(renderApp('/more')).not.toMatch(/aria-current="page"[^>]*>Oggi</)
  expect(renderApp('/')).toMatch(/aria-current="page"[^>]*>Oggi</)
})

test('Storico stays current on an exercise history page', () => {
  expect(renderApp('/history/abc')).toMatch(/aria-current="page"[^>]*>Storico</)
})

test('routes inside the layout have a main landmark and a navigation', () => {
  const html = renderApp('/history')
  expect(html).toContain('<main')
  expect(html).toContain('<nav')
  expect(html).toContain('<h1>Storico</h1>')
})

test('login has no tab bar', () => {
  const html = renderApp('/login')
  expect(html).not.toContain('<nav')
  expect(html).toContain('Accesso')
})

test('PageHeader renders the title as the h1 and the meta row', () => {
  const html = renderAt(
    '/',
    <PageHeader meta="Gym Tracker" metaEnd="Gio 17.11" title="Oggi" subtitle="Tre sessioni" />,
  )
  expect(html).toContain('<h1 class="page-header__title">Oggi</h1>')
  expect(html).toContain('Gym Tracker')
  expect(html).toContain('Gio 17.11')
  expect(html).toContain('Tre sessioni')
})

test('RowLink links to its target and hides the decorative arrow', () => {
  const html = renderAt('/', <RowLink to="/session/1" title="Upper body" detail="7 esercizi" index={1} />)
  expect(html).toContain('href="/session/1"')
  expect(html).toContain('row-link--indexed')
  expect(html).toContain('aria-hidden="true"')
  expect(html).not.toContain('row-link--inverted')
})

test('RowLink supports the inverted variant and a tag instead of the arrow', () => {
  const html = renderAt('/', <RowLink to="/" title="Scheda attiva" tag="Riprendi" inverted />)
  expect(html).toContain('row-link--inverted')
  expect(html).toContain('Riprendi')
  expect(html).not.toContain('aria-hidden')
})

test('PrimaryButton is a non-submitting button by default and can be disabled', () => {
  const html = renderAt('/', <PrimaryButton disabled>Invia codice</PrimaryButton>)
  expect(html).toContain('type="button"')
  expect(html).toContain('disabled')
  expect(html).toContain('primary-button--solid')
})

test('Field links the label to the input', () => {
  const html = renderAt('/', <Field label="Email" value="" onChange={() => undefined} type="email" />)
  const id = /<input id="([^"]+)"/.exec(html)?.[1]
  expect(id).toBeTruthy()
  expect(html).toContain(`for="${id}"`)
  expect(html).not.toContain('aria-invalid')
})

test('Field shows the error in text and links it to the input', () => {
  const html = renderAt(
    '/',
    <Field label="Email" value="x" onChange={() => undefined} hint="Aiuto" error="Email non valida" />,
  )
  const messageId = /aria-describedby="([^"]+)"/.exec(html)?.[1]
  expect(html).toContain('aria-invalid="true"')
  expect(html).toContain(`id="${messageId}"`)
  expect(html).toContain('Email non valida')
  expect(html).not.toContain('Aiuto')
})
