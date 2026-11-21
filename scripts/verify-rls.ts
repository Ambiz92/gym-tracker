/**
 * Verifies that the public anon key, with no login, can neither read nor write any table,
 * and that the project refuses sign-ups. Run: `npm run verify:rls` (reads .env;
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY can also come from the environment).
 * It fails if a migration creates a table that PROBE_ROWS does not probe.
 *
 * Optional signed-in checks of the exercise catalog (migration 0005) run when RLS_TEST_EMAIL and
 * RLS_TEST_PASSWORD name a throw-away user WITHOUT a second factor (so its password session is
 * accepted): the catalog is readable, refuses writes, and a second copy of the same entry is
 * rejected. RLS_TEST_MFA_EMAIL and RLS_TEST_MFA_PASSWORD, a throw-away user WITH a verified
 * factor, add the aal2 check: its password-only session must see an empty catalog. The checks
 * insert and delete one 'rls-check' exercise for the first user.
 *
 * What this does NOT prove (follow-up manual tests, they need a logged-in session):
 *  - an authenticated user sees and changes only their own rows (auth.uid() = owner_id);
 *  - the restrictive *_mfa_if_enrolled policies on the other tables: an aal1 session is refused
 *    when the user has a verified factor and accepted when they have none, and aal2 works
 *    normally (scripts/README.md);
 * Update and delete probes filter on a nil id, so they only prove the operation is denied,
 * not that existing rows are unreachable.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import {
  type Check,
  type Outcome,
  formatTable,
  isPrivilegedKey,
  judgeDuplicate,
  judgeHiddenByPolicy,
  judgeOtp,
  judgeSelect,
  judgeSignUp,
  judgeSignedInRead,
  judgeWrite,
  publicTablesFrom,
} from './rlsAssertions'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

// Minimal valid-looking rows: a rejection must come from access control, not from a constraint.
const PROBE_ROWS: Record<string, Record<string, unknown>> = {
  exercise: { name: 'rls-check', equipment: 'other' },
  exercise_catalog: { slug: 'rls-check', name_it: 'rls-check', equipment: 'other', primary_muscle: 'rls-check' },
  plan: { name: 'rls-check' },
  plan_session: { plan_id: NIL_UUID, name: 'rls-check', position: 0 },
  plan_exercise: { session_id: NIL_UUID, exercise_id: NIL_UUID, position: 0, target_sets: 1, target_reps: 1 },
  warmup_item: { session_id: NIL_UUID, position: 0, name: 'rls-check' },
  workout: { session_name: 'rls-check' },
  set_log: {
    workout_id: NIL_UUID,
    exercise_id: NIL_UUID,
    set_number: 1,
    reps: 1,
    weight_kg: 0,
    equipment_used: 'other',
  },
}

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url)

/** A table the migrations create but this script does not probe would pass unnoticed. */
function assertProbesCoverMigrations(): void {
  const sql = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8'))
  const tables = publicTablesFrom(sql)
  const unprobed = tables.filter((table) => !(table in PROBE_ROWS))
  const unknown = Object.keys(PROBE_ROWS).filter((table) => !tables.includes(table))
  if (unprobed.length > 0) throw new Error(`Add a PROBE_ROWS entry for: ${unprobed.join(', ')}`)
  if (unknown.length > 0) throw new Error(`PROBE_ROWS names tables no migration creates: ${unknown.join(', ')}`)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} (see .env.example)`)
  return value
}

assertProbesCoverMigrations()
const url = requireEnv('VITE_SUPABASE_URL')
const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
if (isPrivilegedKey(anonKey)) {
  throw new Error('VITE_SUPABASE_ANON_KEY holds a privileged key: it bypasses RLS and would make this check meaningless')
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const supabase = createClient(url, anonKey, clientOptions)

function tableChecks(table: string, row: Record<string, unknown>): Promise<Check[]> {
  const probes: [string, PromiseLike<Outcome>, typeof judgeSelect][] = [
    ['select', supabase.from(table).select('*'), judgeSelect],
    ['insert', supabase.from(table).insert(row).select(), judgeWrite],
    ['update', supabase.from(table).update(row).eq('id', NIL_UUID).select(), judgeWrite],
    ['delete', supabase.from(table).delete().eq('id', NIL_UUID).select(), judgeWrite],
  ]
  return Promise.all(
    probes.map(async ([operation, probe, judge]) => ({ target: table, operation, ...judge(await probe) })),
  )
}

async function authChecks(): Promise<Check[]> {
  // The reserved .invalid TLD guarantees no real mailbox is ever contacted.
  const email = `rls-check-${Date.now()}@example.invalid`
  const signUp = await supabase.auth.signUp({ email, password: crypto.randomUUID() })
  const otp = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  return [
    { target: 'auth', operation: 'signUp', ...judgeSignUp(signUp) },
    { target: 'auth', operation: 'signInWithOtp', ...judgeOtp(otp) },
  ]
}

interface TestUser {
  email: string
  password: string
}

/** Credentials from `<prefix>_EMAIL` and `<prefix>_PASSWORD`; null when neither is set. */
function testUser(prefix: string): TestUser | null {
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!email && !password) return null
  if (!email || !password) throw new Error(`Set both ${prefix}_EMAIL and ${prefix}_PASSWORD, or neither`)
  return { email, password }
}

async function signIn({ email, password }: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, clientOptions)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

/** Two inserts of the same catalog entry for one owner: the second must hit the unique index. */
async function duplicateCheck(client: SupabaseClient, catalogId: string | undefined): Promise<Check> {
  const check = { target: 'exercise', operation: 'insert twice, same catalog entry' }
  if (!catalogId) return { ...check, pass: false, detail: 'no catalog entry to adopt: seed the catalog first' }
  const row = { name: 'rls-check', equipment: 'other', catalog_id: catalogId }
  const first = await client.from('exercise').insert(row)
  if (first.error) return { ...check, pass: false, detail: `first insert failed, ${first.error.message}` }
  const verdict = judgeDuplicate(await client.from('exercise').insert(row))
  const cleanup = await client.from('exercise').delete().eq('catalog_id', catalogId).eq('name', row.name)
  if (cleanup.error) return { ...check, pass: false, detail: `cleanup failed, ${cleanup.error.message}` }
  return { ...check, ...verdict }
}

/** Catalog checks for a signed-in user whose session the policies accept. */
async function signedInCatalogChecks(client: SupabaseClient): Promise<{ checks: Check[]; seeded: boolean }> {
  const row = PROBE_ROWS.exercise_catalog
  const read = await client.from('exercise_catalog').select('id')
  const catalogId = (read.data as { id: string }[] | null)?.[0]?.id
  const writes: [string, PromiseLike<Outcome>][] = [
    ['insert', client.from('exercise_catalog').insert(row).select()],
    ['update', client.from('exercise_catalog').update(row).eq('id', NIL_UUID).select()],
    ['delete', client.from('exercise_catalog').delete().eq('id', NIL_UUID).select()],
  ]
  const checks: Check[] = [{ target: 'exercise_catalog', operation: 'select (signed in)', ...judgeSignedInRead(read) }]
  for (const [operation, probe] of writes) {
    checks.push({ target: 'exercise_catalog', operation: `${operation} (signed in)`, ...judgeWrite(await probe) })
  }
  checks.push(await duplicateCheck(client, catalogId))
  return { checks, seeded: catalogId !== undefined }
}

async function signedInChecks(): Promise<Check[]> {
  const user = testUser('RLS_TEST')
  const mfaUser = testUser('RLS_TEST_MFA')
  if (!user) {
    if (mfaUser) throw new Error('RLS_TEST_MFA_* needs RLS_TEST_* too: it is compared with a user who can read the catalog')
    console.log('Signed-in catalog checks skipped: set RLS_TEST_EMAIL and RLS_TEST_PASSWORD to run them.\n')
    return []
  }
  const { checks, seeded } = await signedInCatalogChecks(await signIn(user))
  if (!mfaUser) return checks
  const hidden = seeded
    ? judgeHiddenByPolicy(await (await signIn(mfaUser)).from('exercise_catalog').select('id'))
    : { pass: false, detail: 'the catalog is empty, so an empty result would prove nothing: seed it first' }
  return [...checks, { target: 'exercise_catalog', operation: 'select (aal1, verified factor)', ...hidden }]
}

const tables = await Promise.all(Object.entries(PROBE_ROWS).map(([table, row]) => tableChecks(table, row)))
const checks = [...tables.flat(), ...(await authChecks()), ...(await signedInChecks())]

console.log(formatTable(checks))
const failed = checks.filter((check) => !check.pass)
console.log(failed.length === 0 ? `\nAll ${checks.length} checks passed.` : `\n${failed.length} of ${checks.length} checks FAILED.`)
process.exit(failed.length === 0 ? 0 : 1)
