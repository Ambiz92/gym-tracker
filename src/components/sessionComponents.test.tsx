import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ExerciseCard } from './ExerciseCard'
import { SessionProgress } from './SessionProgress'
import { SessionSummary } from './SessionSummary'
import { SetLogger } from './SetLogger'
import { SyncBanner } from './SyncBanner'
import { UndoToast } from './UndoToast'
import { WarmUp } from './WarmUp'

const render = (ui: ReactElement) => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>)
const noop = () => {}

describe('SyncBanner', () => {
  it('renders nothing when everything is sent', () => {
    expect(render(<SyncBanner count={0} syncing={false} failed={false} onRetry={noop} />)).toBe('')
  })

  it('counts the sets to send and offers the retry', () => {
    const html = render(<SyncBanner count={2} syncing={false} failed onRetry={noop} />)
    expect(html).toContain('2 serie da inviare · invio non riuscito')
    expect(html).toContain('Riprova')
    expect(html).not.toContain('disabled')
  })

  it('disables the retry while sending', () => {
    const html = render(<SyncBanner count={1} syncing failed={false} onRetry={noop} />)
    expect(html).toContain('1 serie da inviare')
    expect(html).toContain('disabled=""')
  })
})

describe('ExerciseCard', () => {
  it('links to the set logger and says in text that the exercise is done', () => {
    const html = render(<ExerciseCard to="/session/s1?es=e1" name="Panca piana" detail="3×8" done />)
    expect(html).toContain('href="/session/s1?es=e1"')
    expect(html).toContain('exercise-card--done')
    expect(html).toContain('Completato.')
  })

  it('shows the progression chip with a spoken description', () => {
    const html = render(<ExerciseCard to="/x" name="Curl" detail="3×10" done={false} chip={{ label: '+2,5', description: 'Suggerito: 15 kg, più 2,5' }} />)
    expect(html).toContain('<span aria-hidden="true">+2,5</span>')
    expect(html).toContain('Suggerito: 15 kg, più 2,5')
    expect(html).not.toContain('Completato')
  })
})

it('WarmUp starts collapsed and lists the movements', () => {
  const html = render(<WarmUp items={[{ id: '1', name: 'Cerchi con le braccia', reps_text: '10 per lato', note: null }]} />)
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain('1 movimento')
  expect(html).toContain('hidden=""')
  expect(html).toContain('10 per lato')
})

it('WarmUp renders nothing without items', () => {
  expect(render(<WarmUp items={[]} />)).toBe('')
})

it('SessionProgress exposes the completed count', () => {
  const html = render(<SessionProgress done={3} total={7} />)
  expect(html).toContain('role="progressbar"')
  expect(html).toContain('aria-valuenow="3"')
  expect(html).toContain('aria-valuetext="3 su 7"')
  expect(html.match(/plate-pill--done/g)).toHaveLength(3)
  expect(html.match(/plate-pill--current/g)).toHaveLength(1)
  expect(html.match(/class="plate-pill"/g)).toHaveLength(3)
})

it('UndoToast offers Annulla', () => {
  expect(render(<UndoToast message="Serie 2 salvata" onUndo={noop} />)).toContain('Annulla')
})

