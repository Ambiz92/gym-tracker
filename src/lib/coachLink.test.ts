import { describe, expect, test } from 'vitest'
import type { CoachLink, CoachLinkStatus } from '../types/db'
import {
  activeAthletes,
  athleteName,
  linkDay,
  linkSince,
  linkStatusLabel,
  openAthletes,
  openCoachLink,
  parseAthleteLabel,
  parseCoachCode,
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

test('linkStatusLabel words each status, a legacy pending one included', () => {
  expect(linkStatusLabel('active')).toBe('Attivo')
  expect(linkStatusLabel('pending')).toBe('In sospeso')
  expect(linkStatusLabel('revoked')).toBe('Revocato')
})

describe('link selectors', () => {
  const all = [link('revoked', 'a'), link('pending', 'b'), link('active', 'c'), link('pending', 'd')]

  test('activeAthletes keeps only the active links, in order', () => {
    expect(activeAthletes(all).map((l) => l.id)).toEqual(['c'])
  })

  test('openAthletes keeps the active and the legacy pending links, in order', () => {
    expect(openAthletes(all).map((l) => l.id)).toEqual(['b', 'c', 'd'])
  })

  test('openCoachLink is the active or legacy pending link, and null when only revoked ones are left', () => {
    expect(openCoachLink([link('revoked'), link('active', 'x')])?.id).toBe('x')
    expect(openCoachLink([link('pending', 'p')])?.id).toBe('p')
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

test('linkDay is the local calendar day of the timestamp', () => {
  expect(linkDay(new Date(2026, 10, 21, 23, 30).toISOString())).toBe('21 nov')
  expect(linkDay(new Date(2026, 0, 5, 0, 10).toISOString())).toBe('5 gen')
})

test('linkSince is the day of the acceptance, or of the creation on rows without one', () => {
  const accepted = new Date(2026, 10, 22, 9, 0).toISOString()
  const created = new Date(2026, 10, 21, 9, 0).toISOString()
  expect(linkSince({ accepted_at: accepted, created_at: created })).toBe('22 nov')
  expect(linkSince({ accepted_at: null, created_at: created })).toBe('21 nov')
})
