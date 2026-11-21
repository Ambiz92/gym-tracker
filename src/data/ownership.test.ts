import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Guard for the owner filter: every query on a user's table goes through own() in client.ts, so a
// policy that lets someone read other owners' rows (a coach) cannot mix them into the user's data.

const DATA_DIR = new URL('.', import.meta.url)

/** Tables read without an owner filter, by file: reference data every user shares. */
const UNOWNED = { 'catalog.ts': ["'exercise_catalog'"] } as Record<string, string[]>

const sources = readdirSync(DATA_DIR)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'client.ts' && name !== 'fakeSupabase.ts')
  .map((name) => ({ name, code: readFileSync(new URL(name, DATA_DIR), 'utf8') }))

const tablesOpened = (code: string) => [...code.matchAll(/(?<!Array)\.from\(\s*([^)]*?)\s*\)/g)].map((match) => match[1])

describe('data layer ownership guard', () => {
  test('sees the data files', () => {
    expect(sources.map(({ name }) => name)).toEqual(expect.arrayContaining(['plans.ts', 'catalog.ts', 'export.ts']))
  })

  test.each(sources)('$name opens tables only through own() or the unowned allowlist', ({ name, code }) => {
    expect(tablesOpened(code).filter((table) => !(UNOWNED[name] ?? []).includes(table))).toEqual([])
  })

  test.each(sources)('$name does not reach the raw client except where allowlisted', ({ name, code }) => {
    const rawImport = /import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*'\.\/client'|from\s*'\.\.\/lib\/supabase'/.test(code)
    expect(rawImport).toBe(name in UNOWNED)
  })

  test('rpc calls are not used: they would bypass the filter', () => {
    expect(sources.filter(({ code }) => /\.rpc\(/.test(code))).toEqual([])
  })
})
