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

/** True when at least one row of `table` has `column` equal to one of `ids`. */
export async function isReferenced(table: TableName, column: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false
  const rows = unwrap<{ id: string }[]>(await supabase.from(table).select('id').in(column, ids).limit(1))
  return rows.length > 0
}

/** Thrown by delete operations that would drop rows still referenced by history or a plan. */
export function inUseError(what: string): DataError {
  return new DataError(`${what} is still in use: archive it instead`, 'in_use')
}
