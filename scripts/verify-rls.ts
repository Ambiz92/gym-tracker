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
 * RLS_TEST_OTHER_EMAIL and RLS_TEST_OTHER_PASSWORD, a second throw-away user WITHOUT a second
 * factor, add the cross-owner check of the session calendar (migration 0006): a scheduled_session
 * of the second user pointing at the first user's plan_session must be refused by the composite
 * key. It creates and deletes one 'rls-check' plan with a session for the first user.
 *
 * RLS_TEST_COACH_*, RLS_TEST_ATHLETE_* and RLS_TEST_STRANGER_* (EMAIL, PASSWORD) add the three-user checks of the
 * coach/athlete migrations (0007, 0008): see scripts/coachAthleteChecks.ts and scripts/README.md. The coach has a
 * verified TOTP factor and its base32 secret in RLS_TEST_COACH_TOTP_SECRET (without it only the aal1 refusals run).
 * RLS_TEST_BOTH_* (with RLS_TEST_BOTH_TOTP_SECRET) adds a user who is athlete and coach at once. The run leaves link
 * rows behind, which only postgres can delete; the next run says how.
 *
 * What this does NOT prove (follow-up manual tests, they need a logged-in session):
 *  - the restrictive *_mfa_if_enrolled policies on the other tables: an aal1 session is refused
 *    when the user has a verified factor and accepted when they have none, and aal2 works
 *    normally (scripts/README.md);
 *  - a coach WITHOUT a factor at aal1 (it can never accept a link through the API): rehearsal-0008, file 3b;
 * Update and delete probes filter on a nil id, so they only prove the operation is denied,
 * not that existing rows are unreachable.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { type Accounts, type FactorSession, coachAthleteChecks } from './coachAthleteChecks'
import {
  type Check,
  type Outcome,
  formatTable,
  isPrivilegedKey,
  judgeDuplicate,
  judgeForeignKey,
  judgeHiddenByPolicy,
  judgeOtp,
  judgeSelect,
  judgeSignUp,
  judgeSignedInRead,
  judgeWrite,
  publicTablesFrom,
} from './rlsAssertions'
import { totp } from './totp'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

// Minimal valid-looking rows: a rejection must come from access control, not from a constraint.
const PROBE_ROWS: Record<string, Record<string, unknown>> = {
  coach_athlete: { coach_id: NIL_UUID, athlete_label: 'rls-check' },
  exercise: { name: 'rls-check', equipment: 'other' },
  exercise_catalog: { slug: 'rls-check', name_it: 'rls-check', equipment: 'other', primary_muscle: 'rls-check' },
  plan: { name: 'rls-check' },
  plan_session: { plan_id: NIL_UUID, name: 'rls-check', position: 0 },
  plan_exercise: { session_id: NIL_UUID, exercise_id: NIL_UUID, position: 0, target_sets: 1, target_reps: 1 },
  warmup_item: { session_id: NIL_UUID, position: 0, name: 'rls-check' },
  workout: { session_name: 'rls-check' },
  scheduled_session: { session_name: 'rls-check', date: '2000-01-01' },
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

interface FactorUser extends TestUser {
  totpSecret: string | null
}

/** Like testUser, plus the base32 secret of the account's TOTP factor (`<prefix>_TOTP_SECRET`). */
function factorUser(prefix: string): FactorUser | null {
  const user = testUser(prefix)
  return user && { ...user, totpSecret: process.env[`${prefix}_TOTP_SECRET`] || null }
}

async function signIn({ email, password }: TestUser): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, clientOptions)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

async function userId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error(`Could not read the signed-in user: ${error?.message}`)
  return data.user.id
}

/** Password sign-in, then the TOTP step with a code computed from the secret: the returned client is at aal2. */
async function signInAal2(user: FactorUser & { totpSecret: string }): Promise<SupabaseClient> {
  const client = await signIn(user)
  const { data: factors, error: listError } = await client.auth.mfa.listFactors()
  const factor = factors?.totp[0]
  if (listError || !factor) throw new Error(`${user.email} has no verified TOTP factor: ${listError?.message ?? 'none listed'}`)
  // The codes of the neighbouring 30 s steps cover a few seconds of clock drift.
  for (const drift of [0, -30_000, 30_000]) {
    const challenge = await client.auth.mfa.challenge({ factorId: factor.id })
    if (challenge.error) throw new Error(`TOTP challenge failed for ${user.email}: ${challenge.error.message}`)
    const code = totp(user.totpSecret, Date.now() + drift)
    const verified = await client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code })
    if (!verified.error) return client
  }
  throw new Error(`The TOTP code for ${user.email} was refused: check the secret and the clock`)
}

async function factorSession(user: FactorUser): Promise<FactorSession> {
  const aal1 = await signIn(user)
  return { id: await userId(aal1), aal1, aal2: user.totpSecret ? await signInAal2({ ...user, totpSecret: user.totpSecret }) : null }
}

