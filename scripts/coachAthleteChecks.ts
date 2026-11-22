/**
 * Signed-in checks of the coach/athlete tables (migrations 0007 and 0008), with throw-away users:
 * a coach (verified TOTP factor), a linked athlete and a stranger, plus optionally a user who is both
 * (T-06, T-11, T-12). Ids of the checks (T-xx) are those of workspace/security/S-A1.md.
 *
 * coach_athlete rows cannot be deleted by any client (the row is the consent record), and a revoked pair
 * can never be requested again. A run therefore leaves link rows behind, and the next run refuses to
 * start until they are removed as postgres: the error message prints a statement limited to the rows it created.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyTotp } from './mfa'
import {
  type Check,
  judgeAccepted,
  judgeDuplicate,
  judgeForeignKey,
  judgeHiddenByPolicy,
  judgeNoRowsWritten,
  judgeOnlyOwners,
  judgePermissionDenied,
  judgeRefusedTransition,
  judgeRlsRefusal,
  judgeRowIds,
  judgeRowUnchanged,
  judgeVisibleRows,
  type LinkEnds,
  isTestLink,
  testLinkCleanupStatement,
} from './rlsAssertions'

type Verdict = Pick<Check, 'pass' | 'detail'>

export interface Session {
  id: string
  client: SupabaseClient
}

/** An account with a second factor: `client` is the password session (aal1), `aal2` the one after the TOTP step. */
export interface FactorSession {
  id: string
  aal1: SupabaseClient
  aal2: SupabaseClient | null
}

export interface Accounts {
  coach: FactorSession
  athlete: Session
  stranger: Session
  /** A fresh password session (aal1) of the stranger. */
  signInStranger: () => Promise<SupabaseClient>
  /** Both roles at once; it accepts requests as a coach, so it needs a coach with `aal2` too. */
  both: (FactorSession & { aal2: SupabaseClient }) | null
}

const DATA_TABLES = ['exercise', 'plan', 'plan_session', 'plan_exercise', 'warmup_item', 'workout', 'set_log', 'scheduled_session'] as const
type DataTable = (typeof DATA_TABLES)[number]
type Ids = Record<DataTable, string>

const TAG = 'rls-check-coach'
const LABEL = 'rls-check'

async function insertOne(client: SupabaseClient, table: DataTable, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select('id').single()
  if (error) throw new Error(`Seeding ${table} failed: ${error.message}`)
  return (data as { id: string }).id
}

/** One tagged row in each of the eight tables, owned by the client's user. */
async function seedData(client: SupabaseClient): Promise<Ids> {
  const exercise = await insertOne(client, 'exercise', { name: TAG, equipment: 'other', notes: TAG })
  const plan = await insertOne(client, 'plan', { name: TAG })
  const planSession = await insertOne(client, 'plan_session', { plan_id: plan, name: TAG, position: 0 })
  const planExercise = await insertOne(client, 'plan_exercise', { session_id: planSession, exercise_id: exercise, position: 0, target_sets: 1, target_reps: 1 })
  const warmup = await insertOne(client, 'warmup_item', { session_id: planSession, position: 0, name: TAG })
  const workout = await insertOne(client, 'workout', { session_name: TAG, notes: TAG })
  const setLog = await insertOne(client, 'set_log', { workout_id: workout, exercise_id: exercise, set_number: 1, reps: 1, weight_kg: 0, equipment_used: 'other' })
  const slot = await insertOne(client, 'scheduled_session', { plan_session_id: planSession, session_name: TAG, date: '2000-01-01' })
  return { exercise, plan, plan_session: planSession, plan_exercise: planExercise, warmup_item: warmup, workout, set_log: setLog, scheduled_session: slot }
}

