import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { SheetSnapshot } from '../../lib/exerciseSheet'
import type { CatalogExercise, Exercise } from '../../types/db'
import { PickFilterBar, PickResults, type CatalogState, type PickFilters } from './PickResults'

const noop = () => {}
const idle: SheetSnapshot = { added: new Set(), busy: new Set(), addedCount: 0, creating: false, failure: null }

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
    catalog_id: null,
    ...overrides,
  }
}

function entry(id: string, overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id,
    slug: `voce-${id}`,
    name_it: `Voce ${id}`,
    name_en: null,
    synonyms: [],
    equipment: 'barbell',
    primary_muscle: 'Petto',
    secondary_muscles: [],
    execution_steps: null,
    source: 'test',
    source_id: id,
    ...overrides,
  }
}

const readyCatalog = (entries: CatalogExercise[], adoptedIds: string[] = []): CatalogState => ({
  status: 'ready',
  data: { entries, adoptedIds: new Set(adoptedIds) },
  reload: noop,
})

function render(exercises: Exercise[], catalog: CatalogState, { query = '', filters = {}, state = idle }: { query?: string; filters?: PickFilters; state?: SheetSnapshot } = {}) {
  return renderToStaticMarkup(
    <PickResults exercises={exercises} catalog={catalog} query={query} filters={filters} state={state} onToggle={noop} onAdopt={noop} />,
  )
}

