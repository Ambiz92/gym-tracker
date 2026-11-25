import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { UndoToast } from '../../components/UndoToast'
import type { PlanExerciseDetail } from '../../data/activePlan'
import type { SheetSnapshot } from '../../lib/exerciseSheet'
import type { Exercise } from '../../types/db'
import { AddExercisesSheet, NewExerciseForm, QuickCreate } from './AddExercisesSheet'
import { ExerciseEditRow } from './ExerciseEditRow'
import { ExerciseEditRows } from './ExerciseEditRows'
import { PlanFooter } from './PlanFooter'
import { SessionChips } from './SessionChips'

const noop = () => {}
const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

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

function row(id: string, overrides: Partial<PlanExerciseDetail> = {}): PlanExerciseDetail {
  return {
    id,
    owner_id: 'u1',
    session_id: 's1',
    exercise_id: `e-${id}`,
    position: 0,
    target_sets: 3,
    target_reps: 8,
    target_unit: 'reps',
    suggested_weight_kg: 20,
    suggested_weight_max_kg: null,
    exercise: exercise(`e-${id}`),
    ...overrides,
  }
}

const rowProps = { index: 0, count: 1, busy: false, grip: null, onSave: () => Promise.resolve(), onApply: noop, onMove: noop, onRemove: noop }

describe('an exercise row', () => {
  test('shows its three numbers as open fields, named after the exercise, with no edit or save step', () => {
    const html = render(<ExerciseEditRow {...rowProps} row={row('a')} />)
    expect(html).toMatch(/<input[^>]*aria-label="Serie di Esercizio e-a"[^>]*value="3"/)
    expect(html).toMatch(/<input[^>]*aria-label="Ripetizioni, secondi o metri di Esercizio e-a"[^>]*value="8"/)
    expect(html).toMatch(/<input[^>]*aria-label="Peso suggerito di Esercizio e-a \(kg per lato\)"[^>]*value="10"/)
    expect(html).toContain('Bilanciere')
    expect(html).not.toMatch(/Modifica|Salva</)
  })

  test('has an inputmode that opens the right keyboard: digits for sets and reps, decimals for the weight', () => {
    const html = render(<ExerciseEditRow {...rowProps} row={row('a')} />)
    expect(html.match(/inputMode="numeric"/g)).toHaveLength(2)
    expect(html.match(/inputMode="decimal"/g)).toHaveLength(1)
  })

  test('shows a barbell weight, stored as the total of both sides, as one side and says so', () => {
    const html = render(<ExerciseEditRow {...rowProps} row={row('a', { suggested_weight_kg: 25 })} />)
    expect(html).toContain('value="12,5"')
    expect(html).toContain('>Kg per lato<')
  })

  test('shows a dumbbell weight as stored', () => {
    const dumbbell = row('a', { suggested_weight_kg: 12.5, exercise: exercise('e-a', { equipment: 'dumbbell' }) })
    const html = render(<ExerciseEditRow {...rowProps} row={dumbbell} />)
    expect(html).toContain('value="12,5"')
    expect(html).toContain('>Peso kg<')
  })

  test('writes the weight with a comma and leaves it empty when there is none', () => {
    expect(render(<ExerciseEditRow {...rowProps} row={row('a', { suggested_weight_kg: 25 })} />)).toContain('value="12,5"')
    expect(render(<ExerciseEditRow {...rowProps} row={row('a', { suggested_weight_kg: null })} />)).toMatch(/aria-label="Peso suggerito[^>]*value=""/)
  })

  test('labels the reps field after the unit: rip, sec or m, and has a key to change it', () => {
    const label = (unit: PlanExerciseDetail['target_unit']) =>
      render(<ExerciseEditRow {...rowProps} row={row('a', { target_unit: unit })} />)
    expect(label('reps')).toMatch(/for="[^"]*-reps"[^>]*>rip</)
    expect(label('seconds')).toMatch(/for="[^"]*-reps"[^>]*>sec</)
    expect(label('meters')).toMatch(/for="[^"]*-reps"[^>]*>m</)
    expect(label('seconds')).toContain('aria-label="Unità di Esercizio e-a: sec. Cambia"')
  })

  test('shows the top of the weight range only for a row that already has one', () => {
    expect(render(<ExerciseEditRow {...rowProps} row={row('a')} />)).not.toContain('Fino a')
    const html = render(<ExerciseEditRow {...rowProps} row={row('a', { suggested_weight_max_kg: 25 })} />)
    expect(html).toContain('Fino a, per lato')
    expect(html).toContain('value="12,5"')
  })

  test('removes with one tap (the Undo toast is the safety net) and moves with buttons', () => {
    const html = render(<ExerciseEditRow {...rowProps} row={row('a')} />)
    expect(html).toContain('aria-label="Rimuovi Esercizio e-a"')
    expect(html).toContain('aria-label="Sposta su Esercizio e-a"')
    expect(html).not.toContain('Conferma rimozione')
  })

  test('keeps a polite status region ready for the saved message, and blocks remove and move while busy', () => {
    const html = render(<ExerciseEditRow {...rowProps} busy row={row('a')} />)
    expect(html).toContain('role="status"')
    expect(html).toMatch(/<button(?=[^>]*aria-label="Rimuovi Esercizio e-a")(?=[^>]*disabled)/)
  })
})

describe('the exercise rows', () => {
  const props = { busy: false, onSave: () => Promise.resolve(), onApply: noop, onMove: noop, onReorder: noop, onRemove: noop }

  test('invite to add the first exercise when the session is empty', () => {
    expect(render(<ExerciseEditRows {...props} exercises={[]} />)).toContain('Aggiungi esercizi')
  })

  test('give every row a pointer-only drag handle and keep the move buttons, the first one unable to go up', () => {
    const html = render(<ExerciseEditRows {...props} exercises={[row('a'), row('b')]} />)
    expect(html.match(/<span[^>]*class="plan-row__grip"[^>]*aria-hidden="true"/g)).toHaveLength(2)
    expect(html).toMatch(/<button(?=[^>]*aria-label="Sposta su Esercizio e-a")(?=[^>]*disabled)/)
    expect(html).toContain('aria-label="Sposta giù Esercizio e-a"')
  })
})

describe('the session keys', () => {
  const sessions = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ]

  test('press in the open session only, and end with a key that adds one', () => {
    const html = render(<SessionChips sessions={sessions} selectedId="b" busy={false} onSelect={noop} onAdd={noop} />)
    expect(html).toMatch(/aria-pressed="false"[^>]*>A</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>B</)
    expect(html).toContain('aria-label="Aggiungi sessione"')
    expect(html.indexOf('>B<')).toBeLessThan(html.indexOf('Aggiungi sessione'))
  })

  test('wait while a session is being added', () => {
    const html = render(<SessionChips sessions={sessions} selectedId="a" busy onSelect={noop} onAdd={noop} />)
    expect(html).toMatch(/<button(?=[^>]*aria-label="Aggiungi sessione")(?=[^>]*disabled)/)
  })
})

