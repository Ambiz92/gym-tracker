import { describe, expect, it } from 'vitest'
import {
  defaultTarget,
  nextUnit,
  targetOf,
  sessionFormFrom,
  targetFormFrom,
  validateName,
  validateSessionForm,
  validateTargetForm,
  type PlanTarget,
  type TargetFormValues,
} from './planForm'
import type { Equipment } from '../types/db'

/** Dumbbell by default: its weights are typed and stored as they are. */
const validate = (form: TargetFormValues, equipment: Equipment = 'dumbbell') => validateTargetForm(form, equipment)
const formFrom = (target: PlanTarget, equipment: Equipment = 'dumbbell') => targetFormFrom(target, equipment)

describe('validateName', () => {
  it('trims the name', () => {
    expect(validateName('  Forza base ', 'scheda')).toEqual({ ok: true, name: 'Forza base' })
  })

  it('refuses a blank name, naming what is missing', () => {
    expect(validateName('   ', 'scheda')).toEqual({ ok: false, error: 'Inserisci il nome della scheda.' })
    expect(validateName('', 'sessione')).toEqual({ ok: false, error: 'Inserisci il nome della sessione.' })
  })

  it('counts code points against the 120-character limit', () => {
    expect(validateName('😀'.repeat(120), 'scheda').ok).toBe(true)
    expect(validateName('😀'.repeat(121), 'scheda')).toMatchObject({ ok: false, error: expect.stringContaining('121') })
  })
})

describe('validateSessionForm', () => {
  it('builds the columns, storing a blank subtitle as null', () => {
    expect(validateSessionForm({ name: ' Upper ', subtitle: '  ', isOptional: true })).toEqual({
      ok: true,
      session: { name: 'Upper', subtitle: null, is_optional: true },
    })
    expect(validateSessionForm({ name: 'Upper', subtitle: ' Petto ', isOptional: false })).toMatchObject({
      session: { subtitle: 'Petto', is_optional: false },
    })
  })

  it('reports every invalid field at once', () => {
    const result = validateSessionForm({ name: '', subtitle: 'x'.repeat(121), isOptional: false })
    expect(result).toMatchObject({ ok: false, errors: { name: expect.any(String), subtitle: expect.stringContaining('121') } })
  })

  it('round-trips a stored session', () => {
    const stored = { name: 'A', subtitle: null, is_optional: true }
    expect(sessionFormFrom(stored)).toEqual({ name: 'A', subtitle: '', isOptional: true })
  })
})

