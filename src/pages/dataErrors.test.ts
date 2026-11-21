import { expect, test } from 'vitest'
import { DataError } from '../data/client'
import { describeCommonDataError } from './dataErrors'
import { describeError } from './exercises/errors'
import { describeScheduleError } from './calendar/errors'
import { describePlanError } from './plans/errors'

test('maps a missing session to an Italian prompt to sign in again', () => {
  expect(describeCommonDataError(new DataError('Not signed in', 'not_signed_in'))).toBe('Sessione scaduta. Accedi di nuovo.')
})

test('has nothing to say about other failures', () => {
  expect(describeCommonDataError(new DataError('boom', 'XX000'))).toBeNull()
  expect(describeCommonDataError(new Error('not_signed_in'))).toBeNull()
  expect(describeCommonDataError(null)).toBeNull()
})

test.each([
  ['describePlanError', describePlanError],
  ['describeScheduleError', describeScheduleError],
  ['describeError', describeError],
])('%s reports an expired session instead of its fallback', (_name, describe) => {
  expect(describe(new DataError('Not signed in', 'not_signed_in'), 'Riprova.')).toBe('Sessione scaduta. Accedi di nuovo.')
})
