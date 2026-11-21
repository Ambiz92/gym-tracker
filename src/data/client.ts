import type { PostgrestError } from '@supabase/supabase-js'
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
