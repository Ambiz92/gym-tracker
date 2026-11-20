import type { Exercise, PlanExercise, PlanSession, TargetUnit } from '../types/db'
import { MAX_NAME_LENGTH, MAX_STARTING_WEIGHT_KG } from './exerciseForm'
import { formatNumber } from './formatNumber'
import { parseDecimal } from './validation'

// Limits mirror the check constraints of supabase/migrations/0001_schema.sql; sets and reps also have sane upper bounds.
export const MAX_SUBTITLE_LENGTH = 120
export const MAX_SETS = 99
export const MAX_REPS = 999

export const UNIT_LABELS: Record<TargetUnit, string> = {
  reps: 'Ripetizioni',
  seconds: 'Secondi',
  meters: 'Metri',
}
export const UNIT_ORDER: readonly TargetUnit[] = ['reps', 'seconds', 'meters']

/** The unit after `unit` in the order reps, seconds, meters: one tap on the row's unit key cycles through them. */
export function nextUnit(unit: TargetUnit): TargetUnit {
  return UNIT_ORDER[(UNIT_ORDER.indexOf(unit) + 1) % UNIT_ORDER.length]
}

const DEFAULT_SETS = 3
const DEFAULT_REPS = 8

export type NameResult = { ok: true; name: string } | { ok: false; error: string }

/** Trims and checks the name of a plan or a session against the database limits. */
export function validateName(text: string, noun: 'scheda' | 'sessione'): NameResult {
  const name = text.trim()
  if (name === '') return { ok: false, error: `Inserisci il nome della ${noun}.` }
  const length = [...name].length
  if (length > MAX_NAME_LENGTH) return { ok: false, error: `Massimo ${MAX_NAME_LENGTH} caratteri (ora ${length}).` }
  return { ok: true, name }
}

export interface SessionFormValues {
  name: string
  subtitle: string
  isOptional: boolean
}
export type SessionFormErrors = Partial<Record<'name' | 'subtitle', string>>
export type SessionFormResult =
  | { ok: true; session: Pick<PlanSession, 'name' | 'subtitle' | 'is_optional'> }
  | { ok: false; errors: SessionFormErrors }

export function sessionFormFrom(session: Pick<PlanSession, 'name' | 'subtitle' | 'is_optional'>): SessionFormValues {
  return { name: session.name, subtitle: session.subtitle ?? '', isOptional: session.is_optional }
}

export function validateSessionForm(values: SessionFormValues): SessionFormResult {
  const errors: SessionFormErrors = {}
  const name = validateName(values.name, 'sessione')
  if (!name.ok) errors.name = name.error

  const subtitle = values.subtitle.trim()
  const subtitleLength = [...subtitle].length
  if (subtitleLength > MAX_SUBTITLE_LENGTH) {
    errors.subtitle = `Massimo ${MAX_SUBTITLE_LENGTH} caratteri (ora ${subtitleLength}).`
  }

  if (!name.ok || errors.subtitle) return { ok: false, errors }
  return {
    ok: true,
    session: { name: name.name, subtitle: subtitle === '' ? null : subtitle, is_optional: values.isOptional },
  }
}

export type PlanTarget = Pick<
  PlanExercise,
  'target_sets' | 'target_reps' | 'target_unit' | 'suggested_weight_kg' | 'suggested_weight_max_kg'
>

/** Typed text of the target of one exercise: weights accept comma or dot decimals. */
export interface TargetFormValues {
  sets: string
  reps: string
  unit: TargetUnit
  weight: string
  weightMax: string
}
export type TargetFormErrors = Partial<Record<'sets' | 'reps' | 'weight' | 'weightMax', string>>
export type TargetFormResult = { ok: true; target: PlanTarget } | { ok: false; errors: TargetFormErrors }

function weightText(kg: number | null): string {
  return kg === null ? '' : formatNumber(kg)
}

export function targetFormFrom(target: PlanTarget): TargetFormValues {
  return {
    sets: String(target.target_sets),
    reps: String(target.target_reps),
    unit: target.target_unit,
    weight: weightText(target.suggested_weight_kg),
    weightMax: weightText(target.suggested_weight_max_kg),
  }
}

/** Target of a freshly added exercise: 3×8 at the exercise's starting weight, if it has one. */
export function defaultTarget(exercise: Pick<Exercise, 'starting_weight_kg'>): PlanTarget {
  return {
    target_sets: DEFAULT_SETS,
    target_reps: DEFAULT_REPS,
    target_unit: 'reps',
    suggested_weight_kg: exercise.starting_weight_kg,
    suggested_weight_max_kg: null,
  }
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function parseCount(text: string, max: number, what: string): Parsed<number> {
  const trimmed = text.trim()
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : 0
  if (value < 1 || value > max) return { ok: false, error: `${what}: un numero intero da 1 a ${max}.` }
  return { ok: true, value }
}

function parseWeight(text: string): Parsed<number | null> {
  if (text.trim() === '') return { ok: true, value: null }
  const value = parseDecimal(text)
  if (value === null) return { ok: false, error: 'Inserisci un peso in kg, ad esempio 12,5.' }
  if (value > MAX_STARTING_WEIGHT_KG) return { ok: false, error: 'Il peso massimo è 9999,99 kg.' }
  return { ok: true, value }
}

/** Checks the target form against the database limits and builds the columns to store. */
export function validateTargetForm(values: TargetFormValues): TargetFormResult {
  const errors: TargetFormErrors = {}
  const sets = parseCount(values.sets, MAX_SETS, 'Serie')
  const reps = parseCount(values.reps, MAX_REPS, UNIT_LABELS[values.unit])
  const weight = parseWeight(values.weight)
  const weightMax = parseWeight(values.weightMax)

  if (!sets.ok) errors.sets = sets.error
  if (!reps.ok) errors.reps = reps.error
  if (!weight.ok) errors.weight = weight.error
  if (!weightMax.ok) errors.weightMax = weightMax.error

  if (weight.ok && weightMax.ok && weightMax.value !== null) {
    if (weight.value === null) errors.weightMax = 'Indica prima il peso minimo.'
    else if (weightMax.value < weight.value) errors.weightMax = 'Il massimo non può essere sotto il minimo.'
  }

  if (!sets.ok || !reps.ok || !weight.ok || !weightMax.ok || errors.weightMax) return { ok: false, errors }
  return {
    ok: true,
    target: {
      target_sets: sets.value,
      target_reps: reps.value,
      target_unit: values.unit,
      suggested_weight_kg: weight.value,
      suggested_weight_max_kg: weightMax.value,
    },
  }
}
