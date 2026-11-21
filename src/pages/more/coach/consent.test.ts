import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { CONSENT_TEXT_PLACEHOLDER, CONSENT_VERSION } from './consent'

test('the version shown is the one the database stores by default', () => {
  const migration = readFileSync(new URL('../../../../supabase/migrations/0007_coach_athlete.sql', import.meta.url), 'utf8')
  expect(migration).toContain(`consent_version text not null default '${CONSENT_VERSION}'`)
})

test('the placeholder says it is provisional and lists the notes and the past (S-A1-05)', () => {
  const { notice, items } = CONSENT_TEXT_PLACEHOLDER
  expect(notice).toMatch(/provvisorio/i)
  expect(items.join(' ')).toMatch(/note/)
  expect(items.join(' ')).toMatch(/prima del collegamento/)
})