/** The three-user checks of the coach/athlete migrations; skipped when no fixture user is configured. */
async function coachAthleteSection(): Promise<Check[]> {
  const coach = factorUser('RLS_TEST_COACH')
  const athlete = testUser('RLS_TEST_ATHLETE')
  const stranger = testUser('RLS_TEST_STRANGER')
  const both = factorUser('RLS_TEST_BOTH')
  if (!coach && !athlete && !stranger && !both) {
    console.log('Coach/athlete checks skipped: set RLS_TEST_COACH_*, RLS_TEST_ATHLETE_* and RLS_TEST_STRANGER_* to run them.\n')
    return []
  }
  if (!coach || !athlete || !stranger) throw new Error('The coach/athlete checks need RLS_TEST_COACH_*, RLS_TEST_ATHLETE_* and RLS_TEST_STRANGER_* together')
  if (both && !(both.totpSecret && coach.totpSecret)) throw new Error('RLS_TEST_BOTH_* needs RLS_TEST_BOTH_TOTP_SECRET and RLS_TEST_COACH_TOTP_SECRET: it accepts requests as a coach')
  const athleteClient = await signIn(athlete)
  const strangerClient = await signIn(stranger)
  const accounts: Accounts = {
    coach: await factorSession(coach),
    athlete: { id: await userId(athleteClient), client: athleteClient },
    stranger: { id: await userId(strangerClient), client: strangerClient },
    both: both ? ((await factorSession(both)) as Accounts['both']) : null,
  }
  return coachAthleteChecks(accounts)
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

/** A calendar slot of `other` pointing at a plan session of `owner`: the composite key must refuse it. */
async function crossOwnerCheck(owner: SupabaseClient, other: SupabaseClient): Promise<Check> {
  const check = { target: 'scheduled_session', operation: "insert with another owner's plan_session_id" }
  const plan = await owner.from('plan').insert({ name: 'rls-check' }).select('id').single()
  if (plan.error) return { ...check, pass: false, detail: `plan insert failed, ${plan.error.message}` }
  const session = await owner
    .from('plan_session')
    .insert({ plan_id: plan.data.id, name: 'rls-check', position: 0 })
    .select('id')
    .single()

  let verdict: Pick<Check, 'pass' | 'detail'> = { pass: false, detail: `plan_session insert failed, ${session.error?.message}` }
  if (session.data) {
    const slot = { plan_session_id: session.data.id, session_name: 'rls-check', date: '2000-01-01' }
    // The same row is accepted for its owner, so the refusal below comes from the key, not from the row.
    const own = await owner.from('scheduled_session').insert(slot)
    verdict = own.error
      ? { pass: false, detail: `insert for the owner failed, ${own.error.message}` }
      : judgeForeignKey(await other.from('scheduled_session').insert(slot).select())
  }

  // Slots go first: deleting the plan would only null their plan_session_id.
  for (const client of [owner, other]) {
    const slots = await client.from('scheduled_session').delete().eq('session_name', 'rls-check')
    if (slots.error) return { ...check, pass: false, detail: `cleanup failed, ${slots.error.message}` }
  }
  const cleanup = await owner.from('plan').delete().eq('id', plan.data.id)
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
  const otherUser = testUser('RLS_TEST_OTHER')
  if (!user) {
    if (mfaUser || otherUser) throw new Error('RLS_TEST_MFA_* and RLS_TEST_OTHER_* need RLS_TEST_* too: they are compared with it')
    console.log('Signed-in checks skipped: set RLS_TEST_EMAIL and RLS_TEST_PASSWORD to run them.\n')
    return []
  }
  const client = await signIn(user)
  const { checks, seeded } = await signedInCatalogChecks(client)
  if (otherUser) checks.push(await crossOwnerCheck(client, await signIn(otherUser)))
  if (mfaUser) {
    const hidden = seeded
      ? judgeHiddenByPolicy(await (await signIn(mfaUser)).from('exercise_catalog').select('id'))
      : { pass: false, detail: 'the catalog is empty, so an empty result would prove nothing: seed it first' }
    checks.push({ target: 'exercise_catalog', operation: 'select (aal1, verified factor)', ...hidden })
  }
  return checks
}

const tables = await Promise.all(Object.entries(PROBE_ROWS).map(([table, row]) => tableChecks(table, row)))
const checks = [...tables.flat(), ...(await authChecks()), ...(await signedInChecks()), ...(await coachAthleteSection())]

console.log(formatTable(checks))
const failed = checks.filter((check) => !check.pass)
console.log(failed.length === 0 ? `\nAll ${checks.length} checks passed.` : `\n${failed.length} of ${checks.length} checks FAILED.`)
process.exit(failed.length === 0 ? 0 : 1)