/** Deletes the tagged rows of the client's user. The plan takes its sessions, exercises and warm-up with it. */
async function purgeData(client: SupabaseClient): Promise<void> {
  const steps: [string, string, string][] = [
    ['scheduled_session', 'session_name', TAG],
    ['workout', 'session_name', TAG],
    ['plan', 'name', TAG],
    ['exercise', 'name', TAG],
  ]
  for (const [table, column, value] of steps) {
    const { error } = await client.from(table).delete().eq(column, value)
    if (error) throw new Error(`Cleaning ${table} failed: ${error.message}`)
  }
}

function insertFor(table: DataTable, ownerId: string, ids: Ids): Record<string, unknown> {
  const rows: Record<DataTable, Record<string, unknown>> = {
    exercise: { name: 'rls-check-w', equipment: 'other' },
    plan: { name: 'rls-check-w' },
    plan_session: { plan_id: ids.plan, name: 'rls-check-w', position: 9 },
    plan_exercise: { session_id: ids.plan_session, exercise_id: ids.exercise, position: 9, target_sets: 1, target_reps: 1 },
    warmup_item: { session_id: ids.plan_session, position: 9, name: 'rls-check-w' },
    workout: { session_name: 'rls-check-w' },
    set_log: { workout_id: ids.workout, exercise_id: ids.exercise, set_number: 9, reps: 1, weight_kg: 0, equipment_used: 'other' },
    scheduled_session: { session_name: 'rls-check-w', date: '2000-01-02' },
  }
  return { ...rows[table], owner_id: ownerId }
}

const readTable = (client: SupabaseClient, table: string, ownerId: string) => client.from(table).select('id, owner_id').eq('owner_id', ownerId)

interface LinkRow {
  id: string
  coach_id: string
  athlete_id: string
  status: string
  accepted_at: string | null
}

async function readLinks(client: SupabaseClient, filter: Partial<Pick<LinkRow, 'coach_id' | 'athlete_id'>>): Promise<LinkRow[]> {
  let query = client.from('coach_athlete').select('*')
  for (const [column, value] of Object.entries(filter)) query = query.eq(column, value)
  const { data, error } = await query
  if (error) throw new Error(`Reading coach_athlete failed: ${error.message}`)
  return data as LinkRow[]
}

/** Runs one probe on every data table and folds the verdicts into one check naming the tables that failed. */
async function onEveryTable(operation: string, probe: (table: DataTable) => PromiseLike<Verdict>): Promise<Check> {
  const results = await Promise.all(DATA_TABLES.map(async (table) => [table, await probe(table)] as const))
  const failed = results.filter(([, verdict]) => !verdict.pass)
  const detail = failed.length === 0 ? `all ${DATA_TABLES.length} tables` : failed.map(([table, verdict]) => `${table}: ${verdict.detail}`).join('; ')
  return { target: 'data tables', operation, pass: failed.length === 0, detail }
}

const hidden = (client: SupabaseClient, ownerId: string) => async (table: DataTable) => judgeHiddenByPolicy(await readTable(client, table, ownerId))
const visible = (client: SupabaseClient, ownerId: string, rows: number) => async (table: DataTable) =>
  judgeVisibleRows(await readTable(client, table, ownerId), ownerId, rows)

/**
 * The leftovers of an earlier run would break the sequence (a revoked pair cannot be requested again): stop with a cleanup
 * statement limited to the rows this script creates. A link that is not a test row is never offered for deletion.
 */
async function assertNoLeftovers(readers: SupabaseClient[], userIds: string[]): Promise<void> {
  for (const client of readers) {
    const { data, error } = await client.from('coach_athlete').select('id, coach_id, athlete_id, athlete_label')
    if (error) throw new Error(`Reading coach_athlete failed: ${error.message}`)
    const rows = (data ?? []) as (LinkEnds & { id: string })[]
    if (rows.length === 0) continue
    const foreign = rows.filter((row) => !isTestLink(row, userIds, LABEL))
    if (foreign.length > 0) {
      throw new Error(
        `A fixture user has coach_athlete rows that are not test rows (ids ${foreign.map((row) => row.id).join(', ')}). ` +
          'They may belong to a real account: use fixture users that only this script touches.',
      )
    }
    throw new Error(
      `coach_athlete rows of an earlier run exist. As postgres, in the SQL editor, delete them (the clients cannot):\n` +
        `  ${testLinkCleanupStatement(userIds, LABEL)}`,
    )
  }
}

