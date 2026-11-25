import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { targetFormFrom, type PlanTarget } from './planForm'
import { AUTOSAVE_DELAY_MS, TargetAutosave } from './targetAutosave'

const stored: PlanTarget = {
  target_sets: 3,
  target_reps: 8,
  target_unit: 'reps',
  suggested_weight_kg: 20,
  suggested_weight_max_kg: null,
}

/** A save that stays open until the test settles it. */
function deferred() {
  let resolve!: () => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save: (target: PlanTarget) => Promise<void> = () => Promise.resolve()) {
  const saves: PlanTarget[] = []
  const applied: PlanTarget[] = []
  const autosave = new TargetAutosave(targetFormFrom(stored, 'dumbbell'), {
    equipment: 'dumbbell',
    save: (target) => {
      saves.push(target)
      return save(target)
    },
    apply: (target) => applied.push(target),
    describeFailure: () => 'Salvataggio non riuscito. Riprova.',
  })
  return { autosave, saves, applied, state: () => autosave.getSnapshot() }
}

const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('saving while typing', () => {
  it('saves once, 400 ms after the last keystroke, with the latest text', async () => {
    const { autosave, saves, state } = setup()
    autosave.change({ sets: '4' })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100)
    autosave.change({ reps: '10' })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(saves).toEqual([])
    expect(state().status).toBe('dirty')

    await vi.advanceTimersByTimeAsync(1)
    expect(saves).toEqual([{ ...stored, target_sets: 4, target_reps: 10 }])
    expect(state().status).toBe('saved')
  })

  it('saves at once on blur and does not save again when the timer would have fired', async () => {
    const { autosave, saves } = setup()
    autosave.change({ sets: '5' })
    autosave.blur()
    await settle()
    expect(saves).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(saves).toHaveLength(1)
  })

  it('reads the weight with a comma or a dot and clears it when emptied', async () => {
    const { autosave, saves } = setup()
    autosave.change({ weight: '22,5' })
    autosave.blur()
    await settle()
    autosave.change({ weight: '' })
    autosave.blur()
    await settle()
    expect(saves.map((target) => target.suggested_weight_kg)).toEqual([22.5, null])
  })

  it('saves the unit with the row, and keeps a weight range it does not show', async () => {
    const withRange = { ...stored, suggested_weight_max_kg: 25 }
    const saves: PlanTarget[] = []
    const autosave = new TargetAutosave(targetFormFrom(withRange, 'dumbbell'), {
      equipment: 'dumbbell',
      save: async (target) => void saves.push(target),
      apply: () => {},
      describeFailure: () => '',
    })
    autosave.change({ unit: 'seconds' })
    autosave.blur()
    await settle()
    expect(saves).toEqual([{ ...withRange, target_unit: 'seconds' }])
  })

  it('saves a barbell weight typed per side as the total of both sides', async () => {
    const saves: PlanTarget[] = []
    const autosave = new TargetAutosave(targetFormFrom(stored, 'barbell'), {
      equipment: 'barbell',
      save: async (target) => void saves.push(target),
      apply: () => {},
      describeFailure: () => '',
    })
    expect(autosave.getSnapshot().values.weight).toBe('10')
    autosave.change({ weight: '12,5' })
    autosave.blur()
    await settle()
    expect(saves.map((target) => target.suggested_weight_kg)).toEqual([25])
  })

  it('tells the screen about each target as its save starts', async () => {
    const { autosave, applied } = setup()
    autosave.change({ sets: '4' })
    autosave.blur()
    await settle()
    expect(applied).toEqual([{ ...stored, target_sets: 4 }])
  })

  it('does not save when the text is back to what is stored', async () => {
    const { autosave, saves, state } = setup()
    autosave.change({ sets: '4' })
    autosave.change({ sets: '3' })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toEqual([])
    expect(state().status).toBe('idle')
  })

  it('keeps the saved status when the user leaves a row that was already saved', async () => {
    const { autosave, state } = setup()
    autosave.change({ sets: '4' })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    autosave.blur()
    await settle()
    expect(state().status).toBe('saved')
  })
})

