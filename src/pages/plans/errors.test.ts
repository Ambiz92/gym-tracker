import { expect, it } from 'vitest'
import { DataError } from '../../data/client'
import { describePlanError } from './errors'

const inUse = new DataError('in use', 'in_use')

it('tells a plan with history to be archived instead', () => {
  expect(describePlanError(inUse, 'x')).toContain('archiviala')
})

it('warns that a failed duplication left a partial copy behind', () => {
  expect(describePlanError(new DataError('p', 'partial_copy'), 'x')).toContain('copia parziale')
})

it('warns that a failed creation or session copy left something behind', () => {
  expect(describePlanError(new DataError('p', 'partial_create'), 'x')).toContain('scheda vuota')
  expect(describePlanError(new DataError('p', 'partial_session'), 'x')).toContain('sessione copiata a metà')
})

it('explains an archived plan that cannot be activated and a missing row', () => {
  expect(describePlanError(new DataError('a', 'archived'), 'x')).toContain('ripristinala')
  expect(describePlanError(new DataError('n', 'not_found'), 'x')).toContain('non trovato')
})

it('falls back to the generic message for anything else', () => {
  expect(describePlanError(new Error('boom'), 'Riprova.')).toBe('Riprova.')
  expect(describePlanError(new DataError('c', '23514'), 'Riprova.')).toBe('Riprova.')
})
