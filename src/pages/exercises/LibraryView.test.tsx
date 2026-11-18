import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import type { Exercise } from '../../types/db'
import { LibraryView } from './LibraryView'

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    owner_id: 'u1',
    name: `Esercizio ${id}`,
    equipment: 'barbell',
    muscles: null,
    execution_steps: null,
    notes: null,
    starting_weight_kg: null,
    archived: false,
    ...overrides,
  }
}

function render(library: Parameters<typeof LibraryView>[0]['library'], notice: string | null = null) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LibraryView library={library} notice={notice} onNew={() => {}} onSelect={() => {}} />
    </MemoryRouter>,
  )
}

test('shows a loading status while the library loads', () => {
  const html = render({ status: 'loading', reload: () => {} })
  expect(html).toContain('Caricamento della libreria')
  expect(html).not.toContain('<ul')
})

test('shows a retry and reassures about the data when loading fails', () => {
  const html = render({ status: 'error', error: new Error('boom'), reload: () => {} })
  expect(html).toContain('role="alert"')
  expect(html).toContain('non sono stati toccati')
  expect(html).toContain('Riprova')
  expect(html).not.toContain('boom')
})

test('first use: an empty library offers to create the first exercise', () => {
  const html = render({ status: 'ready', data: { exercises: [], usage: null }, reload: () => {} })
  expect(html).toContain('La libreria è vuota')
  expect(html).toContain('Crea esercizio')
  expect(html).toContain('0 esercizi')
})

test('counts only active exercises and tags archived ones', () => {
  const html = render({
    status: 'ready',
    data: { exercises: [exercise('a'), exercise('b'), exercise('c', { archived: true })], usage: null },
    reload: () => {},
  })
  expect(html).toContain('2 esercizi')
  expect(html).toContain('Archiviato')
})

test('announces the notice of the last action', () => {
  const html = render({ status: 'ready', data: { exercises: [exercise('a')], usage: null }, reload: () => {} }, 'Esercizio salvato.')
  expect(html).toMatch(/<div role="status"><p class="exercises__status">Esercizio salvato\.<\/p><\/div>/)
  expect(html).toContain('href="/plans"')
})

test('on desktop each row says how many plans use the exercise', () => {
  const html = render({
    status: 'ready',
    data: { exercises: [exercise('a'), exercise('b'), exercise('c')], usage: new Map([['a', 1], ['b', 2]]) },
    reload: () => {},
  })
  expect(html).toContain('Bilanciere · in 1 scheda')
  expect(html).toContain('Bilanciere · in 2 schede')
  expect(html).toContain('Bilanciere · non usato')
})