describe('the footer bar', () => {
  const base = {
    sessionCount: 2,
    exerciseCount: 10,
    replacing: null,
    busy: false,
    error: null,
    toast: null,
    onToggle: noop,
    onConfirmReplace: noop,
    onCancelReplace: noop,
  }
  const draft = { is_active: false, archived: false }

  test('sums up the plan, says a draft stays out of Oggi and offers the one Attiva button', () => {
    const html = render(<PlanFooter {...base} plan={draft} />)
    expect(html).toContain('2 sessioni · 10 esercizi')
    expect(html).toContain('Bozza · non compare in Oggi')
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Attiva<\/button>/)
    expect(html.match(/<button/g)).toHaveLength(1)
  })

  test('shows an active plan as pressed with a check', () => {
    const html = render(<PlanFooter {...base} plan={{ is_active: true, archived: false }} />)
    expect(html).toContain('Attiva · compare in Oggi')
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>✓ Attiva<\/button>/)
  })

  test('is disabled for a plan with no exercise and says what is missing', () => {
    const html = render(<PlanFooter {...base} plan={draft} exerciseCount={0} sessionCount={1} />)
    expect(html).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-describedby="plan-footer-hint")/)
    expect(html).toContain('Aggiungi un esercizio per attivarla.')
  })

  test('asks once before replacing the plan in Oggi, naming it', () => {
    const html = render(<PlanFooter {...base} plan={draft} replacing="Forza base" />)
    expect(html).toContain('Sostituisce la scheda attuale')
    expect(html).toContain('«Forza base»')
    expect(html).toContain('Sostituisci')
    expect(html).toContain('Annulla')
    expect(html).not.toContain('2 sessioni')
  })

  test('has no button on an archived plan', () => {
    const html = render(<PlanFooter {...base} plan={{ is_active: false, archived: true }} />)
    expect(html).toContain('Archiviata')
    expect(html).not.toContain('<button')
  })

  test('announces the Undo toast and a failed activation', () => {
    const html = render(<PlanFooter {...base} plan={draft} error="Attivazione non riuscita." toast={<UndoToast message="«Panca» rimosso" onUndo={noop} />} />)
    expect(html).toMatch(/<div role="status"><div class="undo-toast"><span>«Panca» rimosso<\/span>/)
    expect(html).toMatch(/role="alert"[^>]*>Attivazione non riuscita\./)
  })
})

