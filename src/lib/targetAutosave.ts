import type { Equipment } from '../types/db'
import { validateTargetForm, type PlanTarget, type TargetFormErrors, type TargetFormValues } from './planForm'

export const AUTOSAVE_DELAY_MS = 400

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed'

export interface AutosaveSnapshot {
  /** The typed text of the row's fields. */
  values: TargetFormValues
  /** Field errors: shown once the user leaves the row, never while typing. */
  errors: TargetFormErrors
  status: SaveStatus
  /** Message of the last failed save while `status` is 'failed'. */
  failure: string | null
}

interface AutosaveDeps {
  /** Of the exercise: a barbell weight is typed per side and saved as the total of both. */
  equipment: Equipment
  save: (target: PlanTarget) => Promise<void>
  /** Called with each valid target as its save starts: the screen's copy of the plan follows what the user typed. */
  apply: (target: PlanTarget) => void
  describeFailure: (cause: unknown) => string
}

const targetKey = (target: PlanTarget): string => JSON.stringify(target)

/**
 * Autosave of the target of one plan exercise: valid values are saved 400 ms after the last keystroke
 * or at once on blur; invalid ones wait and are reported on blur. One save runs at a time and a later
 * edit is saved after it. Plugs into React through `subscribe` / `getSnapshot` (useSyncExternalStore).
 */
export class TargetAutosave {
  private snapshot: AutosaveSnapshot
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving = false
  /** The target known to be in the database, to skip saves that change nothing. */
  private stored: string

  constructor(
    initial: TargetFormValues,
    private readonly deps: AutosaveDeps,
  ) {
    this.snapshot = { values: initial, errors: {}, status: 'idle', failure: null }
    const checked = validateTargetForm(initial, deps.equipment)
    this.stored = checked.ok ? targetKey(checked.target) : ''
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): AutosaveSnapshot => this.snapshot

  /** A field was edited: its old error goes away and the save is scheduled. */
  change(patch: Partial<TargetFormValues>): void {
    const errors = { ...this.snapshot.errors }
    for (const key of Object.keys(patch)) delete errors[key as keyof TargetFormErrors]
    this.update({ values: { ...this.snapshot.values, ...patch }, errors, status: 'dirty', failure: null })
    this.clearTimer()
    this.timer = setTimeout(() => this.run(false), AUTOSAVE_DELAY_MS)
  }

  /** The user left the row's fields: save now, and report what is invalid. Also the retry after a failed save. */
  blur(): void {
    this.run(true)
  }

  /** The row goes away: a pending edit is saved now, nothing is reported. */
  flush(): void {
    if (this.timer) this.run(false)
  }

  private run(reportErrors: boolean): void {
    this.clearTimer()
    if (this.saving) return
    const checked = validateTargetForm(this.snapshot.values, this.deps.equipment)
    if (!checked.ok) {
      if (reportErrors) this.update({ errors: checked.errors })
      return
    }
    if (targetKey(checked.target) === this.stored) {
      // Back to what is stored: nothing to save, and a failed or half-typed state is over.
      if (this.snapshot.status === 'dirty' || this.snapshot.status === 'failed') {
        this.update({ errors: {}, status: 'idle', failure: null })
      }
      return
    }
    void this.persist(checked.target)
  }

  private async persist(target: PlanTarget): Promise<void> {
    this.saving = true
    this.deps.apply(target)
    this.update({ errors: {}, status: 'saving', failure: null })
    try {
      await this.deps.save(target)
    } catch (cause) {
      console.error(cause)
      this.saving = false
      this.update({ status: 'failed', failure: this.deps.describeFailure(cause) })
      return
    }
    this.stored = targetKey(target)
    this.saving = false
    // Edits made while this save ran are still waiting: send them now unless the debounce already will.
    const waiting = this.hasPendingEdit()
    this.update({ status: waiting ? 'dirty' : 'saved' })
    if (waiting && !this.timer) this.run(false)
  }

  private hasPendingEdit(): boolean {
    const checked = validateTargetForm(this.snapshot.values, this.deps.equipment)
    return !checked.ok || targetKey(checked.target) !== this.stored
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private update(patch: Partial<AutosaveSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}
