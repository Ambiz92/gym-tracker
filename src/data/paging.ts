import type { PostgrestError } from '@supabase/supabase-js'
import { unwrap } from './client'

// PostgREST caps a response at 1000 rows by default.
const PAGE_SIZE = 1000

/**
 * Reads every row of a query, page by page. `fetchPage` receives an inclusive range and its query
 * must have a total, unique ordering so pages never overlap or skip rows, and should call `own()`
 * itself so every page is scoped to whoever is signed in at that moment. As with `unwrap<T>`,
 * the caller vouches for the row shape: the untyped client infers embedded rows wrongly.
 */
export async function readAllRows<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: PostgrestError | null }>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    const page = unwrap<Row[]>({ data: data as Row[] | null, error })
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
