import { describe, expect, it } from 'vitest'
import {
  defaultTarget,
  nextUnit,
  sessionFormFrom,
  targetFormFrom,
  validateName,
  validateSessionForm,
  validateTargetForm,
  type TargetFormValues,
} from './planForm'

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
    expect(validateTargetForm(values())).toEqual({
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
    expect(validateTargetForm(values({ unit: 'seconds', weight: '12,5', weightMax: '15' }))).toMatchObject({
      ok: true,
      target: { target_unit: 'seconds', suggested_weight_kg: 12.5, suggested_weight_max_kg: 15 },
    })
  })

  it.each(['', '0', '-1', '2,5', 'abc', '100'])('refuses %j as sets', (sets) => {
    expect(validateTargetForm(values({ sets }))).toMatchObject({ ok: false, errors: { sets: expect.any(String) } })
  })

  it('refuses reps that are not a positive whole number, naming the unit', () => {
    expect(validateTargetForm(values({ reps: '0', unit: 'meters' }))).toMatchObject({
      errors: { reps: expect.stringContaining('Metri') },
    })
    expect(validateTargetForm(values({ reps: '1000' }))).toMatchObject({ ok: false })
    expect(validateTargetForm(values({ reps: '999' })).ok).toBe(true)
  })

  it('refuses a malformed or oversized weight', () => {
    expect(validateTargetForm(values({ weight: 'x' }))).toMatchObject({ errors: { weight: expect.any(String) } })
    expect(validateTargetForm(values({ weight: '10000' }))).toMatchObject({ errors: { weight: expect.any(String) } })
  })

  it('needs a minimum weight before a maximum, and a maximum that is not lower', () => {
    expect(validateTargetForm(values({ weightMax: '20' }))).toMatchObject({
      errors: { weightMax: 'Indica prima il peso minimo.' },
    })
    expect(validateTargetForm(values({ weight: '20', weightMax: '15' }))).toMatchObject({
      errors: { weightMax: expect.stringContaining('sotto il minimo') },
    })
    expect(validateTargetForm(values({ weight: '20', weightMax: '20' })).ok).toBe(true)
  })

  it('reports every invalid field at once', () => {
    const result = validateTargetForm(values({ sets: '0', reps: '0', weight: 'x' }))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['reps', 'sets', 'weight'])
  })
})

describe('targets from the stored row and for a new exercise', () => {
  it('shows stored weights with a decimal comma and blanks for null', () => {
    expect(
      targetFormFrom({
        target_sets: 4,
        target_reps: 30,
        target_unit: 'seconds',
        suggested_weight_kg: 12.5,
        suggested_weight_max_kg: null,
      }),
    ).toEqual({ sets: '4', reps: '30', unit: 'seconds', weight: '12,5', weightMax: '' })
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
    expect(validateTargetForm(targetFormFrom(target))).toEqual({ ok: true, target })
  })
})

describe('nextUnit', () => {
  it('cycles reps, seconds, meters and back', () => {
    expect(nextUnit('reps')).toBe('seconds')
    expect(nextUnit('seconds')).toBe('meters')
    expect(nextUnit('meters')).toBe('reps')
  })
})