describe('validateTargetForm', () => {
  const values = (overrides: Partial<TargetFormValues> = {}): TargetFormValues => ({
    sets: '3',
    reps: '8',
    unit: 'reps',
    weight: '',
    weightMax: '',
    ...overrides,
  })

  it('builds the columns with no weight', () => {
    expect(validate(values())).toEqual({
      ok: true,
      target: {
        target_sets: 3,
        target_reps: 8,
        target_unit: 'reps',
        suggested_weight_kg: null,
        suggested_weight_max_kg: null,
      },
    })
  })

  it('accepts comma decimals and a range', () => {
    expect(validate(values({ unit: 'seconds', weight: '12,5', weightMax: '15' }))).toMatchObject({
      ok: true,
      target: { target_unit: 'seconds', suggested_weight_kg: 12.5, suggested_weight_max_kg: 15 },
    })
  })

  it.each(['', '0', '-1', '2,5', 'abc', '100'])('refuses %j as sets', (sets) => {
    expect(validate(values({ sets }))).toMatchObject({ ok: false, errors: { sets: expect.any(String) } })
  })

  it('refuses reps that are not a positive whole number, naming the unit', () => {
    expect(validate(values({ reps: '0', unit: 'meters' }))).toMatchObject({
      errors: { reps: expect.stringContaining('Metri') },
    })
    expect(validate(values({ reps: '1000' }))).toMatchObject({ ok: false })
    expect(validate(values({ reps: '999' })).ok).toBe(true)
  })

  it('refuses a malformed or oversized weight', () => {
    expect(validate(values({ weight: 'x' }))).toMatchObject({ errors: { weight: expect.any(String) } })
    expect(validate(values({ weight: '10000' }))).toMatchObject({ errors: { weight: expect.any(String) } })
  })

  it('stores a barbell weight typed per side as the total of both sides', () => {
    expect(validate(values({ weight: '15', weightMax: '17,5' }), 'barbell')).toMatchObject({
      ok: true,
      target: { suggested_weight_kg: 30, suggested_weight_max_kg: 35 },
    })
  })

  it('keeps the barbell limit of the numeric(6, 2) column, per side', () => {
    expect(validate(values({ weight: '4999,99' }), 'barbell').ok).toBe(true)
    expect(validate(values({ weight: '5000' }), 'barbell')).toMatchObject({ errors: { weight: 'Il peso massimo è 4999,99 kg per lato.' } })
    expect(validate(values({ weight: '9999,99' })).ok).toBe(true)
  })

  it('needs a minimum weight before a maximum, and a maximum that is not lower', () => {
    expect(validate(values({ weightMax: '20' }))).toMatchObject({
      errors: { weightMax: 'Indica prima il peso minimo.' },
    })
    expect(validate(values({ weight: '20', weightMax: '15' }))).toMatchObject({
      errors: { weightMax: expect.stringContaining('sotto il minimo') },
    })
    expect(validate(values({ weight: '20', weightMax: '20' })).ok).toBe(true)
  })

  it('reports every invalid field at once', () => {
    const result = validate(values({ sets: '0', reps: '0', weight: 'x' }))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['reps', 'sets', 'weight'])
  })
})

describe('targets from the stored row and for a new exercise', () => {
  it('shows stored weights with a decimal comma and blanks for null', () => {
    expect(
      formFrom({
        target_sets: 4,
        target_reps: 30,
        target_unit: 'seconds',
        suggested_weight_kg: 12.5,
        suggested_weight_max_kg: null,
      }),
    ).toEqual({ sets: '4', reps: '30', unit: 'seconds', weight: '12,5', weightMax: '' })
  })

  it('shows a stored barbell total as one side', () => {
    expect(
      formFrom(
        { target_sets: 3, target_reps: 8, target_unit: 'reps', suggested_weight_kg: 30, suggested_weight_max_kg: 35 },
        'barbell',
      ),
    ).toMatchObject({ weight: '15', weightMax: '17,5' })
  })

  it('starts a new exercise at 3×8 with its starting weight', () => {
    expect(defaultTarget({ starting_weight_kg: 20 })).toEqual({
      target_sets: 3,
      target_reps: 8,
      target_unit: 'reps',
      suggested_weight_kg: 20,
      suggested_weight_max_kg: null,
    })
    expect(defaultTarget({ starting_weight_kg: null }).suggested_weight_kg).toBeNull()
  })

  it('a stored target survives the form unchanged', () => {
    const target = defaultTarget({ starting_weight_kg: 22.5 })
    expect(validate(formFrom(target))).toEqual({ ok: true, target })
    expect(validate(formFrom(target, 'barbell'), 'barbell')).toEqual({ ok: true, target })
  })
})

describe('nextUnit', () => {
  it('cycles reps, seconds, meters and back', () => {
    expect(nextUnit('reps')).toBe('seconds')
    expect(nextUnit('seconds')).toBe('meters')
    expect(nextUnit('meters')).toBe('reps')
  })
})

describe('targetOf', () => {
  it('keeps the five target columns and drops the rest of the row', () => {
    const row = { id: 'x1', session_id: 's1', position: 2, target_sets: 3, target_reps: 8, target_unit: 'reps' as const, suggested_weight_kg: 20, suggested_weight_max_kg: null }
    expect(targetOf(row)).toEqual({ target_sets: 3, target_reps: 8, target_unit: 'reps', suggested_weight_kg: 20, suggested_weight_max_kg: null })
  })
})