describe('the add sheet', () => {
  const idle: SheetSnapshot = { added: new Set(), busy: new Set(), addedCount: 0, creating: false, failure: null }
  const ready = (exercises: Exercise[], state: SheetSnapshot = idle) =>
    render(
      <AddExercisesSheet
        sessionName="A"
        library={{ status: 'ready', data: exercises, reload: noop }}
        catalog={{ status: 'ready', data: { entries: [], adoptedIds: new Set() }, reload: noop }}
        state={state}
        onToggle={noop}
        onCreate={() => Promise.resolve(true)}
        onAdopt={() => Promise.resolve(true)}
        onClose={noop}
      />,
    )

  test('is a dialog named Aggiungi esercizi with a Fine button, and the create button above the list', () => {
    const html = ready([exercise('a')])
    expect(html).toMatch(/<dialog[^>]*aria-labelledby=/)
    expect(html).toContain('Aggiungi esercizi')
    expect(html).toContain('>Fine<')
    expect(html.indexOf('+ Aggiungi personalizzato')).toBeGreaterThan(html.indexOf('type="search"'))
    expect(html.indexOf('+ Aggiungi personalizzato')).toBeLessThan(html.indexOf('Esercizio a'))
  })

  test('marks an added exercise as pressed, says to tap to remove it, and counts the added ones', () => {
    const html = ready([exercise('a'), exercise('b')], { ...idle, added: new Set(['a']), addedCount: 1 })
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="Esercizio a, aggiunto: tocca per rimuovere"/)
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="Esercizio b, tocca per aggiungere"/)
    expect(html).toContain('✓ Aggiunto')
    expect(html).toContain('1 aggiunti')
  })

  test('shows the starting weight that a new row will get', () => {
    const html = ready([exercise('a', { starting_weight_kg: 12.5, equipment: 'dumbbell' })])
    expect(html).toContain('Manubri · 12,5 kg')
    expect(ready([exercise('b', { starting_weight_kg: 25 })])).toContain('Bilanciere · 12,5 kg per lato')
  })

  test('announces a failed add as an alert and keeps the list', () => {
    const html = ready([exercise('a')], { ...idle, failure: 'Aggiunta non riuscita. Controlla la connessione e riprova.' })
    expect(html).toMatch(/role="alert"[^>]*>Aggiunta non riuscita/)
    expect(html).toContain('Esercizio a')
  })

  test('invites to create the first exercise when the library is empty', () => {
    expect(ready([])).toContain('La libreria è vuota')
  })

  test('shows a skeleton while the library loads, with the search box and the way out already there', () => {
    const html = render(
      <AddExercisesSheet
        sessionName="A"
        library={{ status: 'loading', reload: noop }}
        catalog={{ status: 'loading', reload: noop }}
        state={idle}
        onToggle={noop}
        onCreate={() => Promise.resolve(true)}
        onAdopt={() => Promise.resolve(true)}
        onClose={noop}
      />,
    )
    expect(html).toContain('Caricamento')
    expect(html).toContain('type="search"')
    expect(html).toContain('>Fine<')
  })

  test('shows the catalog error inside the sheet and leaves the user exercises tappable', () => {
    const html = render(
      <AddExercisesSheet
        sessionName="A"
        library={{ status: 'ready', data: [exercise('a')], reload: noop }}
        catalog={{ status: 'error', error: new Error('offline'), reload: noop }}
        state={idle}
        onToggle={noop}
        onCreate={() => Promise.resolve(true)}
        onAdopt={() => Promise.resolve(true)}
        onClose={noop}
      />,
    )
    expect(html).toContain('Catalogo non disponibile')
    expect(html).toContain('Esercizio a, tocca per aggiungere')
    expect(html).toContain('+ Aggiungi personalizzato')
  })

  test('has the equipment filter between the custom button and the results', () => {
    const html = ready([exercise('a')])
    expect(html.indexOf('Filtra per attrezzo')).toBeGreaterThan(html.indexOf('+ Aggiungi personalizzato'))
    expect(html.indexOf('Filtra per attrezzo')).toBeLessThan(html.indexOf('I tuoi esercizi'))
  })

  test('the quick create row names the typed exercise and offers the three equipments, none preselected', () => {
    const html = renderToStaticMarkup(<QuickCreate name="Curl a martello" busy={false} onCreate={noop} />)
    expect(html).toContain('Crea «Curl a martello»')
    for (const label of ['Bilanciere', 'Manubri', 'Altro']) expect(html).toContain(`>${label}</button>`)
    expect(html).not.toContain('aria-pressed')
  })

  test('the new exercise form starts from the typed name with Bilanciere chosen and an optional weight', () => {
    const html = renderToStaticMarkup(<NewExerciseForm initialName="Curl a martello" busy={false} onSubmit={noop} onCancel={noop} />)
    expect(html).toContain('value="Curl a martello"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Bilanciere</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Manubri</)
    expect(html).toContain('Peso di partenza (kg per lato, facoltativo)')
    expect(html).toContain('Crea e aggiungi')
  })

  test('the new exercise form blocks its submit while the exercise is being created', () => {
    const html = renderToStaticMarkup(<NewExerciseForm initialName="" busy onSubmit={noop} onCancel={noop} />)
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled)/)
  })
})
