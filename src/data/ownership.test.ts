import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Guard for the owner filter: every query on a user's table goes through own() in client.ts, so a
// policy that lets someone read other owners' rows (a coach) cannot mix them into the user's data.
// No file under src may reach the raw supabase client except the ones allowlisted below.

const SRC_DIR = new URL('../', import.meta.url)

/** The files that define or fake the client itself, relative to src. */
const CLIENT_FILES = ['lib/supabase.ts', 'data/client.ts', 'data/fakeSupabase.ts']

interface ClientAllowance {
  /** The only member of the client the file may touch. */
  member: 'auth' | 'from'
  /** For `from`: the only tables it may open without own(): reference data every user shares. */
  tables?: string[]
}

/** Files allowed to use the raw client, relative to src. */
const ALLOWED: Record<string, ClientAllowance> = {
  'App.tsx': { member: 'auth' },
  'data/catalog.ts': { member: 'from', tables: ["'exercise_catalog'"] },
}

const RAW_CLIENT_MODULE = /(^|\/)lib\/supabase(\.[jt]sx?)?$/
const DATA_CLIENT_MODULE = /(^|\/)client(\.[jt]sx?)?$/
const STATIC_IMPORT = /\b(?:import|export)\s+(?:type\s+)?([\w$]+\s*,\s*)?(\*(?:\s*as\s+[\w$]+)?|\{[^}]*\}|[\w$]+)\s*from\s*(['"])([^'"]+)\3/g
const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g
const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/g

const stripComments = (code: string) => code.replace(COMMENT_OR_STRING, (match, str) => (str ? match : ' '))
const blankStrings = (code: string) => code.replace(COMMENT_OR_STRING, (_match, str) => (str ? '""' : ' '))

/**
 * Everything in `code` that reaches the raw supabase client outside what `allowance` permits.
 * Empty means clean. Works on source text, so it is stricter than it has to be: a local variable
 * called `supabase` counts too.
 */
export function clientViolations(code: string, allowance?: ClientAllowance): string[] {
  const violations: string[] = []
  const source = stripComments(code)

  for (const [, , bindings, , specifier] of source.matchAll(STATIC_IMPORT)) {
    if (specifier === '@supabase/supabase-js' && /\bcreateClient\b/.test(bindings)) violations.push('creates a second client')
    const isRaw = RAW_CLIENT_MODULE.test(specifier)
    if (!isRaw && !DATA_CLIENT_MODULE.test(specifier)) continue
    if (bindings.startsWith('*')) violations.push(`namespace import of '${specifier}' hides the client`)
    else if (!allowance && (isRaw || /\bsupabase\b/.test(bindings))) violations.push(`imports the raw client from '${specifier}'`)
  }
  for (const [, , specifier] of source.matchAll(DYNAMIC_IMPORT)) {
    if (RAW_CLIENT_MODULE.test(specifier) || DATA_CLIENT_MODULE.test(specifier)) violations.push(`dynamic import of '${specifier}'`)
  }

  const body = blankStrings(source.replace(STATIC_IMPORT, ''))
  if (/\.\s*rpc\b/.test(body) || /\[\s*(['"])rpc\1\s*\]/.test(source)) violations.push('uses rpc, which bypasses the owner filter')
  const member = allowance ? new RegExp(`^\\s*\\??\\.\\s*${allowance.member}\\b`) : null
  for (const match of body.matchAll(/(?<![\w$.])supabase\b/g)) {
    if (!member?.test(body.slice(match.index + match[0].length))) {
      violations.push(allowance ? `uses supabase beyond .${allowance.member}` : 'uses the supabase client')
      break
    }
  }
  if (allowance?.tables) {
    const opened = [...source.matchAll(/(?<!Array)\.from\(\s*([^)]*?)\s*\)/g)].map((match) => match[1])
    for (const table of opened) {
      if (!allowance.tables.includes(table)) violations.push(`opens ${table} without own()`)
    }
  }
  return violations
}

describe('clientViolations', () => {
  const clean = [
    ['own() through the data client', "import { own, unwrap } from './client'\nconst t = await own('plan')"],
    ['a type-only import of supabase-js', "import type { PostgrestError } from '@supabase/supabase-js'"],
    ['supabase only in comments and strings', "// uses supabase.from('plan')\nconst note = 'supabase.rpc'"],
    ['Array.from', 'const a = Array.from({ length: 3 })'],
  ]
  test.each(clean)('accepts %s', (_name, code) => {
    expect(clientViolations(code)).toEqual([])
  })

  const dirty = [
    ['a named import from the data client', "import { supabase } from './client'\nsupabase.from('plan')"],
    ['an aliased import', "import { own, supabase as db } from './client'"],
    ['an import from lib/supabase', "import { supabase } from '../lib/supabase'"],
    ['a namespace import', "import * as client from './client'\nclient.supabase.from('plan')"],
    ['a namespace import of lib/supabase', "import * as raw from '../lib/supabase'"],
    ['a re-export', "export { supabase } from './client'"],
    ['a star re-export', "export * from './client'"],
    ['a dynamic import', "const { supabase } = await import('../lib/supabase')"],
    ['a second client', "import { createClient } from '@supabase/supabase-js'"],
    ['destructuring from', 'const { from } = supabase'],
    ['bracket access', "supabase['from']('plan')"],
    ['bracket access to rpc', "client['rpc']('f')"],
    ['an rpc call', "await thing.rpc('f', {})"],
    ['a chained from', "await supabase\n  .from('plan')\n  .select()"],
  ] as [string, string][]
  test.each(dirty)('rejects %s', (_name, code) => {
    expect(clientViolations(code)).not.toEqual([])
  })

  describe('with an auth allowance', () => {
    const auth: ClientAllowance = { member: 'auth' }
    test('allows importing the client and using .auth', () => {
      expect(clientViolations("import { supabase } from './lib/supabase'\nuse(supabase.auth)", auth)).toEqual([])
      expect(clientViolations("import { supabase } from './lib/supabase'\nuse(supabase?.auth)", auth)).toEqual([])
    })

    test.each([
      ['queries', "supabase.from('plan').select()"],
      ['rpc', "supabase.rpc('f')"],
      ['bracket access', "supabase['from']('plan')"],
      ['destructuring', 'const { from } = supabase'],
      ['an alias', 'const db = supabase\ndb.from("plan")'],
      ['a namespace import', "import * as raw from './lib/supabase'"],
      ['a second client', "import { createClient } from '@supabase/supabase-js'"],
    ])('still rejects %s', (_name, code) => {
      expect(clientViolations(`import { supabase } from './lib/supabase'\n${code}`, auth)).not.toEqual([])
    })
  })

  describe('with a from allowance', () => {
    const catalog: ClientAllowance = { member: 'from', tables: ["'exercise_catalog'"] }
    const header = "import { own, supabase } from './client'\n"

    test('allows the shared table only', () => {
      expect(clientViolations(`${header}supabase.from('exercise_catalog').select()`, catalog)).toEqual([])
      expect(clientViolations(`${header}supabase.from('exercise').select()`, catalog)).toEqual(["opens 'exercise' without own()"])
      expect(clientViolations(`${header}supabase.from(table).select()`, catalog)).toEqual(['opens table without own()'])
    })

    test('does not allow auth or rpc', () => {
      expect(clientViolations(`${header}supabase.auth.signOut()`, catalog)).not.toEqual([])
      expect(clientViolations(`${header}supabase.rpc('f')`, catalog)).not.toEqual([])
    })
  })
})

const sources = (readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' }) as string[])
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.split('/').includes('node_modules'))
  .filter((path) => !CLIENT_FILES.includes(path))
  .map((path) => ({ path, code: readFileSync(new URL(path, SRC_DIR), 'utf8') }))

describe('ownership guard on the source tree', () => {
  test('sees the app files', () => {
    expect(sources.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['App.tsx', 'data/plans.ts', 'data/catalog.ts', 'data/export.ts', 'pages/Home.tsx']),
    )
    expect(sources.map(({ path }) => path)).not.toEqual(expect.arrayContaining(CLIENT_FILES))
  })

  test('every allowlisted file exists, so the allowlist cannot rot', () => {
    expect(Object.keys(ALLOWED).filter((file) => !sources.some(({ path }) => path === file))).toEqual([])
  })

  test.each(sources)('$path reaches the raw client only as allowlisted', ({ path, code }) => {
    expect(clientViolations(code, ALLOWED[path])).toEqual([])
  })

  test('the allowlisted files do use the client, so the allowance is needed', () => {
    for (const [file, allowance] of Object.entries(ALLOWED)) {
      const code = sources.find(({ path }) => path === file)!.code
      expect(clientViolations(code)).not.toEqual([])
      expect(clientViolations(code, allowance)).toEqual([])
    }
  })
})
