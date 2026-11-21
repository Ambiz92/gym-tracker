import type { Equipment, SetLogInsert } from '../types/db'
import {
  ackSet,
  ackWorkout,
  activeSets,
  addSet,
  dropSet,
  loadDraft,
  newDraft,
  nextOperation,
  nextSetNumber,
  removeSet,
  saveDraft,
  unsyncedCount,
  withCurrentExercise,
  type Draft,
  type DraftSet,
  type Operation,
  type StorageLike,
} from './sessionDraft'

/** The server calls the store needs; wired to the data layer by the page layer. */
export interface SessionApi {
  createWorkout(workout: { id: string; date: string; sessionId: string; sessionName: string }): Promise<unknown>
  logSet(set: SetLogInsert): Promise<unknown>
  deleteSet(setId: string): Promise<void>
  saveNotes(workoutId: string, notes: string): Promise<void>
  deleteWorkout(workoutId: string): Promise<void>
  /** Marks the calendar slot done once its workout exists; may reject, the store never waits for it. */
  linkSlot(slotId: string, workoutId: string): Promise<unknown>
  /** Puts the slot back to planned when its workout is discarded; must run before the workout is deleted. May reject, the store tolerates it. */
  unlinkSlot(slotId: string, workoutId: string): Promise<unknown>
}

export interface StoreEnv {
  api: SessionApi
  storage: StorageLike | null
  uuid(): string
  /** Local calendar date YYYY-MM-DD. */
  today(): string
  now(): number
  /** A failed slot link or unlink: reading reconciles it (same session and date), so this is only for diagnostics. */
  onLinkError(error: unknown): void
}

export interface StoreState {
  draft: Draft | null
  syncing: boolean
  /** The last send or close attempt failed; cleared by the next attempt. */
  failed: boolean
}

export interface SetInput {
  exerciseId: string
  reps: number
  weightKg: number
  equipment: Equipment
}

/**
 * Holds the open session and sends it to the server. Every confirmed set is saved locally first
 * and stays in the draft until the server acknowledged it, so a failed request never loses a set.
 * Requests run one at a time, in order; calling `flush` again retries whatever is left.
 */
export class SessionStore {
  private state: StoreState
  private readonly listeners = new Set<() => void>()
  private running: Promise<boolean> | null = null
  private rerun = false

  constructor(private readonly env: StoreEnv) {
    this.state = { draft: loadDraft(env.storage), syncing: false, failed: false }
  }

  /** Stable between changes, as `useSyncExternalStore` requires. */
  getSnapshot = (): StoreState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Records a confirmed set, opening the draft (and its workout id) on the first one, and starts
   * sending it; `scheduledId` (the slot it was started from) is kept only when the draft opens. Throws when another session is already open: the UI never offers that.
   */
  confirmSet(session: { id: string; name: string; scheduledId?: string }, input: SetInput): DraftSet {
    let draft = this.state.draft
    if (draft && draft.sessionId !== session.id) throw new Error('Another session is already open')
    draft ??= newDraft({
      workoutId: this.env.uuid(),
      date: this.env.today(),
      sessionId: session.id,
      sessionName: session.name,
      startedAt: this.env.now(),
      scheduledId: session.scheduledId,
    })

    const set = {
      id: this.env.uuid(),
      exerciseId: input.exerciseId,
      setNumber: nextSetNumber(draft, input.exerciseId),
      reps: input.reps,
      weightKg: input.weightKg,
      equipment: input.equipment,
    }
    this.setDraft(addSet(draft, set))
    void this.flush()
    return { ...set, sync: 'pending' }
  }

  /** Undo of a confirmed set; returns it so the UI can restore its values. */
  undoSet(setId: string): DraftSet | undefined {
    const draft = this.state.draft
    const set = draft?.sets.find((candidate) => candidate.id === setId && candidate.sync !== 'removed')
    if (!draft || !set) return undefined

    const next = removeSet(draft, setId)
    this.setDraft(next.sets.length === 0 && !next.workoutSynced ? null : next)
    void this.flush()
    return set
  }

  setCurrentExercise(exerciseId: string | null): void {
    const draft = this.state.draft
    if (!draft || draft.currentExerciseId === exerciseId) return
    this.setDraft(withCurrentExercise(draft, exerciseId))
  }

