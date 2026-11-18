import { expect, it } from 'vitest'
import { DataError } from '../../data/client'
import { describePlanError, describeSessionError } from './errors'

const inUse = new DataError('in use', 'in_use')

it('tells a plan with history to be archived instead', () => {
  expect(describePlanError(inUse, 'x')).toContain('archiviala')
})

it('says a logged session cannot be removed, without suggesting an archive it does not have', () => {
  const message = describeSessionError(inUse, 'x')
  expect(message).toContain('non si può rimuovere')
  expect(message).not.toContain('archivi')
})

it('explains an archived plan that cannot be activated and a missing row', () => {
  expect(describePlanError(new DataError('a', 'archived'), 'x')).toContain('ripristinala')
  expect(describeSessionError(new DataError('n', 'not_found'), 'x')).toContain('non trovato')
})

it('falls back to the generic message for anything else', () => {
  expect(describePlanError(new Error('boom'), 'Riprova.')).toBe('Riprova.')
  expect(describeSessionError(new DataError('c', '23514'), 'Riprova.')).toBe('Riprova.')
})
