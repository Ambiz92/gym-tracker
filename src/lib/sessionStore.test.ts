import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DRAFT_STORAGE_KEY, loadDraft, type StorageLike } from './sessionDraft'
import { SessionStore, type SessionApi, type SetInput, type StoreEnv } from './sessionStore'

const session = { id: 's1', name: 'Upper' }
const input = (exerciseId = 'e1', weightKg = 20): SetInput => ({ exerciseId, reps: 8, weightKg, equipment: 'barbell' })

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {}
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

interface Fake {
  api: { [K in keyof SessionApi]: ReturnType<typeof vi.fn> }
  storage: ReturnType<typeof memoryStorage>
  env: StoreEnv
}

function fake(): Fake {
  const api = {
    createWorkout: vi.fn(() => Promise.resolve({})),
    logSet: vi.fn(() => Promise.resolve({})),
    deleteSet: vi.fn(() => Promise.resolve()),
    saveNotes: vi.fn(() => Promise.resolve()),
    deleteWorkout: vi.fn(() => Promise.resolve()),
  }
  const storage = memoryStorage()
  let counter = 0
  const env: StoreEnv = {
    api,
    storage,
    uuid: () => `id-${++counter}`,
    today: () => '2026-11-17',
    now: () => 5000,
  }
  return { api, storage, env }
}

const offline = () => Promise.reject(new Error('offline'))

let f: Fake
beforeEach(() => {
  f = fake()
})

describe('confirming sets', () => {
  it('opens the draft with the local date and a client id, creates the workout once, then sends the set', async () => {
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    expect(await store.flush()).toBe(true)

    expect(f.api.createWorkout).toHaveBeenCalledTimes(1)
    expect(f.api.createWorkout).toHaveBeenCalledWith({ id: 'id-1', date: '2026-11-17', sessionId: 's1', sessionName: 'Upper' })
    expect(f.api.logSet).toHaveBeenCalledWith({
      id: set.id,
      workout_id: 'id-1',
      exercise_id: 'e1',
      set_number: 1,
      reps: 8,
      weight_kg: 20,
      equipment_used: 'barbell',
    })
    expect(store.getSnapshot().draft?.sets[0]?.sync).toBe('synced')
    expect(store.getSnapshot().draft?.workoutSynced).toBe(true)
  })

  it('numbers sets per exercise and sends them in order', async () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input('e1'))
    store.confirmSet(session, input('e1'))
    store.confirmSet(session, input('e2'))
    await store.flush()
    expect(f.api.logSet.mock.calls.map(([call]) => [call.exercise_id, call.set_number])).toEqual([
      ['e1', 1],
      ['e1', 2],
      ['e2', 1],
    ])
    expect(f.api.createWorkout).toHaveBeenCalledTimes(1)
  })

  it('refuses to mix two sessions in one draft', () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    expect(() => store.confirmSet({ id: 's2', name: 'Lower' }, input())).toThrow()
  })

  it('persists the draft before the server answers', () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    expect(loadDraft(f.storage)?.sets).toHaveLength(1)
  })
})

