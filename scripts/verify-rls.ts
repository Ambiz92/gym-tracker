/**
 * Verifies that the public anon key, with no login, can neither read nor write any table,
 * and that the project refuses sign-ups. Run: `npm run verify:rls` with
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment
 * (for example `npx tsx --env-file=.env scripts/verify-rls.ts`).
 *
 * What this does NOT prove (follow-up manual tests, they need a logged-in session):
 *  - an authenticated user sees and changes only their own rows (auth.uid() = owner_id);
 *  - a session at aal1 (no TOTP challenge) is refused by the restrictive aal2 policies;
 *  - a session at aal2 can use the app normally.
 * Update and delete probes filter on a nil id, so they only prove the operation is denied,
 * not that existing rows are unreachable.
 */
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

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} (see .env.example)`)
  return value
}

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
