import type { Equipment, TargetUnit } from '../types/db'
import { formatNumber } from './formatNumber'
import { parseDecimal } from './validation'

export type Field = 'weight' | 'reps'

/** What the user is about to confirm as the next set. */
export interface SetValues {
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

export const MAX_WEIGHT_KG = 1000
export const MAX_REPS_INPUT = 999

const STEP_BY_UNIT: Record<TargetUnit, number> = { reps: 1, seconds: 5, meters: 5 }

/** Step of the "reps" number: one rep at a time, five seconds or meters for holds and carries. */
export const repsStep = (unit: TargetUnit): number => STEP_BY_UNIT[unit]

const round2 = (value: number): number => Math.round(value * 100) / 100

export const initialFlow = (values: SetValues): FlowState => ({ values, editing: null, error: null })

type Parsed = { value: number } | { error: string }

function parseField(field: Field, text: string): Parsed {
  const parsed = parseDecimal(text)
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

const clampField = (field: Field, value: number): number =>
  field === 'weight' ? Math.min(MAX_WEIGHT_KG, Math.max(0, round2(value))) : Math.min(MAX_REPS_INPUT, Math.max(1, round2(value)))

const withField = (values: SetValues, field: Field, value: number): SetValues => ({ ...values, [field]: value })

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'step':
      return { values: withField(state.values, action.field, clampField(action.field, state.values[action.field] + action.delta)), editing: null, error: null }
    case 'set':
      return { values: withField(state.values, action.field, clampField(action.field, action.value)), editing: null, error: null }
    case 'edit-start':
      return { ...state, editing: { field: action.field, text: formatNumber(state.values[action.field]) }, error: null }
    case 'edit-text':
      return state.editing ? { ...state, editing: { ...state.editing, text: action.text }, error: null } : state
    case 'edit-commit': {
      if (!state.editing) return state
      const parsed = parseField(state.editing.field, state.editing.text)
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
  const parsed = parseField(state.editing.field, state.editing.text)
  if ('error' in parsed) return parsed
  return { values: withField(state.values, state.editing.field, parsed.value) }
}
