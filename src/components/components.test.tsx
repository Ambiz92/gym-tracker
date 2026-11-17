import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { Field } from './Field'
import { PageHeader } from './PageHeader'
import { PrimaryButton } from './PrimaryButton'
import { RowLink } from './RowLink'

function renderAt(path: string, ui: ReactElement) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)
}

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

test('RowLink links to its target and hides the decorative numeral', () => {
  const html = renderAt('/', <RowLink to="/session/1" title="Upper body" detail="7 esercizi" index={1} />)
  expect(html).toContain('href="/session/1"')
  expect(html).toContain('row-link--indexed')
  expect(html).toContain('<span class="row-link__index" aria-hidden="true">1</span>')
  expect(html).not.toContain('row-link--inverted')
})

test('RowLink shows the arrow by default, hidden from assistive tech', () => {
  const html = renderAt('/', <RowLink to="/plans" title="Schede" />)
  expect(html).toContain('<span class="row-link__arrow" aria-hidden="true">→</span>')
  expect(html).not.toContain('row-link__tag')
})

test('RowLink supports the inverted variant and a tag instead of the arrow', () => {
  const html = renderAt('/', <RowLink to="/" title="Scheda attiva" tag="Riprendi" inverted />)
  expect(html).toContain('row-link--inverted')
  expect(html).toContain('<span class="row-link__tag">Riprendi</span>')
  expect(html).not.toContain('row-link__arrow')
})

test('PrimaryButton is an enabled non-submitting button by default', () => {
  const html = renderAt('/', <PrimaryButton>Invia codice</PrimaryButton>)
  expect(html).toContain('type="button"')
  expect(html).not.toContain('disabled')
  expect(html).not.toContain('aria-busy')
  expect(html).toContain('primary-button--solid')
})

test('PrimaryButton can be disabled', () => {
  const html = renderAt('/', <PrimaryButton disabled>Invia codice</PrimaryButton>)
  expect(html).toContain('disabled=""')
  expect(html).not.toContain('aria-busy')
})

test('PrimaryButton busy is announced and disables the button', () => {
  const html = renderAt('/', <PrimaryButton busy>Invio</PrimaryButton>)
  expect(html).toContain('aria-busy="true"')
  expect(html).toContain('disabled=""')
})

test('Field links the label to the input', () => {
  const html = renderAt('/', <Field label="Email" value="" onChange={() => undefined} type="email" />)
  const id = /<input id="([^"]+)"/.exec(html)?.[1]
  expect(id).toBeTruthy()
  expect(html).toContain(`for="${id}"`)
  expect(html).not.toContain('aria-invalid')
  expect(html).not.toContain('required')
})

test('Field marks a required input in the label and on the input', () => {
  const html = renderAt('/', <Field label="Email" value="" onChange={() => undefined} required />)
  expect(html).toContain('Email<span aria-hidden="true"> *</span>')
  expect(html).toContain('required=""')
})

test('Field renders a decimal input as text with a decimal keyboard', () => {
  const html = renderAt(
    '/',
    <Field label="Peso" value="" onChange={() => undefined} inputMode="decimal" enterKeyHint="next" />,
  )
  expect(html).toContain('type="text"')
  expect(html).toContain('inputMode="decimal"')
  expect(html).toContain('enterKeyHint="next"')
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