describe('the two sections', () => {
  test('shows "I tuoi esercizi" before "Catalogo", each with its own entries', () => {
    const html = render([exercise('a')], readyCatalog([entry('c1')]))
    expect(html.indexOf('I tuoi esercizi')).toBeLessThan(html.indexOf('>Catalogo<'))
    expect(html.indexOf('Esercizio a')).toBeLessThan(html.indexOf('>Catalogo<'))
    expect(html.indexOf('Voce c1')).toBeGreaterThan(html.indexOf('>Catalogo<'))
  })

  test('each section is named by its heading, not by a duplicate label', () => {
    const html = render([exercise('a')], readyCatalog([entry('c1')]))
    for (const heading of ['I tuoi esercizi', 'Catalogo']) {
      const id = new RegExp(`<h3 id="([^"]+)"[^>]*>${heading}</h3>`).exec(html)?.[1]
      expect(id).toBeDefined()
      expect(html).toContain(`<section aria-labelledby="${id}">`)
    }
    expect(html).not.toContain('<section aria-label=')
  })

  test('a catalog entry offers to be added from the catalog and shows equipment and muscle', () => {
    const html = render([], readyCatalog([entry('c1', { equipment: 'dumbbell', primary_muscle: 'Bicipiti' })]))
    expect(html).toContain('aria-label="Voce c1, dal catalogo: tocca per aggiungere"')
    expect(html).toContain('Manubri · Bicipiti')
  })

  test('hides the entries already copied, archived copies included', () => {
    const copy = exercise('a', { catalog_id: 'c1' })
    const html = render([copy], readyCatalog([entry('c1'), entry('c2'), entry('c3')], ['c1', 'c2']))
    expect(html).not.toContain('Voce c1')
    expect(html).not.toContain('Voce c2')
    expect(html).toContain('Voce c3')
  })

  test('the search finds catalog entries by synonym and English name', () => {
    const catalog = readyCatalog([entry('c1', { synonyms: ['stacco'], name_en: 'Deadlift' }), entry('c2')])
    expect(render([], catalog, { query: 'stacco' })).toContain('Voce c1')
    expect(render([], catalog, { query: 'deadlift' })).not.toContain('Voce c2')
  })

  test('the entries are not clickable while a create or copy is in flight', () => {
    const html = render([], readyCatalog([entry('c1')]), { state: { ...idle, creating: true } })
    expect(html).toMatch(/<button(?=[^>]*disabled)[^>]*aria-label="Voce c1/)
  })
})

describe('filters', () => {
  const library = [exercise('a', { equipment: 'dumbbell', muscles: 'Bicipiti' }), exercise('b', { muscles: 'Petto' })]
  const catalog = readyCatalog([
    entry('c1', { equipment: 'dumbbell', primary_muscle: 'Bicipiti' }),
    entry('c2', { equipment: 'barbell', primary_muscle: 'Petto' }),
  ])

  test('equipment narrows both sections', () => {
    const html = render(library, catalog, { filters: { equipment: 'dumbbell' } })
    expect(html).toContain('Esercizio a')
    expect(html).toContain('Voce c1')
    expect(html).not.toContain('Esercizio b')
    expect(html).not.toContain('Voce c2')
  })

  test('muscle narrows both sections', () => {
    const html = render(library, catalog, { filters: { muscle: 'Petto' } })
    expect(html).toContain('Esercizio b')
    expect(html).toContain('Voce c2')
    expect(html).not.toContain('Esercizio a')
    expect(html).not.toContain('Voce c1')
  })

  test('says so when the filters leave nothing', () => {
    const html = render(library, catalog, { filters: { equipment: 'other' } })
    expect(html).toContain('Nessun tuo esercizio corrisponde ai filtri.')
    expect(html).toContain('Nessuna voce del catalogo corrisponde ai filtri.')
  })

  test('the filter bar presses the active keys and lists each primary muscle once, sorted', () => {
    const many = readyCatalog([entry('c1', { primary_muscle: 'Spalle' }), entry('c2', { primary_muscle: 'Bicipiti' }), entry('c3', { primary_muscle: 'Spalle' })])
    const html = renderToStaticMarkup(<PickFilterBar catalog={many} value={{ equipment: 'dumbbell', muscle: 'Spalle' }} onChange={noop} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Manubri</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Bilanciere</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Spalle</)
    expect(html.match(/>Spalle</g)).toHaveLength(1)
    expect(html.indexOf('>Bicipiti<')).toBeLessThan(html.indexOf('>Spalle<'))
  })

  test('without a loaded catalog only the equipment keys are there', () => {
    const html = renderToStaticMarkup(<PickFilterBar catalog={{ status: 'loading', reload: noop }} value={{}} onChange={noop} />)
    expect(html).toContain('Filtra per attrezzo')
    expect(html).not.toContain('Filtra per muscolo')
  })
})

describe('the user exercises', () => {
  test('marks an added exercise and keeps toggling working next to the catalog', () => {
    const html = render([exercise('a')], readyCatalog([entry('c1')]), { state: { ...idle, added: new Set(['a']), addedCount: 1 } })
    expect(html).toContain('Esercizio a, aggiunto: tocca per rimuovere')
  })

  test('an empty library points to the catalog and to the custom exercise', () => {
    const html = render([], readyCatalog([entry('c1')]))
    expect(html).toContain('La libreria è vuota. Scegli dal catalogo o aggiungi un esercizio personalizzato.')
  })

  test('names the search when none of the exercises match', () => {
    expect(render([exercise('a')], readyCatalog([]), { query: 'zzz' })).toContain('Nessun tuo esercizio corrisponde a «zzz».')
  })
})

describe('the catalog states', () => {
  test('shows a skeleton while it loads and keeps the user exercises usable', () => {
    const html = render([exercise('a')], { status: 'loading', reload: noop })
    expect(html).toContain('Caricamento del catalogo')
    expect(html).toContain('Esercizio a')
  })

  test('a failed fetch shows an Italian alert with a retry, and the user exercises stay', () => {
    const html = render([exercise('a')], { status: 'error', error: new Error('boom'), reload: noop })
    expect(html).toMatch(/role="alert"[^>]*>.*Catalogo non disponibile\. Controlla la connessione e riprova\. I tuoi esercizi funzionano lo stesso\./)
    expect(html).toContain('Riprova')
    expect(html).toContain('Esercizio a, tocca per aggiungere')
    expect(html).not.toContain('boom')
  })

  test('an empty catalog says so', () => {
    expect(render([exercise('a')], readyCatalog([]))).toContain('Il catalogo è vuoto.')
  })

  test('a catalog fully copied says so instead of looking empty', () => {
    expect(render([], readyCatalog([entry('c1')], ['c1']))).toContain('Hai già tutti gli esercizi del catalogo.')
  })

  test('names the search when no catalog entry matches', () => {
    expect(render([], readyCatalog([entry('c1')]), { query: 'zzz' })).toContain('Nessuna voce del catalogo corrisponde a «zzz».')
  })
})
