import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogExercise, Exercise, ExerciseInsert } from '../types/db'
import { SheetController, type SheetRow } from './exerciseSheet'
import type { PlanTarget } from './planForm'

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

const defaults: PlanTarget = {
  target_sets: 3,
  target_reps: 8,
  target_unit: 'reps',
  suggested_weight_kg: null,
  suggested_weight_max_kg: null,
}

/** A promise the test settles by hand, to hold a request in flight. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface Calls {
  adds: { exerciseId: string; target: PlanTarget }[]
  removes: string[]
  creates: ExerciseInsert[]
  adopts: string[]
  created: Exercise[]
}

function setup(initial: SheetRow[] = [], overrides: Partial<ConstructorParameters<typeof SheetController>[1]> = {}) {
  const calls: Calls = { adds: [], removes: [], creates: [], adopts: [], created: [] }
  let rowCount = 0
  const sheet = new SheetController(initial, {
    add: async (ex, target) => {
      calls.adds.push({ exerciseId: ex.id, target })
      return { rowId: `row-${++rowCount}` }
    },
    remove: async (rowId) => void calls.removes.push(rowId),
    create: async (values) => {
      calls.creates.push(values)
      return exercise(`new-${calls.creates.length}`, { name: values.name, equipment: values.equipment, starting_weight_kg: values.starting_weight_kg ?? null })
    },
    adopt: async (entry) => {
      calls.adopts.push(entry.id)
      return exercise(`copy-${entry.id}`, { name: entry.name_it, equipment: entry.equipment, catalog_id: entry.id })
    },
    onCreated: (ex) => calls.created.push(ex),
    describeFailure: (_cause, action) => `fallito: ${action}`,
    ...overrides,
  })
  return { sheet, calls, state: () => sheet.getSnapshot() }
}

const failing = () => Promise.reject(new Error('offline'))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('tapping an exercise', () => {
  it('adds it with 3 x 8 reps and the starting weight of the exercise, and counts it', async () => {
    const { sheet, calls, state } = setup()
    await sheet.toggle(exercise('e1', { starting_weight_kg: 20 }))

    expect(calls.adds).toEqual([{ exerciseId: 'e1', target: { ...defaults, suggested_weight_kg: 20 } }])
    expect(state().added.has('e1')).toBe(true)
    expect(state().addedCount).toBe(1)
  })

  it('has no weight to prefill when the exercise has no starting weight', async () => {
    const { sheet, calls } = setup()
    await sheet.toggle(exercise('e1'))
    expect(calls.adds[0].target.suggested_weight_kg).toBeNull()
  })

  it('shows the exercise as added before the request ends, and ignores a second tap meanwhile', async () => {
    const hold = deferred<{ rowId: string }>()
    const adds: string[] = []
    const { sheet, state } = setup([], {
      add: (ex) => {
        adds.push(ex.id)
        return hold.promise
      },
    })
    const pending = sheet.toggle(exercise('e1'))
    expect(state().added.has('e1')).toBe(true)
    expect(state().busy.has('e1')).toBe(true)

    await sheet.toggle(exercise('e1'))
    expect(adds).toEqual(['e1'])

    hold.resolve({ rowId: 'row-1' })
    await pending
    expect(state().busy.has('e1')).toBe(false)
  })

  it('removes an exercise that is already in the session, by its row', async () => {
    const row: SheetRow = { rowId: 'r1', exerciseId: 'e1', target: defaults }
    const { sheet, calls, state } = setup([row])
    expect(state().added.has('e1')).toBe(true)

    await sheet.toggle(exercise('e1'))
    expect(calls.removes).toEqual(['r1'])
    expect(state().added.has('e1')).toBe(false)
  })

  it('does not count the exercises that were already there when the sheet opened', async () => {
    const { sheet, state } = setup([{ rowId: 'r1', exerciseId: 'e1', target: defaults }])
    expect(state().addedCount).toBe(0)
    await sheet.toggle(exercise('e2'))
    expect(state().addedCount).toBe(1)
    await sheet.toggle(exercise('e1'))
    expect(state().addedCount).toBe(1)
    await sheet.toggle(exercise('e2'))
    expect(state().addedCount).toBe(0)
  })
})

describe('removing and adding back in the same open sheet', () => {
  it('restores the values the user had typed', async () => {
    const typed: PlanTarget = { target_sets: 5, target_reps: 12, target_unit: 'seconds', suggested_weight_kg: 32.5, suggested_weight_max_kg: 35 }
    const { sheet, calls } = setup([{ rowId: 'r1', exerciseId: 'e1', target: typed }])
    await sheet.toggle(exercise('e1'))
    await sheet.toggle(exercise('e1'))
    expect(calls.adds).toEqual([{ exerciseId: 'e1', target: typed }])
  })

  it('restores the values of an exercise added in this sheet too', async () => {
    const { sheet, calls } = setup()
    await sheet.toggle(exercise('e1', { starting_weight_kg: 20 }))
    await sheet.toggle(exercise('e1'))
    await sheet.toggle(exercise('e1'))
    expect(calls.adds).toHaveLength(2)
    expect(calls.adds[1].target).toEqual(calls.adds[0].target)
  })

  it('starts from the defaults again in a new sheet', async () => {
    const first = setup([{ rowId: 'r1', exerciseId: 'e1', target: { ...defaults, target_sets: 5 } }])
    await first.sheet.toggle(exercise('e1'))
    const second = setup()
    await second.sheet.toggle(exercise('e1'))
    expect(second.calls.adds[0].target.target_sets).toBe(3)
  })
})

describe('several taps in a row', () => {
  it('sends the requests one after another, never together', async () => {
    const first = deferred<{ rowId: string }>()
    let running = 0
    let peak = 0
    const order: string[] = []
    const { sheet } = setup([], {
      add: async (ex) => {
        running++
        peak = Math.max(peak, running)
        order.push(ex.id)
        if (ex.id === 'e1') await first.promise
        running--
        return { rowId: `row-${ex.id}` }
      },
    })
    const taps = [sheet.toggle(exercise('e1')), sheet.toggle(exercise('e2')), sheet.toggle(exercise('e3'))]
    await Promise.resolve()
    expect(order).toEqual(['e1'])

    first.resolve({ rowId: 'row-e1' })
    await Promise.all(taps)
    expect(order).toEqual(['e1', 'e2', 'e3'])
    expect(peak).toBe(1)
  })

  it('goes on after a request failed', async () => {
    let calls = 0
    const { sheet, state } = setup([], {
      add: async (ex) => {
        if (calls++ === 0) throw new Error('offline')
        return { rowId: `row-${ex.id}` }
      },
    })
    await Promise.all([sheet.toggle(exercise('e1')), sheet.toggle(exercise('e2'))])
    expect([...state().added]).toEqual(['e2'])
  })
})

describe('a failed request', () => {
  it('puts a failed add back and says what failed, then a new tap tries again', async () => {
    let fail = true
    const { sheet, state } = setup([], { add: async () => (fail ? failing() : { rowId: 'row-1' }) })
    await sheet.toggle(exercise('e1'))
    expect(state().added.has('e1')).toBe(false)
    expect(state().failure).toBe('fallito: add')
    expect(state().addedCount).toBe(0)

    fail = false
    await sheet.toggle(exercise('e1'))
    expect(state().added.has('e1')).toBe(true)
    expect(state().failure).toBeNull()
  })

  it('keeps an exercise in the session when its removal failed, and keeps its values for later', async () => {
    const typed = { ...defaults, target_sets: 5 }
    let fail = true
    const { sheet, state, calls } = setup([{ rowId: 'r1', exerciseId: 'e1', target: typed }], {
      remove: async () => (fail ? failing() : undefined),
    })
    await sheet.toggle(exercise('e1'))
    expect(state().added.has('e1')).toBe(true)
    expect(state().failure).toBe('fallito: remove')

    fail = false
    await sheet.toggle(exercise('e1'))
    await sheet.toggle(exercise('e1'))
    expect(calls.adds[0].target).toEqual(typed)
  })
})

describe('creating an exercise and adding it', () => {
  const values: ExerciseInsert = { name: 'Curl a martello', equipment: 'dumbbell', starting_weight_kg: 12 }

  it('creates it in the library and adds it to the session in one action', async () => {
    const { sheet, calls, state } = setup()
    expect(await sheet.createAndAdd(values)).toBe(true)

    expect(calls.creates).toEqual([values])
    expect(calls.created.map((ex) => ex.id)).toEqual(['new-1'])
    expect(calls.adds).toEqual([{ exerciseId: 'new-1', target: { ...defaults, suggested_weight_kg: 12 } }])
    expect(state()).toMatchObject({ creating: false, failure: null, addedCount: 1 })
    expect(state().added.has('new-1')).toBe(true)
  })

  it('does not create twice when the add failed and the user tries again', async () => {
    let failAdd = true
    const { sheet, calls, state } = setup([], { add: async (ex) => (failAdd ? failing() : { rowId: `row-${ex.id}` }) })
    expect(await sheet.createAndAdd(values)).toBe(false)
    expect(state().failure).toBe('fallito: add')
    expect(state().added.has('new-1')).toBe(false)

    failAdd = false
    expect(await sheet.createAndAdd(values)).toBe(true)
    expect(calls.creates).toHaveLength(1)
    expect(state().added.has('new-1')).toBe(true)
  })

  it('creates a new exercise when the user changed the values after a failed add', async () => {
    let failAdd = true
    const { sheet, calls } = setup([], { add: async (ex) => (failAdd ? failing() : { rowId: `row-${ex.id}` }) })
    await sheet.createAndAdd(values)
    failAdd = false
    await sheet.createAndAdd({ ...values, name: 'Curl a martello alternato' })
    expect(calls.creates).toHaveLength(2)
  })

  it('creates it again only once the first one was added: a later same-name exercise is a new one', async () => {
    const { sheet, calls } = setup()
    await sheet.createAndAdd(values)
    await sheet.createAndAdd(values)
    expect(calls.creates).toHaveLength(2)
  })

  it('adds nothing and says so when the creation fails, keeping nothing to retry', async () => {
    let fail = true
    const { sheet, calls, state } = setup([], {
      create: async (v) => (fail ? failing() : exercise('new-1', { name: v.name })),
    })
    expect(await sheet.createAndAdd(values)).toBe(false)
    expect(state().failure).toBe('fallito: create')
    expect(calls.adds).toEqual([])

    fail = false
    expect(await sheet.createAndAdd(values)).toBe(true)
    expect(calls.adds).toHaveLength(1)
  })

  it('does not add the exercise a second time when the user tapped it in the list meanwhile', async () => {
    let failAdd = true
    const { sheet, calls } = setup([], { add: async (ex) => (failAdd ? failing() : { rowId: `row-${ex.id}` }) })
    await sheet.createAndAdd(values)
    failAdd = false
    await sheet.toggle(exercise('new-1'))
    const addsBefore = calls.adds.length
    expect(await sheet.createAndAdd(values)).toBe(true)
    expect(calls.adds).toHaveLength(addsBefore)
  })

  it('ignores a second submit while one is in flight', async () => {
    const hold = deferred<Exercise>()
    const creates: ExerciseInsert[] = []
    const { sheet } = setup([], {
      create: (v) => {
        creates.push(v)
        return hold.promise
      },
    })
    const first = sheet.createAndAdd(values)
    expect(await sheet.createAndAdd(values)).toBe(false)
    hold.resolve(exercise('new-1'))
    await first
    expect(creates).toHaveLength(1)
  })
})

describe('adopting a catalog entry and adding it', () => {
  const entry: CatalogExercise = {
    id: 'c1',
    slug: 'curl-a-martello',
    name_it: 'Curl a martello',
    name_en: 'Hammer curl',
    synonyms: [],
    equipment: 'dumbbell',
    primary_muscle: 'Bicipiti',
    secondary_muscles: [],
    execution_steps: null,
    source: 'test',
    source_id: '1',
  }

  it('copies the entry into the library and adds the copy to the session in one action', async () => {
    const { sheet, calls, state } = setup()
    expect(await sheet.adoptAndAdd(entry)).toBe(true)

    expect(calls.adopts).toEqual(['c1'])
    expect(calls.created.map((ex) => ex.id)).toEqual(['copy-c1'])
    expect(calls.adds.map((add) => add.exerciseId)).toEqual(['copy-c1'])
    expect(state()).toMatchObject({ creating: false, failure: null, addedCount: 1 })
    expect(state().added.has('copy-c1')).toBe(true)
  })

  it('does not copy twice when the add failed and the user taps the entry again', async () => {
    let failAdd = true
    const { sheet, calls, state } = setup([], { add: async (ex) => (failAdd ? failing() : { rowId: `row-${ex.id}` }) })
    expect(await sheet.adoptAndAdd(entry)).toBe(false)
    expect(state().failure).toBe('fallito: add')

    failAdd = false
    expect(await sheet.adoptAndAdd(entry)).toBe(true)
    expect(calls.adopts).toHaveLength(1)
  })

  it('adds nothing and reports an adopt failure when the copy fails', async () => {
    const { sheet, calls, state } = setup([], { adopt: () => failing() })
    expect(await sheet.adoptAndAdd(entry)).toBe(false)
    expect(state().failure).toBe('fallito: adopt')
    expect(calls.adds).toEqual([])
    expect(state().creating).toBe(false)
  })

  it('ignores a second tap while the first one is in flight', async () => {
    const hold = deferred<Exercise>()
    const adopts: string[] = []
    const { sheet } = setup([], {
      adopt: (e) => {
        adopts.push(e.id)
        return hold.promise
      },
    })
    const first = sheet.adoptAndAdd(entry)
    expect(await sheet.adoptAndAdd({ ...entry, id: 'c2' })).toBe(false)
    hold.resolve(exercise('copy-c1'))
    await first
    expect(adopts).toEqual(['c1'])
  })
})

it('tells subscribers about each change', async () => {
  const { sheet } = setup()
  const listener = vi.fn()
  sheet.subscribe(listener)
  await sheet.toggle(exercise('e1'))
  expect(listener).toHaveBeenCalled()
})
