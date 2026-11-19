import type { Equipment, TargetUnit } from '../types/db'
import { formatNumber } from './formatNumber'
import { MAX_KG_PER_SIDE, perSideFromTotal, totalFromPerSide } from './plates'
import { clamp } from './slider'
import { MAX_WEIGHT_KG, parseDecimal } from './validation'

export type Field = 'weight' | 'reps'

/** What the user is about to confirm as the next set. */
export interface SetValues {
  /** Total in kg; on a barbell the plates of both sides, bar excluded. The logger steps and types it per side, but this is what is saved. */
  weight: number
  reps: number
  equipment: Equipment
}

export interface FlowState {
  values: SetValues
  /** Text being typed into one of the numbers; null while the numbers are only stepped. */
  editing: { field: Field; text: string } | null
  error: string | null
}

export type FlowAction =
  | { type: 'step'; field: Field; delta: number }
  | { type: 'set'; field: Field; value: number }
  | { type: 'edit-start'; field: Field }
  | { type: 'edit-text'; text: string }
  | { type: 'edit-commit' }
  | { type: 'equipment'; equipment: Equipment }

export const MAX_REPS_INPUT = 999

const STEP_BY_UNIT: Record<TargetUnit, number> = { reps: 1, seconds: 5, meters: 5 }

/** Step of the "reps" number: one rep at a time, five seconds or meters for holds and carries. */
export const repsStep = (unit: TargetUnit): number => STEP_BY_UNIT[unit]

const round2 = (value: number): number => Math.round(value * 100) / 100

export const initialFlow = (values: SetValues): FlowState => ({ values, editing: null, error: null })

type Parsed = { value: number } | { error: string }

const isPerSide = (field: Field, equipment: Equipment): boolean => field === 'weight' && equipment === 'barbell'

function parseField(field: Field, text: string, equipment: Equipment): Parsed {
  const parsed = parseDecimal(text)
  if (isPerSide(field, equipment)) {
    if (parsed === null || parsed > MAX_KG_PER_SIDE) {
      return { error: `Scrivi il peso di un lato tra 0 e ${MAX_KG_PER_SIDE} kg, per esempio 7,5.` }
    }
    return { value: totalFromPerSide(parsed) }
  }
  if (field === 'weight') {
    if (parsed === null || parsed > MAX_WEIGHT_KG) {
      return { error: `Scrivi un peso tra 0 e ${MAX_WEIGHT_KG} kg, per esempio 12,5.` }
    }
    return { value: round2(parsed) }
  }
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_REPS_INPUT) {
    return { error: `Scrivi un numero intero da 1 a ${MAX_REPS_INPUT}.` }
  }
  return { value: parsed }
}

const FIELD_BOUNDS: Record<Field, { min: number; max: number }> = {
  weight: { min: 0, max: MAX_WEIGHT_KG },
  reps: { min: 1, max: MAX_REPS_INPUT },
}

/** The value kept inside the field's limits; the current value when it is not a number. */
function clampField(field: Field, value: number, current: number): number {
  if (Number.isNaN(value)) return current
  return clamp(round2(value), FIELD_BOUNDS[field].min, FIELD_BOUNDS[field].max)
}

const withField = (values: SetValues, field: Field, value: number): SetValues => ({ ...values, [field]: value })

/** The flow with one number replaced by a value kept inside its limits; whatever was being typed is dropped. */
const setField = (state: FlowState, field: Field, value: number): FlowState => ({
  values: withField(state.values, field, clampField(field, value, state.values[field])),
  editing: null,
  error: null,
})

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'step':
      // On a barbell the step is per side, so the total moves twice as much.
      return setField(state, action.field, state.values[action.field] + action.delta * (isPerSide(action.field, state.values.equipment) ? 2 : 1))
    case 'set':
      return setField(state, action.field, action.value)
    case 'edit-start': {
      const { values } = state
      const shown = isPerSide(action.field, values.equipment) ? perSideFromTotal(values.weight) : values[action.field]
      return { ...state, editing: { field: action.field, text: formatNumber(shown) }, error: null }
    }
    case 'edit-text':
      return state.editing ? { ...state, editing: { ...state.editing, text: action.text }, error: null } : state
    case 'edit-commit': {
      if (!state.editing) return state
      const parsed = parseField(state.editing.field, state.editing.text, state.values.equipment)
      if ('error' in parsed) return { ...state, error: parsed.error }
      return { values: withField(state.values, state.editing.field, parsed.value), editing: null, error: null }
    }
    case 'equipment':
      return { ...state, values: { ...state.values, equipment: action.equipment } }
  }
}

/** The values to confirm, applying a number still being typed; the message when that text is invalid. */
export function resolveValues(state: FlowState): { values: SetValues } | { error: string } {
  if (!state.editing) return { values: state.values }
  const parsed = parseField(state.editing.field, state.editing.text, state.values.equipment)
  if ('error' in parsed) return parsed
  return { values: withField(state.values, state.editing.field, parsed.value) }
}
