import { describe, expect, it } from 'vitest'
import {
  DRAFT_STORAGE_KEY,
  ackSet,
  ackWorkout,
  activeSets,
  addSet,
  dropSet,
  isLinkableSlot,
  loadDraft,
  newDraft,
  nextOperation,
  nextSetNumber,
  removeSet,
  saveDraft,
  setsOf,
  unsyncedCount,
  withCurrentExercise,
  type Draft,
  type DraftSet,
  type StorageLike,
} from './sessionDraft'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const draft0: Draft = newDraft({ workoutId: 'w1', date: '2026-11-17', sessionId: 's1', sessionName: 'Upper', startedAt: 1000 })
const set = (id: string, setNumber: number, exerciseId = 'e1'): Omit<DraftSet, 'sync'> => ({
  id,
  exerciseId,
  setNumber,
  reps: 8,
  weightKg: 20,
  equipment: 'barbell',
})

describe('draft transitions', () => {
  it('adds sets as pending and numbers the next set per exercise', () => {
    const draft = addSet(addSet(draft0, set('a', 1)), set('b', 1, 'e2'))
    expect(draft.sets.map((s) => s.sync)).toEqual(['pending', 'pending'])
    expect(nextSetNumber(draft, 'e1')).toBe(2)
    expect(nextSetNumber(draft, 'e2')).toBe(2)
    expect(nextSetNumber(draft, 'e3')).toBe(1)
  })

  it('drops an undone set at once while the workout is unknown to the server', () => {
    const draft = removeSet(addSet(draft0, set('a', 1)), 'a')
    expect(draft.sets).toEqual([])
  })

  it('only marks an undone set once the workout exists, since a request may be in flight', () => {
    const draft = removeSet(addSet(ackWorkout(draft0), set('a', 1)), 'a')
    expect(draft.sets).toEqual([expect.objectContaining({ id: 'a', sync: 'removed' })])
    expect(activeSets(draft)).toEqual([])
    expect(nextSetNumber(draft, 'e1')).toBe(1)
  })

  it('does not resurrect a removed set when its late acknowledgement arrives', () => {
    const removed = removeSet(addSet(ackWorkout(draft0), set('a', 1)), 'a')
    expect(ackSet(removed, 'a').sets[0]?.sync).toBe('removed')
  })

  it('lists the sets of one exercise without the removed ones', () => {
    const draft = removeSet(addSet(addSet(ackWorkout(draft0), set('a', 1)), set('b', 2)), 'b')
    expect(setsOf(draft, 'e1').map((s) => s.id)).toEqual(['a'])
  })

  it('counts everything the server has not confirmed', () => {
    let draft = addSet(addSet(ackWorkout(draft0), set('a', 1)), set('b', 2))
    draft = ackSet(draft, 'a')
    expect(unsyncedCount(draft)).toBe(1)
    draft = removeSet(draft, 'a')
    expect(unsyncedCount(draft)).toBe(2)
    expect(unsyncedCount(dropSet(draft, 'a'))).toBe(1)
  })

  it('stores the current exercise', () => {
    expect(withCurrentExercise(draft0, 'e1').currentExerciseId).toBe('e1')
  })
})

describe('nextOperation', () => {
  it('creates the workout before the first set', () => {
    expect(nextOperation(addSet(draft0, set('a', 1)))).toEqual({ kind: 'workout' })
  })

  it('sends pending sets in order, then removals', () => {
    let draft = addSet(addSet(ackWorkout(draft0), set('a', 1)), set('b', 2))
    draft = removeSet(ackSet(draft, 'a'), 'a')
    expect(nextOperation(draft)).toMatchObject({ kind: 'delete', set: { id: 'a' } })
    expect(nextOperation(dropSet(draft, 'a'))).toMatchObject({ kind: 'log', set: { id: 'b' } })
  })

  it('has nothing to do when everything is acknowledged', () => {
    expect(nextOperation(ackSet(addSet(ackWorkout(draft0), set('a', 1)), 'a'))).toBeNull()
    expect(nextOperation(draft0)).toBeNull()
  })
})

describe('persistence', () => {
  it('round-trips a draft through storage', () => {
    const storage = memoryStorage()
    const draft = addSet(draft0, set('a', 1))
    saveDraft(storage, draft)
    expect(loadDraft(storage)).toEqual(draft)
  })

  it('clears the stored draft when saving null', () => {
    const storage = memoryStorage()
    saveDraft(storage, draft0)
    saveDraft(storage, null)
    expect(storage.data[DRAFT_STORAGE_KEY]).toBeUndefined()
  })

  it.each([
    ['no entry', {}],
    ['invalid JSON', { [DRAFT_STORAGE_KEY]: '{oops' }],
    ['a different shape', { [DRAFT_STORAGE_KEY]: JSON.stringify({ workoutId: 1 }) }],
    ['a set with an unknown equipment', { [DRAFT_STORAGE_KEY]: JSON.stringify({ ...addSet(draft0, { ...set('a', 1), equipment: 'kettlebell' as never }) }) }],
  ])('loads nothing from %s', (_label, entries) => {
    expect(loadDraft(memoryStorage(entries))).toBeNull()
  })

  it('round-trips the slot the session was started from', () => {
    const storage = memoryStorage()
    saveDraft(storage, { ...draft0, scheduledId: 'slot-1' })
    expect(loadDraft(storage)?.scheduledId).toBe('slot-1')
  })

  it('loads a draft saved before slots existed', () => {
    const { workoutId, workoutSynced, date, sessionId, sessionName, startedAt, currentExerciseId, sets } = draft0
    const old = { workoutId, workoutSynced, date, sessionId, sessionName, startedAt, currentExerciseId, sets }
    expect(loadDraft(memoryStorage({ [DRAFT_STORAGE_KEY]: JSON.stringify(old) }))).toEqual(draft0)
  })

  it('refuses a draft whose slot id is not a string', () => {
    expect(loadDraft(memoryStorage({ [DRAFT_STORAGE_KEY]: JSON.stringify({ ...draft0, scheduledId: 7 }) }))).toBeNull()
  })

  it('works without storage', () => {
    expect(() => saveDraft(null, draft0)).not.toThrow()
    expect(loadDraft(null)).toBeNull()
  })

  it('survives a storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => saveDraft(broken, draft0)).not.toThrow()
    expect(() => saveDraft(broken, null)).not.toThrow()
    expect(loadDraft(broken)).toBeNull()
  })
})

describe('isLinkableSlot', () => {
  it('accepts a planned slot of the session', () => {
    expect(isLinkableSlot({ status: 'planned', plan_session_id: 's1' }, 's1')).toBe(true)
  })

  it.each([
    ['of another session', { status: 'planned', plan_session_id: 's2' }],
    ['of a deleted session', { status: 'planned', plan_session_id: null }],
    ['done', { status: 'done', plan_session_id: 's1' }],
    ['skipped', { status: 'skipped', plan_session_id: 's1' }],
  ] as const)('refuses a slot %s', (_label, slot) => {
    expect(isLinkableSlot(slot, 's1')).toBe(false)
  })
})
