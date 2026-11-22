import type { PostgrestError } from '@supabase/supabase-js'
import { isUuid } from '../lib/uuid'
import { supabase } from '../lib/supabase'
import type { TableName } from '../types/db'

export { supabase }

/** Failure of a data-layer call; `code` is the Postgres/PostgREST code or a layer code like `in_use`. */
export class DataError extends Error {
  readonly code: string | null

  constructor(message: string, code: string | null = null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DataError'
    this.code = code
  }
}

interface Response<T> {
  data: T | null
  error: PostgrestError | null
}

function toDataError(error: PostgrestError): DataError {
  return new DataError(error.message, error.code || null, { cause: error })
}

/** Returns the payload of a response, throwing a DataError on a Supabase error or an empty payload. */
export function unwrap<T>({ data, error }: Response<T>): T {
  if (error) throw toDataError(error)
  if (data === null) throw new DataError('Empty response from the database')
  return data
}

/** Like `unwrap`, but an empty payload is a valid answer (maybeSingle). */
export function unwrapOrNull<T>({ data, error }: Response<T>): T | null {
  if (error) throw toDataError(error)
  return data
}

/** For writes that return no rows: only checks for an error. */
export function ensureOk({ error }: { error: PostgrestError | null }): void {
  if (error) throw toDataError(error)
}

/** For writes with `.select('id')`: throws a `not_found` DataError when no row matched (unknown id, hidden by RLS). */
export function ensureAffected({ data, error }: Response<{ id: string }[]>): void {
  if (error) throw toDataError(error)
  if (!data || data.length === 0) throw new DataError('No matching row was updated', 'not_found')
}

/**
 * The signed-in user's id, read from the session supabase-js keeps in storage: no network round trip
 * unless the token has to be refreshed. The id only scopes queries; the database trusts the JWT, not this.
 */
async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new DataError(error.message, error.code ?? null, { cause: error })
  if (!data.session) throw new DataError('Not signed in', 'not_signed_in')
  return data.session.user.id
}

type Query = ReturnType<typeof supabase.from>

/** Same call shape as the supabase query builder; reads, updates and deletes are already scoped to the caller. */
export interface OwnTable {
  select: Query['select']
  update: Query['update']
  delete: Query['delete']
  insert: Query['insert']
  upsert: Query['upsert']
}

/**
 * The only door to the user's own tables. RLS alone says "rows I may see", which stops meaning "my
 * rows" once a policy lets someone read other owners' rows, so select, update and delete also filter
 * `owner_id = me`. Insert and upsert stay as they are: the column defaults to auth.uid() and the
 * policies reject any other value. Throws a `not_signed_in` DataError without a session.
 */
export async function own(table: TableName): Promise<OwnTable> {
  const ownerId = await currentUserId()
  const query = () => supabase.from(table)
  return {
    select: ((...args) => query().select(...args).eq('owner_id', ownerId)) as Query['select'],
    update: ((...args) => query().update(...args).eq('owner_id', ownerId)) as Query['update'],
    delete: ((...args) => query().delete(...args).eq('owner_id', ownerId)) as Query['delete'],
    insert: (...args) => query().insert(...args),
    upsert: (...args) => query().upsert(...args),
  }
}

/** The coach_athlete table, which has no owner_id: reads name the party, and there is no delete or upsert (no grant for them either). */
export interface LinkTable {
  /** Links where the caller is the athlete. */
  asAthlete: Query['select']
  /** Links where the caller is the coach. */
  asCoach: Query['select']
  /** The athlete asks a coach: the database sets athlete_id, status and consent_version. */
  insert(row: { coach_id: string; athlete_label: string }): ReturnType<Query['insert']>
  /** Only `status` is writable (the grants allow nothing else). */
  update(values: { status: 'active' | 'revoked' }): ReturnType<Query['update']>
}

/**
 * The only door to coach_athlete. RLS already limits it to the two parties; reads still filter on the
 * party so a row where the caller is the other one never lands in the wrong list. Throws `not_signed_in` without a session.
 */
export async function linkTable(): Promise<LinkTable & { userId: string }> {
  const userId = await currentUserId()
  const query = () => supabase.from('coach_athlete')
  return {
    userId,
    asAthlete: ((...args) => query().select(...args).eq('athlete_id', userId)) as Query['select'],
    asCoach: ((...args) => query().select(...args).eq('coach_id', userId)) as Query['select'],
    insert: (...args) => query().insert(...args),
    update: (...args) => query().update(...args),
  }
}

/** The tables migration 0008 opens to a coach for reading; plan_session and plan_exercise come embedded in `plan`. */
export type AthleteTable = 'workout' | 'set_log' | 'exercise' | 'plan'

/** Read-only view of one athlete's rows: every read is pinned to `owner_id = athlete`. Nothing here can write. */
export interface AthleteReader {
  table(name: AthleteTable): { select: Query['select'] }
}

/**
 * The only door to another account's rows (never extend own() with an owner override). The id must be a
 * uuid and belong to an ACTIVE link of the caller as coach before any data query goes out; RLS checks the
 * same on every read, this only turns a wrong id into a clear `not_linked` error. No client-side cache:
 * a revoke has to take effect on the next call. Throws `invalid_athlete`, `not_linked` or `not_signed_in`.
 */
export async function athleteReader(athleteId: string): Promise<AthleteReader> {
  if (!isUuid(athleteId)) throw new DataError('Not a valid athlete id', 'invalid_athlete')
  const coachId = await currentUserId()
  const links = unwrap<{ id: string }[]>(
    await supabase
      .from('coach_athlete')
      .select('id')
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .limit(1),
  )
  if (links.length === 0) throw new DataError('No active link with this athlete', 'not_linked')
  return {
    table: (name) => ({ select: ((...args) => supabase.from(name).select(...args).eq('owner_id', athleteId)) as Query['select'] }),
  }
}

/** True when at least one row of `table` has `column` equal to one of `ids`. */
export async function isReferenced(table: TableName, column: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false
  const rows = unwrap<{ id: string }[]>(await (await own(table)).select('id').in(column, ids).limit(1))
  return rows.length > 0
}

/** Thrown by delete operations that would drop rows still referenced by history or a plan. */
export function inUseError(what: string): DataError {
  return new DataError(`${what} is still in use: archive it instead`, 'in_use')
}
