import type { Equipment, Exercise, ExerciseInsert } from '../types/db'
import { toDisplayKg, toStoredKg } from './barbellLoad'
import { joinSteps, splitSteps } from './steps'
import { parseDecimal } from './validation'

// Limits mirror the check constraints of supabase/migrations/0001_schema.sql.
export const MAX_NAME_LENGTH = 120
export const MAX_MUSCLES_LENGTH = 500
export const MAX_TEXT_LENGTH = 2000
// numeric(6, 2)
export const MAX_STARTING_WEIGHT_KG = 9999.99

/** Error for a typed weight (one side on a barbell) whose stored value would not fit numeric(6, 2), else null. */
export function weightLimitError(equipment: Equipment, typedKg: number): string | null {
  if (toStoredKg(equipment, typedKg) <= MAX_STARTING_WEIGHT_KG) return null
  return equipment === 'barbell' ? 'Il peso massimo è 4999,99 kg per lato.' : 'Il peso massimo è 9999,99 kg.'
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Bilanciere',
  dumbbell: 'Manubri',
  other: 'Altro',
}
export const EQUIPMENT_ORDER: readonly Equipment[] = ['barbell', 'dumbbell', 'other']

export interface ExerciseFormValues {
  name: string
  equipment: Equipment
  muscles: string
  steps: string[]
  /** Typed text: comma or dot decimals; one side on a barbell. */
  startingWeight: string
  notes: string
}

export type ExerciseFormField = 'name' | 'muscles' | 'steps' | 'startingWeight' | 'notes'
export type ExerciseFormErrors = Partial<Record<ExerciseFormField, string>>
export type ExerciseFormResult =
  | { ok: true; exercise: ExerciseInsert }
  | { ok: false; errors: ExerciseFormErrors }

export function emptyForm(): ExerciseFormValues {
  return { name: '', equipment: 'barbell', muscles: '', steps: [], startingWeight: '', notes: '' }
}

export function formFromExercise(exercise: Exercise): ExerciseFormValues {
  const shownWeight = toDisplayKg(exercise.equipment, exercise.starting_weight_kg)
  return {
    name: exercise.name,
    equipment: exercise.equipment,
    muscles: exercise.muscles ?? '',
    steps: splitSteps(exercise.execution_steps),
    startingWeight: shownWeight === null ? '' : String(shownWeight).replace('.', ','),
    notes: exercise.notes ?? '',
  }
}

/** Postgres char_length counts code points, not UTF-16 units. */
function charCount(text: string): number {
  return [...text].length
}

function tooLong(text: string, max: number): string | null {
  const count = charCount(text)
  return count > max ? `Massimo ${max} caratteri (ora ${count}).` : null
}

/** Checks the form against the database limits and builds the row to store. */
export function validateExerciseForm(values: ExerciseFormValues): ExerciseFormResult {
  const errors: ExerciseFormErrors = {}

  const name = values.name.trim()
  const nameError = name === '' ? 'Inserisci il nome dell’esercizio.' : tooLong(name, MAX_NAME_LENGTH)
  if (nameError) errors.name = nameError

  const muscles = values.muscles.trim()
  const musclesError = tooLong(muscles, MAX_MUSCLES_LENGTH)
  if (musclesError) errors.muscles = musclesError

  const executionSteps = joinSteps(values.steps)
  const stepsError = tooLong(executionSteps ?? '', MAX_TEXT_LENGTH)
  if (stepsError) errors.steps = stepsError

  const notes = values.notes.trim()
  const notesError = tooLong(notes, MAX_TEXT_LENGTH)
  if (notesError) errors.notes = notesError

  const weightText = values.startingWeight.trim()
  const startingWeight = weightText === '' ? null : parseDecimal(weightText)
  if (weightText !== '' && startingWeight === null) {
    errors.startingWeight = 'Inserisci un peso in kg, ad esempio 12,5.'
  } else if (startingWeight !== null) {
    const limit = weightLimitError(values.equipment, startingWeight)
    if (limit) errors.startingWeight = limit
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    exercise: {
      name,
      equipment: values.equipment,
      muscles: muscles === '' ? null : muscles,
      execution_steps: executionSteps,
      notes: notes === '' ? null : notes,
      starting_weight_kg: startingWeight === null ? null : toStoredKg(values.equipment, startingWeight),
    },
  }
}