  /** Sends what is left. Resolves true when everything is acknowledged, false when a request failed. */
  flush(): Promise<boolean> {
    if (this.running) {
      this.rerun = true
      return this.running
    }
    this.running = Promise.resolve().then(() => this.drain())
    return this.running
  }

  /**
   * Closes the session: sends the leftovers, stores the note and forgets the draft. A session
   * without any set leaves no workout behind. Returns false (draft kept) when something failed.
   */
  async finish(notes: string): Promise<boolean> {
    const flushed = await this.flush()
    const draft = this.state.draft
    if (!draft) return true
    if (!flushed || unsyncedCount(draft) > 0) return false

    try {
      if (activeSets(draft).length === 0) {
        const { scheduledId, workoutId } = draft
        if (draft.workoutSynced) {
          if (scheduledId) await this.tolerate(() => this.env.api.unlinkSlot(scheduledId, workoutId))
          await this.env.api.deleteWorkout(workoutId)
        }
      } else if (notes.trim()) {
        await this.env.api.saveNotes(draft.workoutId, notes.trim())
      }
    } catch {
      this.patch({ failed: true })
      return false
    }
    this.setDraft(null)
    return true
  }

  private async drain(): Promise<boolean> {
    this.patch({ syncing: true, failed: false })
    try {
      do {
        this.rerun = false
        await this.sendAll()
      } while (this.rerun)
      return true
    } catch {
      this.patch({ failed: true })
      return false
    } finally {
      this.running = null
      this.patch({ syncing: false })
    }
  }

  /** Re-reads the draft after every request, so sets confirmed meanwhile are sent in the same run. */
  private async sendAll(): Promise<void> {
    for (;;) {
      const draft = this.state.draft
      const operation = draft && nextOperation(draft)
      if (!draft || !operation) return
      await this.perform(draft, operation)
    }
  }

  private async perform(draft: Draft, operation: Operation): Promise<void> {
    const { api } = this.env
    const { workoutId } = draft
    if (operation.kind === 'workout') {
      await api.createWorkout({
        id: workoutId,
        date: draft.date,
        sessionId: draft.sessionId,
        sessionName: draft.sessionName,
      })
      this.apply(workoutId, ackWorkout)
      if (draft.scheduledId) this.linkSlot(draft.scheduledId, workoutId)
    } else if (operation.kind === 'log') {
      const { set } = operation
      await api.logSet({
        id: set.id,
        workout_id: workoutId,
        exercise_id: set.exerciseId,
        set_number: set.setNumber,
        reps: set.reps,
        weight_kg: set.weightKg,
        equipment_used: set.equipment,
      })
      this.apply(workoutId, (current) => ackSet(current, set.id))
    } else {
      await api.deleteSet(operation.set.id)
      this.apply(workoutId, (current) => dropSet(current, operation.set.id))
    }
  }

  /** Fire and forget: saving sets never waits for, or fails because of, the calendar. */
  private linkSlot(slotId: string, workoutId: string): void {
    void this.tolerate(() => this.env.api.linkSlot(slotId, workoutId))
  }

  /** Runs a calendar call whose failure must not matter: it is only reported, and a throwing handler is ignored too. */
  private async tolerate(call: () => Promise<unknown>): Promise<void> {
    try {
      await call()
    } catch (error) {
      try {
        this.env.onLinkError(error)
      } catch {
        // Diagnostics must never break saving.
      }
    }
  }

  /** Applies an acknowledgement to the draft it belongs to; a draft closed meanwhile is left alone. */
  private apply(workoutId: string, change: (draft: Draft) => Draft): void {
    const draft = this.state.draft
    if (draft?.workoutId === workoutId) this.setDraft(change(draft))
  }

  private setDraft(draft: Draft | null): void {
    saveDraft(this.env.storage, draft)
    this.patch({ draft })
  }

  private patch(change: Partial<StoreState>): void {
    const next = { ...this.state, ...change }
    if (next.draft === this.state.draft && next.syncing === this.state.syncing && next.failed === this.state.failed) return
    this.state = next
    this.listeners.forEach((listener) => listener())
  }
}