export async function coachAthleteChecks(accounts: Accounts): Promise<Check[]> {
  const { coach, athlete, stranger, signInStranger, both } = accounts
  const checks: Check[] = []
  const add = (target: string, operation: string, verdict: Verdict) => {
    checks.push({ target, operation, ...verdict })
  }
  const userIds = [coach.id, athlete.id, stranger.id, ...(both ? [both.id] : [])]
  await assertNoLeftovers([athlete.client, stranger.client, ...(coach.aal2 ? [coach.aal2] : [])], userIds)

  // Every account that seeds rows, so every account is cleaned.
  const writers = [athlete.client, ...(both && coach.aal2 ? [stranger.client, coach.aal2, both.aal2] : [])]
  for (const client of writers) await purgeData(client)

  try {
    await run()
  } catch (error) {
    // Keep the verdicts collected so far: a hole in an early step often makes the later setup fail too.
    add('scenario', 'aborted', { pass: false, detail: error instanceof Error ? error.message : String(error) })
  } finally {
    try {
      for (const client of writers) await purgeData(client)
    } catch (error) {
      add('cleanup', 'delete the tagged rows', { pass: false, detail: error instanceof Error ? error.message : String(error) })
    }
  }
  return checks

  async function run(): Promise<void> {
    const ids = await seedData(athlete.client)
    checks.push(await onEveryTable('athlete reads own seeded rows', visible(athlete.client, athlete.id, 1)))

    // Before any link nobody else reads the athlete's rows.
    if (coach.aal2) checks.push(await onEveryTable('T-02 unlinked coach (aal2) reads the athlete', hidden(coach.aal2, athlete.id)))
    checks.push(await onEveryTable('T-02 stranger reads the athlete', hidden(stranger.client, athlete.id)))

    const link = await request()
    if (!coach.aal2) {
      await refusedWithoutAal2(link)
      console.log('Coach checks at aal2 skipped: set RLS_TEST_COACH_TOTP_SECRET to run them.\n')
      return
    }
    await strangerAndAthleteAttacks(link)
    await coachBeforeAccept(link)
    await accept(link)
    await coachReadsAndWrites(ids, link)
    await athleteRevokes(link)
    const strangerLink = await coachWithoutFactor()
    if (both && coach.aal2) await bothRoles(both)
    await coachWithoutFactorActiveLink(strangerLink)
  }

  /** T-03: the athlete asks the coach; extra columns and a second open request are refused. */
  async function request(): Promise<LinkRow> {
    const link = await requestFrom(athlete.client, athlete.id, coach.id, 'T-03 athlete')
    add('coach_athlete', 'request starts pending, without dates', { pass: link.status === 'pending' && link.accepted_at === null, detail: `status ${link.status}, accepted_at ${link.accepted_at}` })
    add('coach_athlete', 'T-03 second open request to anyone', judgeDuplicate(await athlete.client.from('coach_athlete').insert({ coach_id: stranger.id }).select()))
    const forged: [string, Record<string, unknown>][] = [
      ['with status active', { coach_id: stranger.id, status: 'active' }],
      ['with accepted_at', { coach_id: stranger.id, accepted_at: new Date().toISOString() }],
      ['with another athlete_id', { coach_id: coach.id, athlete_id: stranger.id }],
    ]
    for (const [name, row] of forged) {
      add('coach_athlete', `T-03 athlete inserts a request ${name}`, judgePermissionDenied(await athlete.client.from('coach_athlete').insert(row).select()))
    }
    return link
  }

  /** Inserts a request as `client` (the athlete) and reads the new row back. */
  async function requestFrom(client: SupabaseClient, athleteId: string, coachId: string, name: string): Promise<LinkRow> {
    const sent = await client.from('coach_athlete').insert({ coach_id: coachId, athlete_label: LABEL }).select()
    add('coach_athlete', `${name} requests`, judgeAccepted(sent))
    const link = (await readLinks(client, { athlete_id: athleteId, coach_id: coachId }))[0]
    if (!link) throw new Error(`${name}: the request row is missing, the rest of the scenario cannot run`)
    return link
  }

  async function statusOf(id: string): Promise<string | undefined> {
    return (await readLinks(athlete.client, { athlete_id: athlete.id })).find((row) => row.id === id)?.status
  }

  /** T-16 without aal2: a password-only coach session cannot accept. */
  async function refusedWithoutAal2(link: LinkRow): Promise<void> {
    const update = await coach.aal1.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'T-16 coach accepts at aal1', judgeRefusedTransition(update, 'pending', await statusOf(link.id)))
  }

  /** T-02 enumeration, T-04 and T-13 on the athlete side. */
  async function strangerAndAthleteAttacks(link: LinkRow): Promise<void> {
    const before = await readLinks(athlete.client, { athlete_id: athlete.id })
    add('coach_athlete', 'T-02 stranger lists links', judgeHiddenByPolicy(await stranger.client.from('coach_athlete').select('*')))
    add('coach_athlete', 'stranger revokes the request', judgeNoRowsWritten(await stranger.client.from('coach_athlete').update({ status: 'revoked' }).eq('id', link.id).select()))
    add('coach_athlete', 'T-13 stranger deletes the request', judgePermissionDenied(await stranger.client.from('coach_athlete').delete().eq('id', link.id).select()))

    const activate = await athlete.client.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'T-04 athlete activates own request', judgeRefusedTransition(activate, 'pending', await statusOf(link.id)))
    // S-A1-01: the athlete rewrites the request into an active link where they are the coach of someone else.
    const forged = await athlete.client.from('coach_athlete').update({ coach_id: athlete.id, athlete_id: stranger.id, status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'S-A1-01 athlete rewrites own row into an active coach row', judgePermissionDenied(forged))
    const columns: [string, Record<string, unknown>][] = [
      ['coach_id', { coach_id: stranger.id }],
      ['athlete_id', { athlete_id: stranger.id }],
      ['athlete_label', { athlete_label: 'other' }],
      ['accepted_at', { accepted_at: new Date().toISOString() }],
    ]
    for (const [column, change] of columns) {
      add('coach_athlete', `T-04 athlete changes ${column}`, judgePermissionDenied(await athlete.client.from('coach_athlete').update(change).eq('id', link.id).select()))
    }
    add('coach_athlete', 'T-13 athlete deletes the request', judgePermissionDenied(await athlete.client.from('coach_athlete').delete().eq('id', link.id).select()))
    add('coach_athlete', 'row unchanged after the attacks', judgeRowUnchanged(before, await readLinks(athlete.client, { athlete_id: athlete.id })))
  }

  /** T-05, T-08 and T-16 while the link is still pending. */
  async function coachBeforeAccept(link: LinkRow): Promise<void> {
    const aal2 = coach.aal2 as SupabaseClient
    const before = await readLinks(athlete.client, { athlete_id: athlete.id })
    add('coach_athlete', 'coach (aal2) sees the pending request', judgeRowIds(await aal2.from('coach_athlete').select('id').eq('coach_id', coach.id), [link.id]))
    const patches: [string, Record<string, unknown>][] = [
      ['athlete_id', { athlete_id: stranger.id }],
      ['coach_id', { coach_id: stranger.id }],
      ['athlete_id and status', { athlete_id: stranger.id, status: 'active' }],
      ['athlete_label', { athlete_label: 'other' }],
      ['accepted_at', { accepted_at: '2000-01-01T00:00:00Z' }],
    ]
    for (const [name, patch] of patches) {
      add('coach_athlete', `T-05 coach patches ${name}`, judgePermissionDenied(await aal2.from('coach_athlete').update(patch).eq('id', link.id).select()))
    }
    add('coach_athlete', 'T-13 coach deletes the request', judgePermissionDenied(await aal2.from('coach_athlete').delete().eq('id', link.id).select()))
    add('coach_athlete', 'row unchanged after the coach attacks', judgeRowUnchanged(before, await readLinks(athlete.client, { athlete_id: athlete.id })))
    checks.push(await onEveryTable('T-08 coach (aal2) reads the athlete while pending', hidden(aal2, athlete.id)))
    await refusedWithoutAal2(link)
  }

  async function accept(link: LinkRow): Promise<void> {
    const aal2 = coach.aal2 as SupabaseClient
    add('coach_athlete', 'coach accepts at aal2', judgeAccepted(await aal2.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()))
    const accepted = (await readLinks(athlete.client, { athlete_id: athlete.id }))[0]
    add('coach_athlete', 'accept sets accepted_at', { pass: accepted?.status === 'active' && accepted.accepted_at !== null, detail: `status ${accepted?.status}, accepted_at ${accepted?.accepted_at}` })
  }

  /** T-07, T-10 and T-14 with the link active. */
  async function coachReadsAndWrites(ids: Ids, link: LinkRow): Promise<void> {
    const aal2 = coach.aal2 as SupabaseClient
    const snapshot = async () => Promise.all(DATA_TABLES.map(async (table) => (await athlete.client.from(table).select('*').eq('owner_id', athlete.id)).data))

    checks.push(await onEveryTable('T-07 coach (aal2) reads the athlete', visible(aal2, athlete.id, 1)))
    checks.push(await onEveryTable('T-07 coach (aal2) sees only the coach and the athlete', async (table) => judgeOnlyOwners(await aal2.from(table).select('id, owner_id'), [coach.id, athlete.id])))
    checks.push(await onEveryTable('T-07 coach at aal1 (with a factor) reads the athlete', hidden(coach.aal1, athlete.id)))
    checks.push(await onEveryTable('T-02 stranger still reads nothing', hidden(stranger.client, athlete.id)))
    const notes = await aal2.from('workout').select('notes').eq('owner_id', athlete.id)
    add('workout', 'coach reads the free-text notes', { pass: (notes.data as { notes: string }[] | null)?.[0]?.notes === TAG, detail: JSON.stringify(notes.data ?? notes.error) })
    checks.push(await onEveryTable("T-14 coach read filtered on its own id returns only the coach's rows", visible(aal2, coach.id, 0)))

    const before = await snapshot()
    checks.push(await onEveryTable('T-10 coach inserts a row with the athlete owner_id', async (table) => judgeRlsRefusal(await aal2.from(table).insert(insertFor(table, athlete.id, ids)).select())))
    checks.push(await onEveryTable('T-10 coach moves an athlete row to the coach', async (table) => judgeNoRowsWritten(await aal2.from(table).update({ owner_id: coach.id }).eq('id', ids[table]).select())))
    checks.push(await onEveryTable('T-10 coach deletes an athlete row', async (table) => judgeNoRowsWritten(await aal2.from(table).delete().eq('id', ids[table]).select())))
    add('workout', 'T-10 coach upserts on an athlete workout id', judgeRlsRefusal(await aal2.from('workout').upsert({ id: ids.workout, owner_id: coach.id, session_name: 'rls-check-w' }, { onConflict: 'id' }).select()))
    const pointing = { workout_id: ids.workout, exercise_id: ids.exercise, set_number: 9, reps: 1, weight_kg: 0, equipment_used: 'other' }
    add('set_log', 'T-10 coach set_log pointing at an athlete workout', judgeForeignKey(await aal2.from('set_log').insert(pointing).select()))
    add('data tables', 'T-10 athlete rows unchanged after every attempt', judgeRowUnchanged(before, await snapshot()))
    add('coach_athlete', 'link still active after the coach attempts', { pass: (await statusOf(link.id)) === 'active', detail: `status ${await statusOf(link.id)}` })
  }

  /** T-09 (athlete side) and T-15. */
  async function athleteRevokes(link: LinkRow): Promise<void> {
    const aal2 = coach.aal2 as SupabaseClient
    add('coach_athlete', 'athlete revokes', judgeAccepted(await athlete.client.from('coach_athlete').update({ status: 'revoked' }).eq('id', link.id).select()))
    checks.push(await onEveryTable('T-09 coach reads the athlete after the revoke', hidden(aal2, athlete.id)))
    const reactivate = await aal2.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'T-09 coach reactivates after the revoke', judgeRefusedTransition(reactivate, 'revoked', await statusOf(link.id)))
    checks.push(await onEveryTable('T-09 coach reads the athlete after the reactivation attempt', hidden(aal2, athlete.id)))
    const own = await athlete.client.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'athlete reactivates after the revoke', judgeRefusedTransition(own, 'revoked', await statusOf(link.id)))
    add('coach_athlete', 'T-15 athlete requests the same coach again', judgeDuplicate(await athlete.client.from('coach_athlete').insert({ coach_id: coach.id }).select()))
    checks.push(await onEveryTable('athlete still reads own rows after the revoke', visible(athlete.client, athlete.id, 1)))
  }

  /**
   * S-A1-03: a coach with no second factor cannot accept at aal1. The stranger has no factor, so the athlete (free
   * again after the revoke) asks the stranger. The link stays pending, so the empty read below proves nothing about
   * the aal2 term of the read policies: that is `coachWithoutFactorActiveLink`.
   */
  async function coachWithoutFactor(): Promise<LinkRow> {
    const link = await requestFrom(athlete.client, athlete.id, stranger.id, 'athlete (again) to a coach without a factor')
    const accepted = await stranger.client.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
    add('coach_athlete', 'S-A1-03 coach without a factor accepts at aal1', judgeRefusedTransition(accepted, 'pending', await statusOf(link.id)))
    checks.push(await onEveryTable('S-A1-03 coach without a factor reads the athlete through a pending link', hidden(stranger.client, athlete.id)))
    return link
  }

  /**
   * S-A2-04: the aal2 term of the read policies on its own. A coach reaches an active link only at aal2, so the
   * stranger enrols a throw-away factor, accepts at aal2 and removes the factor again. Without a factor the
   * *_mfa_if_enrolled policy hides nothing at aal1, so only the aal2 term keeps the athlete's rows out.
   */
  async function coachWithoutFactorActiveLink(link: LinkRow): Promise<void> {
    const enrolled = await stranger.client.auth.mfa.enroll({ factorType: 'totp' })
    if (enrolled.error) throw new Error(`The stranger could not enrol a throw-away factor: ${enrolled.error.message}`)
    const factorId = enrolled.data.id
    try {
      await verifyTotp(stranger.client, factorId, enrolled.data.totp.secret, 'the stranger')
      const accepted = await stranger.client.from('coach_athlete').update({ status: 'active' }).eq('id', link.id).select()
      add('coach_athlete', 'S-A2-04 coach accepts at aal2 with a throw-away factor', judgeAccepted(accepted))
      // Without a working active link an empty read at aal1 would prove nothing.
      if ((await statusOf(link.id)) !== 'active') throw new Error('The link is not active: the aal1 read cannot be judged')
      checks.push(await onEveryTable('S-A2-04 coach (aal2) reads the athlete through the active link', visible(stranger.client, athlete.id, 1)))
    } finally {
      const removed = await stranger.client.auth.mfa.unenroll({ factorId })
      if (removed.error) {
        add('cleanup', 'remove the stranger factor', { pass: false, detail: `${removed.error.message}: remove the factor in the dashboard, the stranger must have none` })
      }
    }
    const aal1 = await signInStranger()
    checks.push(await onEveryTable('S-A2-04 coach without a factor reads the athlete at aal1 through an active link', hidden(aal1, athlete.id)))
  }

  /**
   * A user who is both: athlete of the coach (the coach accepts), coach of the stranger (accepts), and
   * on both sides of a mutual link with the coach. T-06, T-09 (coach side), T-11, T-12.
   */
  async function bothRoles(b: NonNullable<Accounts['both']>): Promise<void> {
    const aal2 = coach.aal2 as SupabaseClient
    await seedData(b.aal2)
    await seedData(stranger.client)
    await seedData(aal2)

    const coachOfB = await requestFrom(b.aal2, b.id, coach.id, 'both-roles user (athlete)')
    add('coach_athlete', 'coach accepts the both-roles user', judgeAccepted(await aal2.from('coach_athlete').update({ status: 'active' }).eq('id', coachOfB.id).select()))

    const bOfStranger = await requestFrom(stranger.client, stranger.id, b.id, 'stranger (athlete of the both-roles user)')
    add('coach_athlete', 'both-roles user accepts the stranger as athlete', judgeAccepted(await b.aal2.from('coach_athlete').update({ status: 'active' }).eq('id', bOfStranger.id).select()))

    const rewrite = await b.aal2.from('coach_athlete').update({ coach_id: b.id, athlete_id: athlete.id, status: 'active' }).eq('athlete_id', b.id).select()
    add('coach_athlete', 'T-06 both-roles user rewrites own athlete row into a coach row', judgePermissionDenied(rewrite))
    checks.push(await onEveryTable('T-06 both-roles user then reads the third user', hidden(b.aal2, athlete.id)))

    checks.push(await onEveryTable('T-11 coach reads the both-roles user', visible(aal2, b.id, 1)))
    checks.push(await onEveryTable('T-11 coach does not read the stranger through the both-roles user', hidden(aal2, stranger.id)))
    checks.push(await onEveryTable('T-11 both-roles user reads the stranger', visible(b.aal2, stranger.id, 1)))
    checks.push(await onEveryTable('T-11 both-roles user sees only itself, the stranger and the coach', async (table) => judgeOnlyOwners(await b.aal2.from(table).select('id, owner_id'), [b.id, stranger.id, coach.id])))

    const mutual = await requestFrom(aal2, coach.id, b.id, 'T-12 coach (athlete of the both-roles user)')
    add('coach_athlete', 'T-12 both-roles user accepts', judgeAccepted(await b.aal2.from('coach_athlete').update({ status: 'active' }).eq('id', mutual.id).select()))
    checks.push(await onEveryTable('T-12 both-roles user reads the coach', visible(b.aal2, coach.id, 1)))
    checks.push(await onEveryTable('T-12 coach reads the both-roles user', visible(aal2, b.id, 1)))
    checks.push(await onEveryTable('T-12 coach sees only itself and the both-roles user', async (table) => judgeOnlyOwners(await aal2.from(table).select('id, owner_id'), [coach.id, b.id])))

    const revoked = await aal2.from('coach_athlete').update({ status: 'revoked' }).eq('id', coachOfB.id).select()
    add('coach_athlete', 'coach revokes the both-roles user', judgeAccepted(revoked))
    checks.push(await onEveryTable('T-09 coach reads the both-roles user after its own revoke', hidden(aal2, b.id)))
    const again = await aal2.from('coach_athlete').update({ status: 'active' }).eq('id', coachOfB.id).select()
    const after = (await readLinks(b.aal2, { athlete_id: b.id, coach_id: coach.id }))[0]?.status
    add('coach_athlete', 'T-09 coach reactivates after its own revoke', judgeRefusedTransition(again, 'revoked', after))
    checks.push(await onEveryTable('T-09 coach reads the both-roles user after the reactivation attempt', hidden(aal2, b.id)))
    checks.push(await onEveryTable('T-12 the reverse link survives: both-roles user still reads the coach', visible(b.aal2, coach.id, 1)))
  }
}