describe('invalid text', () => {
  it('is never saved and stays quiet while typing', async () => {
    const { autosave, saves, state } = setup()
    autosave.change({ sets: '' })
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(saves).toEqual([])
    expect(state().errors).toEqual({})
  })

  it('is reported on blur, field by field, with the form messages', () => {
    const { autosave, state } = setup()
    autosave.change({ sets: '0', weight: 'venti' })
    autosave.blur()
    expect(state().errors).toEqual({
      sets: 'Serie: un numero intero da 1 a 99.',
      weight: 'Inserisci un peso in kg, ad esempio 12,5.',
    })
  })

  it('loses a field error as soon as that field is edited, and the fixed row saves', async () => {
    const { autosave, saves, state } = setup()
    autosave.change({ sets: '0' })
    autosave.blur()
    autosave.change({ sets: '4' })
    expect(state().errors).toEqual({})
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(saves).toHaveLength(1)
  })

  it('refuses a weight range whose top is below the weight, as the form does', () => {
    const { autosave, saves, state } = setup()
    autosave.change({ weight: '30', weightMax: '25' })
    autosave.blur()
    expect(state().errors.weightMax).toBe('Il massimo non può essere sotto il minimo.')
    expect(saves).toEqual([])
  })
})

describe('a failed save', () => {
  it('shows the failure, keeps the typed text and saves again on retry', async () => {
    const outcomes = [deferred(), deferred()]
    const { autosave, saves, state } = setup(() => outcomes[saves.length - 1].promise)
    autosave.change({ sets: '4' })
    autosave.blur()
    outcomes[0].reject(new Error('offline'))
    await settle()
    expect(state()).toMatchObject({ status: 'failed', failure: 'Salvataggio non riuscito. Riprova.' })
    expect(state().values.sets).toBe('4')

    autosave.blur()
    outcomes[1].resolve()
    await settle()
    expect(saves).toHaveLength(2)
    expect(state()).toMatchObject({ status: 'saved', failure: null })
  })

  it('a new edit clears the failure and is saved on its own', async () => {
    const { autosave, state } = setup(() => Promise.reject(new Error('offline')))
    autosave.change({ sets: '4' })
    autosave.blur()
    await settle()
    expect(state().status).toBe('failed')
    autosave.change({ sets: '5' })
    expect(state()).toMatchObject({ status: 'dirty', failure: null })
  })
})

describe('edits during a save', () => {
  it('never runs two saves at once: the later edit goes out after the first finishes', async () => {
    const first = deferred()
    const { autosave, saves, state } = setup((target) => (target.target_sets === 4 ? first.promise : Promise.resolve()))
    autosave.change({ sets: '4' })
    autosave.blur()
    autosave.change({ sets: '6' })
    autosave.blur()
    await settle()
    expect(saves.map((target) => target.target_sets)).toEqual([4])
    expect(state().status).toBe('dirty')

    first.resolve()
    await settle()
    expect(saves.map((target) => target.target_sets)).toEqual([4, 6])
    expect(state().status).toBe('saved')
  })
})

describe('leaving the screen', () => {
  it('flush sends a pending edit at once', async () => {
    const { autosave, saves } = setup()
    autosave.change({ reps: '12' })
    autosave.flush()
    await settle()
    expect(saves).toEqual([{ ...stored, target_reps: 12 }])
  })

  it('flush with nothing pending sends nothing', async () => {
    const { autosave, saves } = setup()
    autosave.flush()
    await settle()
    expect(saves).toEqual([])
  })
})

it('tells subscribers about every change, and stops after unsubscribe', () => {
  const { autosave } = setup()
  const listener = vi.fn()
  const unsubscribe = autosave.subscribe(listener)
  autosave.change({ sets: '4' })
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  autosave.change({ sets: '5' })
  expect(listener).toHaveBeenCalledTimes(1)
})
