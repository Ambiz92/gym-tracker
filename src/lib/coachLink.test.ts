import { describe, expect, test } from 'vitest'
import type { CoachLink, CoachLinkStatus } from '../types/db'
import {
  actionLabel,
  activeAthletes,
  allowedActions,
  athleteName,
  coachNeedsSecondFactor,
  linkStatusLabel,
  needsSecondFactor,
  openCoachLink,
  parseAthleteLabel,
  parseCoachCode,
  pendingRequests,
} from './coachLink'

const ME = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b'
const OTHER = '9a7b0c1d-2e3f-4a5b-8c1e-5d4a4e6f3f2b'

function link(status: CoachLinkStatus, id: string = status): CoachLink {
  return {
    id,
    coach_id: OTHER,
    athlete_id: ME,
    status,
    athlete_label: 'Marta',
    consent_version: 'consent-v1',
    created_at: '2026-11-21T10:00:00Z',
    accepted_at: null,
    revoked_at: null,
    revoked_by: null,
  }
}

describe('linkStatusLabel', () => {
  test('words a pending link by who is waiting', () => {
    expect(linkStatusLabel('athlete', 'pending')).toBe('In attesa di risposta')
    expect(linkStatusLabel('coach', 'pending')).toBe('Richiesta in arrivo')
  })

  test('active and revoked read the same for both sides', () => {
    for (const role of ['athlete', 'coach'] as const) {
      expect(linkStatusLabel(role, 'active')).toBe('Attivo')
      expect(linkStatusLabel(role, 'revoked')).toBe('Revocato')
    }
  })
})

describe('allowedActions', () => {
  test.each([
    ['coach', 'pending', ['accept', 'decline']],
    ['coach', 'active', ['revoke']],
    ['coach', 'revoked', []],
    ['athlete', 'pending', ['revoke']],
    ['athlete', 'active', ['revoke']],
    ['athlete', 'revoked', []],
  ] as const)('%s on a %s link may %j', (role, status, expected) => {
    expect(allowedActions(role, status)).toEqual(expected)
  })

  test('an athlete is never offered the accept', () => {
    for (const status of ['pending', 'active', 'revoked'] as const) expect(allowedActions('athlete', status)).not.toContain('accept')
  })
})

describe('actionLabel', () => {
  test('names the action, and the athlete withdrawing a request differently from a revoke', () => {
    expect(actionLabel('accept', 'coach', 'pending')).toBe('Accetta')
    expect(actionLabel('decline', 'coach', 'pending')).toBe('Rifiuta')
    expect(actionLabel('revoke', 'athlete', 'pending')).toBe('Ritira la richiesta')
    expect(actionLabel('revoke', 'athlete', 'active')).toBe('Revoca l’accesso')
    expect(actionLabel('revoke', 'coach', 'active')).toBe('Revoca l’accesso')
  })
})

test('only the accept needs the second factor', () => {
  expect(needsSecondFactor('accept')).toBe(true)
  expect(needsSecondFactor('decline')).toBe(false)
  expect(needsSecondFactor('revoke')).toBe(false)
})

describe('coachNeedsSecondFactor', () => {
  test('is true at aal1 with a pending or active link as coach', () => {
    expect(coachNeedsSecondFactor([link('pending')], false)).toBe(true)
    expect(coachNeedsSecondFactor([link('active')], false)).toBe(true)
  })

  test('is false at aal2, without links, or with only revoked ones', () => {
    expect(coachNeedsSecondFactor([link('active')], true)).toBe(false)
    expect(coachNeedsSecondFactor([], false)).toBe(false)
    expect(coachNeedsSecondFactor([link('revoked')], false)).toBe(false)
  })
})

describe('link selectors', () => {
  const all = [link('revoked', 'a'), link('pending', 'b'), link('active', 'c'), link('pending', 'd')]

  test('pendingRequests and activeAthletes pick by status, keeping the order', () => {
    expect(pendingRequests(all).map((l) => l.id)).toEqual(['b', 'd'])
    expect(activeAthletes(all).map((l) => l.id)).toEqual(['c'])
  })

  test('openCoachLink is the pending or active link, and null when only revoked ones are left', () => {
    expect(openCoachLink([link('revoked'), link('active', 'x')])?.id).toBe('x')
    expect(openCoachLink([link('revoked')])).toBeNull()
    expect(openCoachLink([])).toBeNull()
  })
})

describe('parseCoachCode', () => {
  test('accepts a uuid, trimmed and lower-cased', () => {
    expect(parseCoachCode(`  ${OTHER.toUpperCase()}\n`, ME)).toEqual({ ok: true, value: OTHER })
  })

  test('refuses anything that is not a uuid', () => {
    for (const raw of ['', 'allenatore', OTHER.slice(1), `${OTHER}x`]) {
      expect(parseCoachCode(raw, ME)).toMatchObject({ ok: false, message: expect.stringContaining('36 caratteri') })
    }
  })

  test('refuses the user’s own code in any case', () => {
    expect(parseCoachCode(ME.toUpperCase(), ME)).toMatchObject({ ok: false, message: expect.stringContaining('tuo codice') })
  })
})

describe('parseAthleteLabel', () => {
  test('trims the name', () => {
    expect(parseAthleteLabel('  Marta R.  ')).toEqual({ ok: true, value: 'Marta R.' })
  })

  test('refuses a blank name', () => {
    expect(parseAthleteLabel('   ')).toMatchObject({ ok: false })
  })

  test('allows 60 characters and refuses 61, counting each emoji once', () => {
    expect(parseAthleteLabel('a'.repeat(60)).ok).toBe(true)
    expect(parseAthleteLabel('a'.repeat(61)).ok).toBe(false)
    expect(parseAthleteLabel('💪'.repeat(60)).ok).toBe(true)
  })

  test.each([
    ['a control character', 'Ma\u0007rta'],
    ['a zero-width space', 'Ma\u200brta'],
    ['a right-to-left override', 'Marta\u202e'],
    ['a bidi isolate', '\u2066Marta'],
    ['a byte order mark', 'Mar\ufeffta'],
    ['a line separator', 'Marta\u2028Rossi'],
  ])('refuses %s', (_name, raw) => {
    expect(parseAthleteLabel(raw)).toMatchObject({ ok: false, message: expect.stringContaining('non visibili') })
  })
})

test('athleteName falls back when the label is missing', () => {
  expect(athleteName({ athlete_label: 'Marta' })).toBe('Marta')
  expect(athleteName({ athlete_label: null })).toBe('Atleta senza nome')
})
