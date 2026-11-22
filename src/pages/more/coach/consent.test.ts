import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { CONSENT_TEXT, CONSENT_VERSION } from './consent'

test('the version shown is the one the database stores by default', () => {
  const migration = readFileSync(new URL('../../../../supabase/migrations/0007_coach_athlete.sql', import.meta.url), 'utf8')
  expect(migration).toContain(`consent_version text not null default '${CONSENT_VERSION}'`)
})

test('the text lists the notes and the past, says it is read-only and explains the revoke (S-A1-05)', () => {
  const { items, intro, revoke } = CONSENT_TEXT
  expect(intro).toMatch(/solo leggere/)
  expect(items.join(' ')).toMatch(/note/)
  expect(items.join(' ')).toMatch(/precedenti al collegamento/)
  expect(revoke).toMatch(/revochi/)
})
