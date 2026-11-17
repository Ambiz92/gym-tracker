import { expect, test, vi } from 'vitest'
import { DataError, inUseError } from '../../data/client'
import { describeError } from './errors'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

test('in_use points to archiving instead of deleting', () => {
  expect(describeError(inUseError('The exercise'), 'x')).toContain('archivialo')
})

test('not_found asks to go back to the library', () => {
  expect(describeError(new DataError('gone', 'not_found'), 'x')).toContain('non trovato')
})

test('other failures use the fallback and never leak the raw message', () => {
  expect(describeError(new DataError('permission denied for table exercise', '42501'), 'Salvataggio non riuscito.')).toBe(
    'Salvataggio non riuscito.',
  )
  expect(describeError(new TypeError('Failed to fetch'), 'Salvataggio non riuscito.')).toBe('Salvataggio non riuscito.')
  expect(describeError('boom', 'Salvataggio non riuscito.')).toBe('Salvataggio non riuscito.')
})
