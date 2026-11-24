import { describe, expect, test } from 'vitest'
import { DataError } from '../data/client'
import { describeCoachLinkError, describeCommonDataError } from './dataErrors'
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
  ['describeCoachLinkError', describeCoachLinkError],
])('%s reports an expired session instead of its fallback', (_name, describe) => {
  expect(describe(new DataError('Not signed in', 'not_signed_in'), 'Riprova.')).toBe('Sessione scaduta. Accedi di nuovo.')
})

describe('describeCoachLinkError', () => {
  test.each([
    ['unknown_coach', 'Nessun allenatore ha questo codice'],
    ['invalid_code', 'Il codice non è valido'],
    ['already_has_coach', 'revoca il collegamento attuale'],
    ['link_exists', 'anche se revocato'],
    ['self_link', 'Questo è il tuo codice'],
    ['invalid_label', 'Il nome non è accettato'],
    ['not_allowed', 'completa la verifica'],
    ['not_found', 'già stato revocato'],
    ['not_linked', 'collegamento non è attivo'],
    ['not_linked', 'completa la verifica'],
    ['invalid_athlete', 'Atleta non trovato'],
  ])('words %s in Italian', (code, text) => {
    expect(describeCoachLinkError(new DataError('x', code), 'Riprova.')).toContain(text)
  })

  test('uses the fallback for other failures and for non-data errors', () => {
    expect(describeCoachLinkError(new DataError('boom', 'XX000'), 'Riprova.')).toBe('Riprova.')
    expect(describeCoachLinkError(new DataError('no code'), 'Riprova.')).toBe('Riprova.')
    expect(describeCoachLinkError(new Error('unknown_coach'), 'Riprova.')).toBe('Riprova.')
  })
})
