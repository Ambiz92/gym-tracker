/**
 * Verifies that the public anon key, with no login, can neither read nor write any table,
 * and that the project refuses sign-ups. Run: `npm run verify:rls` (reads .env;
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY can also come from the environment).
 * It fails if a migration creates a table that PROBE_ROWS does not probe.
 *
 * What this does NOT prove (follow-up manual tests, they need a logged-in session):
 *  - an authenticated user sees and changes only their own rows (auth.uid() = owner_id);
 *  - the restrictive *_mfa_if_enrolled policies: an aal1 session is refused when the user has a
 *    verified factor and accepted when they have none, and aal2 works normally (scripts/README.md);
 * Update and delete probes filter on a nil id, so they only prove the operation is denied,
 * not that existing rows are unreachable.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  type Check,
  type Outcome,
  formatTable,
  isPrivilegedKey,
  judgeOtp,
  judgeSelect,
  judgeSignUp,
  judgeWrite,
  publicTablesFrom,
} from './rlsAssertions'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

// Minimal valid-looking rows: a rejection must come from access control, not from a constraint.
const PROBE_ROWS: Record<string, Record<string, unknown>> = {
  exercise: { name: 'rls-check', equipment: 'other' },
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

const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

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

const tables = await Promise.all(Object.entries(PROBE_ROWS).map(([table, row]) => tableChecks(table, row)))
const checks = [...tables.flat(), ...(await authChecks())]

console.log(formatTable(checks))
const failed = checks.filter((check) => !check.pass)
console.log(failed.length === 0 ? `\nAll ${checks.length} checks passed.` : `\n${failed.length} of ${checks.length} checks FAILED.`)
process.exit(failed.length === 0 ? 0 : 1)
