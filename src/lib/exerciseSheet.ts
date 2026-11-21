import type { CatalogExercise, Exercise, ExerciseInsert } from '../types/db'
import { defaultTarget, type PlanTarget } from './planForm'

export type SheetAction = 'add' | 'remove' | 'create' | 'adopt'

/** An exercise already in the session when the sheet opens. */
export interface SheetRow {
  rowId: string
  exerciseId: string
  target: PlanTarget
}

interface SheetDeps {
  /** Stores the exercise in the session with `target`; the caller also updates its copy of the session. */
  add: (exercise: Exercise, target: PlanTarget) => Promise<{ rowId: string }>
  remove: (rowId: string) => Promise<void>
  /** Stores a new library exercise. */
  create: (values: ExerciseInsert) => Promise<Exercise>
  /** Copies a catalog entry into the library (the same copy again when it is already there). */
  adopt: (entry: CatalogExercise) => Promise<Exercise>
  /** A new library exercise exists: the list the sheet shows must include it. */
  onCreated: (exercise: Exercise) => void
  describeFailure: (cause: unknown, action: SheetAction) => string
}

export interface SheetSnapshot {
  /** Exercises shown as added: a tap is shown at once, before the request ends. */
  added: ReadonlySet<string>
  /** Exercises with a request in flight: tapping them again does nothing. */
  busy: ReadonlySet<string>
  /** Exercises added since the sheet opened and still in the session. */
  addedCount: number
  /** A "create and add" or "adopt and add" request is in flight. */
  creating: boolean
  failure: string | null
}

/**
 * The state behind the "add exercises" sheet: tapping an exercise adds it to the session, tapping it
 * again removes it, and an exercise removed and re-added while the sheet stays open comes back with the
 * values the user had typed. Requests run one after another (rows get their position from the last one).
 * Plugs into React through `subscribe` / `getSnapshot` (useSyncExternalStore).
 */
export class SheetController {
  private snapshot: SheetSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly rows = new Map<string, SheetRow>()
  private readonly opening: ReadonlySet<string>
  /** Targets of exercises taken out during this sheet, to restore them on a re-add. */
  private readonly stash = new Map<string, PlanTarget>()
  private tail: Promise<void> = Promise.resolve()
  /** A library exercise whose creation succeeded but whose add did not, kept so a retry only adds. */
  private created: { fingerprint: string; exercise: Exercise } | null = null

  constructor(
    initial: readonly SheetRow[],
    private readonly deps: SheetDeps,
  ) {
    for (const row of initial) this.rows.set(row.exerciseId, row)
    this.opening = new Set(this.rows.keys())
    this.snapshot = { added: new Set(this.rows.keys()), busy: new Set(), addedCount: 0, creating: false, failure: null }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): SheetSnapshot => this.snapshot

  /** Adds the exercise to the session, or removes it when it is already there. */
  async toggle(exercise: Exercise): Promise<void> {
    const { id } = exercise
    if (this.snapshot.busy.has(id)) return
    const row = this.rows.get(id)
    try {
      await this.run(id, !row, row ? () => this.takeOut(row) : () => this.putIn(exercise))
    } catch (cause) {
      console.error(cause)
      this.update({ failure: this.deps.describeFailure(cause, row ? 'remove' : 'add') })
    }
  }

  /**
   * Creates a library exercise and adds it to the session. Resolves true when both happened. When the
   * creation worked but the add did not, a retry with the same values only repeats the add.
   */
  createAndAdd(values: ExerciseInsert): Promise<boolean> {
    return this.makeAndAdd(JSON.stringify(values), 'create', () => this.deps.create(values))
  }

  /** Copies a catalog entry into the library and adds the copy to the session; same contract as `createAndAdd`. */
  adoptAndAdd(entry: CatalogExercise): Promise<boolean> {
    return this.makeAndAdd(`catalog:${entry.id}`, 'adopt', () => this.deps.adopt(entry))
  }

  private async makeAndAdd(fingerprint: string, makeAction: 'create' | 'adopt', make: () => Promise<Exercise>): Promise<boolean> {
    if (this.snapshot.creating) return false
    this.update({ creating: true, failure: null })
    let action: SheetAction = makeAction
    try {
      let exercise = this.created?.fingerprint === fingerprint ? this.created.exercise : null
      if (!exercise) {
        exercise = await make()
        this.created = { fingerprint, exercise }
        this.deps.onCreated(exercise)
      }
      action = 'add'
      const added = exercise
      if (!this.rows.has(added.id)) await this.run(added.id, true, () => this.putIn(added))
      this.created = null
      this.update({ creating: false })
      return true
    } catch (cause) {
      console.error(cause)
      this.update({ creating: false, failure: this.deps.describeFailure(cause, action) })
      return false
    }
  }

  /** Shows the wanted state at once, runs the request, and puts the old state back if it fails (rethrowing). */
  private async run(id: string, wanted: boolean, job: () => Promise<void>): Promise<void> {
    this.show(id, wanted, true, null)
    try {
      await this.enqueue(job)
    } catch (cause) {
      this.show(id, !wanted, false)
      throw cause
    }
    this.show(id, wanted, false)
  }

  private async putIn(exercise: Exercise): Promise<void> {
    const target = this.stash.get(exercise.id) ?? defaultTarget(exercise)
    const { rowId } = await this.deps.add(exercise, target)
    this.stash.delete(exercise.id)
    this.rows.set(exercise.id, { rowId, exerciseId: exercise.id, target })
  }

  private async takeOut(row: SheetRow): Promise<void> {
    await this.deps.remove(row.rowId)
    this.stash.set(row.exerciseId, row.target)
    this.rows.delete(row.exerciseId)
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.tail.then(job)
    this.tail = run.catch(() => undefined)
    return run
  }

  /** Marks the exercise as added or not, with a request in flight or not, and recounts. */
  private show(id: string, added: boolean, busy: boolean, failure = this.snapshot.failure): void {
    const addedIds = new Set(this.snapshot.added)
    const busyIds = new Set(this.snapshot.busy)
    if (added) addedIds.add(id)
    else addedIds.delete(id)
    if (busy) busyIds.add(id)
    else busyIds.delete(id)
    const addedCount = [...addedIds].filter((exerciseId) => !this.opening.has(exerciseId)).length
    this.update({ added: addedIds, busy: busyIds, addedCount, failure })
  }

  private update(patch: Partial<SheetSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}
