import { describe, expect, it } from 'vitest'
import type { Exercise } from '../types/db'
import { emptyForm, formFromExercise, validateExerciseForm, type ExerciseFormValues } from './exerciseForm'

function form(overrides: Partial<ExerciseFormValues> = {}): ExerciseFormValues {
  return { ...emptyForm(), name: 'Squat', ...overrides }
}

describe('validateExerciseForm', () => {
  it('builds the row with nulls for empty optional fields', () => {
    expect(validateExerciseForm(form({ name: '  Squat  ' }))).toEqual({
      ok: true,
      exercise: {
        name: 'Squat',
        equipment: 'barbell',
        muscles: null,
        execution_steps: null,
        notes: null,
        starting_weight_kg: null,
      },
    })
  })

  it('stores trimmed text, joined steps and a comma weight', () => {
    const result = validateExerciseForm(
      form({
        equipment: 'dumbbell',
        muscles: ' Quadricipiti ',
        steps: ['Scendi', '', ' Risali '],
        startingWeight: '12,5',
        notes: ' Schiena dritta ',
      }),
    )
    expect(result).toEqual({
      ok: true,
      exercise: {
        name: 'Squat',
        equipment: 'dumbbell',
        muscles: 'Quadricipiti',
        execution_steps: 'Scendi\nRisali',
        notes: 'Schiena dritta',
        starting_weight_kg: 12.5,
      },
    })
  })

  it('accepts a dot weight and zero', () => {
    expect(validateExerciseForm(form({ equipment: 'dumbbell', startingWeight: '8.25' }))).toMatchObject({
      exercise: { starting_weight_kg: 8.25 },
    })
    expect(validateExerciseForm(form({ startingWeight: '0' }))).toMatchObject({
      exercise: { starting_weight_kg: 0 },
    })
  })

  it('stores a barbell weight typed per side as the total of both sides', () => {
    expect(validateExerciseForm(form({ equipment: 'barbell', startingWeight: '15' }))).toMatchObject({
      exercise: { equipment: 'barbell', starting_weight_kg: 30 },
    })
  })

  it('requires a name', () => {
    expect(validateExerciseForm(form({ name: '   ' }))).toEqual({
      ok: false,
      errors: { name: 'Inserisci il nome dell’esercizio.' },
    })
  })

  it('rejects invalid and out-of-range weights', () => {
    for (const startingWeight of ['abc', '-5', '12,5kg']) {
      expect(validateExerciseForm(form({ startingWeight }))).toMatchObject({
        ok: false,
        errors: { startingWeight: 'Inserisci un peso in kg, ad esempio 12,5.' },
      })
    }
    const dumbbell = (startingWeight: string) => form({ equipment: 'dumbbell', startingWeight })
    expect(validateExerciseForm(dumbbell('10000'))).toMatchObject({
      ok: false,
      errors: { startingWeight: 'Il peso massimo è 9999,99 kg.' },
    })
    expect(validateExerciseForm(dumbbell('9999,99')).ok).toBe(true)
    expect(validateExerciseForm(form({ startingWeight: '5000' }))).toMatchObject({
      errors: { startingWeight: 'Il peso massimo è 4999,99 kg per lato.' },
    })
    expect(validateExerciseForm(form({ startingWeight: '4999,99' })).ok).toBe(true)
  })

  it('enforces the database length limits', () => {
    expect(validateExerciseForm(form({ name: 'a'.repeat(120) })).ok).toBe(true)
    expect(validateExerciseForm(form({ name: 'a'.repeat(121) }))).toMatchObject({
      errors: { name: 'Massimo 120 caratteri (ora 121).' },
    })
    expect(validateExerciseForm(form({ muscles: 'a'.repeat(501) }))).toMatchObject({
      errors: { muscles: 'Massimo 500 caratteri (ora 501).' },
    })
    expect(validateExerciseForm(form({ notes: 'a'.repeat(2001) }))).toMatchObject({
      errors: { notes: 'Massimo 2000 caratteri (ora 2001).' },
    })
    expect(validateExerciseForm(form({ notes: 'a'.repeat(2000) })).ok).toBe(true)
  })

  it('limits the joined steps, not each step', () => {
    const steps = ['a'.repeat(1000), 'b'.repeat(1000)] // 2001 with the newline
    expect(validateExerciseForm(form({ steps }))).toMatchObject({
      errors: { steps: 'Massimo 2000 caratteri (ora 2001).' },
    })
    expect(validateExerciseForm(form({ steps: ['a'.repeat(1000), 'b'.repeat(999)] })).ok).toBe(true)
  })

  it('counts code points like Postgres char_length', () => {
    expect(validateExerciseForm(form({ name: '💪'.repeat(120) })).ok).toBe(true)
  })

  it('reports every invalid field at once', () => {
    const result = validateExerciseForm(form({ name: '', muscles: 'a'.repeat(501), startingWeight: 'x' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['muscles', 'name', 'startingWeight'])
  })
})

describe('formFromExercise', () => {
  const exercise: Exercise = {
    id: 'e1',
    owner_id: 'u1',
    name: 'Curl',
    equipment: 'barbell',
    muscles: null,
    execution_steps: 'Su\nGiù',
    notes: null,
    starting_weight_kg: 12.5,
    archived: false,
    catalog_id: null,
  }

  it('fills the form with an Italian decimal and split steps', () => {
    expect(formFromExercise({ ...exercise, equipment: 'dumbbell' })).toEqual({
      name: 'Curl',
      equipment: 'dumbbell',
      muscles: '',
      steps: ['Su', 'Giù'],
      startingWeight: '12,5',
      notes: '',
    })
  })

  it('shows the stored total of a barbell as the weight of one side', () => {
    expect(formFromExercise({ ...exercise, starting_weight_kg: 25 }).startingWeight).toBe('12,5')
  })

  it('maps a missing starting weight to an empty field', () => {
    expect(formFromExercise({ ...exercise, starting_weight_kg: null }).startingWeight).toBe('')
  })

  it('round-trips through validation', () => {
    expect(validateExerciseForm(formFromExercise(exercise))).toMatchObject({
      ok: true,
      exercise: { name: 'Curl', execution_steps: 'Su\nGiù', starting_weight_kg: 12.5 },
    })
    expect(validateExerciseForm(formFromExercise({ ...exercise, starting_weight_kg: 25 }))).toMatchObject({
      exercise: { starting_weight_kg: 25 },
    })
  })
})