describe('retry queue', () => {
  it('keeps every set when sending fails and flags the failure', async () => {
    f.api.createWorkout.mockImplementation(offline)
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    store.confirmSet(session, input())

    expect(await store.flush()).toBe(false)
    const state = store.getSnapshot()
    expect(state.failed).toBe(true)
    expect(state.syncing).toBe(false)
    expect(state.draft?.sets.map((s) => s.sync)).toEqual(['pending', 'pending'])
    expect(f.api.logSet).not.toHaveBeenCalled()
  })

  it('resends the leftovers after a failure, reusing the same ids', async () => {
    f.api.logSet.mockImplementationOnce(() => Promise.resolve({})).mockImplementationOnce(offline)
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    store.confirmSet(session, input())
    expect(await store.flush()).toBe(false)
    expect(store.getSnapshot().draft?.sets.map((s) => s.sync)).toEqual(['synced', 'pending'])

    expect(await store.flush()).toBe(true)
    expect(store.getSnapshot().failed).toBe(false)
    const ids = f.api.logSet.mock.calls.map(([call]) => call.id)
    expect(ids).toEqual([ids[0], ids[1], ids[1]])
    expect(f.api.createWorkout).toHaveBeenCalledTimes(1)
  })

  it('restores unsent sets from storage after a reload and sends them', async () => {
    f.api.createWorkout.mockImplementation(offline)
    const first = new SessionStore(f.env)
    first.confirmSet(session, input())
    await first.flush()

    f.api.createWorkout.mockImplementation(() => Promise.resolve({}))
    const reloaded = new SessionStore(f.env)
    expect(reloaded.getSnapshot().draft?.sets).toHaveLength(1)
    expect(await reloaded.flush()).toBe(true)
    expect(f.api.createWorkout).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'id-1' }))
    expect(reloaded.getSnapshot().draft?.sets[0]?.sync).toBe('synced')
  })

  it('sends a set confirmed while a request is in flight in the same run', async () => {
    let release = () => {}
    f.api.createWorkout.mockImplementation(() => new Promise((resolve) => (release = () => resolve({}))))
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    await Promise.resolve()
    store.confirmSet(session, input())
    release()
    await store.flush()
    await store.flush()
    expect(f.api.logSet).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().draft?.sets.map((s) => s.sync)).toEqual(['synced', 'synced'])
  })

  it('notifies subscribers and stops after unsubscribing', async () => {
    const store = new SessionStore(f.env)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.confirmSet(session, input())
    await store.flush()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    store.setCurrentExercise('e9')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('undo', () => {
  it('forgets a set the server never saw without any request', async () => {
    f.api.createWorkout.mockImplementation(offline)
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    expect(store.undoSet(set.id)).toMatchObject({ id: set.id, weightKg: 20 })
    await store.flush()
    expect(store.getSnapshot().draft).toBeNull()
    expect(f.storage.data[DRAFT_STORAGE_KEY]).toBeUndefined()
    expect(f.api.deleteSet).not.toHaveBeenCalled()
  })

  it('deletes a synced set on the server', async () => {
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    await store.flush()
    store.undoSet(set.id)
    await store.flush()
    expect(f.api.deleteSet).toHaveBeenCalledWith(set.id)
    expect(store.getSnapshot().draft?.sets).toEqual([])
  })

  it('keeps the removal queued when the delete fails', async () => {
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    await store.flush()
    f.api.deleteSet.mockImplementationOnce(offline)
    store.undoSet(set.id)
    expect(await store.flush()).toBe(false)
    expect(store.getSnapshot().draft?.sets[0]?.sync).toBe('removed')
    expect(await store.flush()).toBe(true)
    expect(store.getSnapshot().draft?.sets).toEqual([])
  })

  it('reuses the number of the undone set', async () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    const second = store.confirmSet(session, input())
    await store.flush()
    store.undoSet(second.id)
    const again = store.confirmSet(session, input())
    expect(again.setNumber).toBe(2)
  })

  it('ignores an unknown or already undone set', async () => {
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    await store.flush()
    expect(store.undoSet('nope')).toBeUndefined()
    store.undoSet(set.id)
    expect(store.undoSet(set.id)).toBeUndefined()
  })
})

describe('finish', () => {
  it('sends the leftovers, stores the trimmed note and clears the draft', async () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    expect(await store.finish('  buona  ')).toBe(true)
    expect(f.api.logSet).toHaveBeenCalledTimes(1)
    expect(f.api.saveNotes).toHaveBeenCalledWith('id-1', 'buona')
    expect(store.getSnapshot().draft).toBeNull()
    expect(f.storage.data[DRAFT_STORAGE_KEY]).toBeUndefined()
  })

  it('skips an empty note', async () => {
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    await store.finish('   ')
    expect(f.api.saveNotes).not.toHaveBeenCalled()
  })

  it('keeps the draft when sets could not be sent', async () => {
    f.api.logSet.mockImplementation(offline)
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    expect(await store.finish('')).toBe(false)
    expect(store.getSnapshot().draft?.sets).toHaveLength(1)
    expect(store.getSnapshot().failed).toBe(true)
  })

  it('keeps the draft when the note could not be saved, and can be retried', async () => {
    f.api.saveNotes.mockImplementationOnce(offline)
    const store = new SessionStore(f.env)
    store.confirmSet(session, input())
    expect(await store.finish('ok')).toBe(false)
    expect(store.getSnapshot().draft).not.toBeNull()
    expect(await store.finish('ok')).toBe(true)
    expect(store.getSnapshot().draft).toBeNull()
  })

  it('deletes the workout of a session whose sets were all undone', async () => {
    const store = new SessionStore(f.env)
    const set = store.confirmSet(session, input())
    await store.flush()
    store.undoSet(set.id)
    expect(await store.finish('x')).toBe(true)
    expect(f.api.deleteWorkout).toHaveBeenCalledWith('id-1')
    expect(f.api.saveNotes).not.toHaveBeenCalled()
  })

  it('is a no-op without a draft', async () => {
    expect(await new SessionStore(f.env).finish('')).toBe(true)
  })
})

it('remembers the current exercise in the draft', async () => {
  const store = new SessionStore(f.env)
  store.setCurrentExercise('e1')
  expect(store.getSnapshot().draft).toBeNull()
  store.confirmSet(session, input())
  store.setCurrentExercise('e1')
  expect(loadDraft(f.storage)?.currentExerciseId).toBe('e1')
  await store.flush()
})