describe('SetLogger', () => {
  const props = {
    exercise: { name: 'Curl con bilanciere', muscles: 'Bicipiti', executionSteps: null },
    unit: 'reps' as const,
    setNumber: 2,
    targetSets: 3,
    position: { current: 4, total: 7 },
    initial: { weight: 15, reps: 10, equipment: 'barbell' as const },
    hint: 'Ultima volta 12,5 kg × 10 · suggerito 15 ↑',
    backTo: '/session/s1',
    onBack: noop,
    toast: null,
    onConfirm: noop,
  }

  it('opens on the prefilled values with the confirm button for the current set', () => {
    const html = render(<SetLogger {...props} />)
    expect(html).toContain('<h1 class="session-header__title">Curl con bilanciere</h1>')
    expect(html).toContain('Serie 2 / 3')
    expect(html).toContain('Peso: 15 chilogrammi. Tocca per scrivere')
    expect(html).toContain('Ripetizioni: 10 ripetizioni. Tocca per scrivere')
    expect(html).toContain('Diminuisci peso di 2,5')
    expect(html).toContain('Ultima volta 12,5 kg × 10 · suggerito 15 ↑')
    expect(html).toContain('Conferma serie 2')
    expect(html).not.toContain('set-warning')
  })

  it('steps the weight by one kg on dumbbells and holds by five seconds', () => {
    const dumbbell = render(<SetLogger {...props} initial={{ ...props.initial, equipment: 'dumbbell' }} />)
    expect(dumbbell).toContain('Aumenta peso di 1')
    const hold = render(<SetLogger {...props} unit="seconds" initial={{ weight: 0, reps: 30, equipment: 'other' }} />)
    expect(hold).toContain('Aumenta secondi di 5')
  })

  describe('on a hold or a carry', () => {
    const numberLabel = (html: string, size: 'big' | 'medium') => new RegExp(`value--${size}"><button[^>]*aria-label="([^"]*)"`).exec(html)?.[1]

    it('puts the weight first on reps, as the giant number', () => {
      const html = render(<SetLogger {...props} />)
      expect(numberLabel(html, 'big')).toBe('Peso: 15 chilogrammi. Tocca per scrivere')
      expect(numberLabel(html, 'medium')).toBe('Ripetizioni: 10 ripetizioni. Tocca per scrivere')
    })

    it.each([
      ['seconds', 'Secondi: 30 secondi', 'Aumenta secondi di 5'],
      ['meters', 'Metri: 30 metri', 'Aumenta metri di 5'],
    ] as const)('makes the %s the giant number and the weight the medium one', (unit, label, bigStep) => {
      const html = render(<SetLogger {...props} unit={unit} initial={{ weight: 0, reps: 30, equipment: 'other' }} />)
      expect(numberLabel(html, 'big')).toBe(`${label}. Tocca per scrivere`)
      expect(numberLabel(html, 'medium')).toBe('Peso: 0 chilogrammi. Tocca per scrivere')
      expect(html).toContain(bigStep)
      expect(html).toContain('Aumenta peso di')
      expect(html).toContain('Tocca il numero per scriverlo')
    })

    it('keeps the unit next to each number', () => {
      const html = render(<SetLogger {...props} unit="seconds" initial={{ weight: 0, reps: 30, equipment: 'other' }} />)
      expect(html.indexOf('aria-hidden="true">sec<')).toBeGreaterThan(-1)
      expect(html.indexOf('aria-hidden="true">sec<')).toBeLessThan(html.indexOf('aria-hidden="true">kg<'))
    })
  })

  it('warns, without disabling anything, above ten reps', () => {
    const html = render(<SetLogger {...props} initial={{ ...props.initial, reps: 12 }} />)
    expect(html).toContain('Sopra le 10 ripetizioni')
    expect(html).toContain('Puoi salvare lo stesso')
    expect(html).not.toContain('disabled')
  })

  it('does not warn on a timed set', () => {
    expect(render(<SetLogger {...props} unit="seconds" initial={{ ...props.initial, reps: 45 }} />)).not.toContain('set-warning')
  })
})

describe('SessionSummary', () => {
  const props = { sessionName: 'Upper', backTo: '/session/s1', minutes: 52, notes: '', onNotes: noop, busy: false, failed: false, onFinish: noop }

  it('shows the change since last time for each exercise', () => {
    const html = render(
      <SessionSummary
        {...props}
        rows={[
          { exerciseId: 'a', name: 'Curl', sets: 3, weightsKg: [15, 15, 12.5], weightKg: 15, equipment: 'barbell', deltaKg: 2.5 },
          { exerciseId: 'b', name: 'Panca', sets: 3, weightsKg: [15, 15, 15], weightKg: 15, equipment: 'barbell', deltaKg: 0 },
          { exerciseId: 'c', name: 'Squat', sets: 3, weightsKg: [30, 30, 30], weightKg: 30, equipment: 'barbell', deltaKg: null },
        ]}
      />,
    )
    expect(html).toContain('52 min')
    expect(html).toContain('3 esercizi · 9 serie')
    expect(html).toContain('2 × 15 kg · 1 × 12,5 kg')
    expect(html).toContain('3 × 30 kg')
    expect(html).toContain('+2,5 kg')
    expect(html).toContain('2,5 kg in più dell&#x27;ultima volta')
    expect(html).toContain('stesso peso')
    expect(html).toContain('prima volta')
    expect(html).toContain('primo allenamento')
    expect(html).toContain('Note (facoltativo)')
  })

  it('says nothing is saved when no set was logged, and shows a failed close', () => {
    const html = render(<SessionSummary {...props} rows={[]} failed />)
    expect(html).toContain('la sessione non verrà salvata')
    expect(html).toContain('role="alert"')
  })
})
