export interface Outcome {
  data: unknown
  error: { code?: string; message: string } | null
}

export interface Check {
  target: string
  operation: string
  pass: boolean
  detail: string
}

type Verdict = Pick<Check, 'pass' | 'detail'>

const PERMISSION_DENIED = '42501'
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

function describeError(error: NonNullable<Outcome['error']>): string {
  return `error ${error.code || 'none'}: ${error.message}`
}

/** A select passes when it is denied or returns no rows. */
export function judgeSelect({ data, error }: Outcome): Verdict {
  if (error) {
    const denied = error.code === PERMISSION_DENIED
    return { pass: denied, detail: describeError(error) }
  }
  if (Array.isArray(data) && data.length === 0) return { pass: true, detail: 'empty result' }
  return { pass: false, detail: `returned data: ${JSON.stringify(data)}` }
}

/**
 * Writes must be denied outright. An empty result is not accepted: the probe
 * filters on a nil id, so it would match nothing even if the policy were open.
 */
export function judgeWrite({ data, error }: Outcome): Verdict {
  if (error) {
    const denied = error.code === PERMISSION_DENIED
    return { pass: denied, detail: describeError(error) }
  }
  return { pass: false, detail: `not denied, response data: ${JSON.stringify(data)}` }
}

/** A signed-in read must succeed. An empty result is fine here: the catalog may not be seeded yet. */
export function judgeSignedInRead({ data, error }: Outcome): Verdict {
  if (error) return { pass: false, detail: describeError(error) }
  if (!Array.isArray(data)) return { pass: false, detail: `unexpected response: ${JSON.stringify(data)}` }
  return { pass: true, detail: `${data.length} rows` }
}

/** The restrictive policy must hide the rows: HTTP 200 and nothing, not a permission error. */
export function judgeHiddenByPolicy({ data, error }: Outcome): Verdict {
  if (error) return { pass: false, detail: describeError(error) }
  if (Array.isArray(data) && data.length === 0) return { pass: true, detail: 'empty result' }
  return { pass: false, detail: `returned data: ${JSON.stringify(data)}` }
}

/** The unique index must refuse a second row with the same key. */
export function judgeDuplicate({ data, error }: Outcome): Verdict {
  if (error) return { pass: error.code === UNIQUE_VIOLATION, detail: describeError(error) }
  return { pass: false, detail: `duplicate accepted: ${JSON.stringify(data)}` }
}

/** The composite key must refuse a reference to another owner's row. */
export function judgeForeignKey({ data, error }: Outcome): Verdict {
  if (error) return { pass: error.code === FOREIGN_KEY_VIOLATION, detail: describeError(error) }
  return { pass: false, detail: `cross-owner reference accepted: ${JSON.stringify(data)}` }
}

/** A cross-owner write must be refused by a policy (WITH CHECK or USING), not by a missing grant or a constraint. */
export function judgeRlsRefusal({ data, error }: Outcome): Verdict {
  if (!error) return { pass: false, detail: `not refused, response data: ${JSON.stringify(data)}` }
  const byPolicy = error.code === PERMISSION_DENIED && /row-level security/i.test(error.message)
  return { pass: byPolicy, detail: describeError(error) }
}

/** A column or table the role has no grant on: same 42501, but refused by the privilege layer, before any policy. */
export function judgePermissionDenied({ data, error }: Outcome): Verdict {
  if (!error) return { pass: false, detail: `not refused, response data: ${JSON.stringify(data)}` }
  const byGrant = error.code === PERMISSION_DENIED && /^permission denied/i.test(error.message)
  return { pass: byGrant, detail: describeError(error) }
}

/** An update or delete that RLS filters out returns no rows and no error, so only an empty array proves it. */
export function judgeNoRowsWritten({ data, error }: Outcome): Verdict {
  if (error) return { pass: false, detail: describeError(error) }
  if (Array.isArray(data) && data.length === 0) return { pass: true, detail: 'no rows written' }
  return { pass: false, detail: `rows written: ${JSON.stringify(data)}` }
}

/** Every visible row must belong to the expected owner, and there must be exactly the expected number of them. */
export function judgeVisibleRows({ data, error }: Outcome, ownerId: string, expectedRows: number): Verdict {
  if (error) return { pass: false, detail: describeError(error) }
  if (!Array.isArray(data)) return { pass: false, detail: `unexpected response: ${JSON.stringify(data)}` }
  const foreign = data.filter((row) => (row as { owner_id?: unknown }).owner_id !== ownerId)
  if (foreign.length > 0) return { pass: false, detail: `${foreign.length} rows of another owner: ${JSON.stringify(foreign)}` }
  return { pass: data.length === expectedRows, detail: `${data.length} rows, expected ${expectedRows}` }
}

/** The row read back by its owner after a refused write must equal the row read before it. */
export function judgeRowUnchanged(before: unknown, after: unknown): Verdict {
  const same = JSON.stringify(before) === JSON.stringify(after)
  return { pass: same, detail: same ? 'row unchanged' : `row changed: ${JSON.stringify(before)} became ${JSON.stringify(after)}` }
}

/**
 * A forbidden status change must be refused (42501 from a policy or the transition trigger) or filtered out
 * (no row), and the status read back afterwards must be the one from before.
 */
export function judgeRefusedTransition(update: Outcome, statusBefore: string, statusAfter: string | undefined): Verdict {
  if (statusAfter !== statusBefore) return { pass: false, detail: `status moved from ${statusBefore} to ${statusAfter}` }
  if (update.error) {
    const refused = update.error.code === PERMISSION_DENIED
    return { pass: refused, detail: describeError(update.error) }
  }
  if (Array.isArray(update.data) && update.data.length === 0) return { pass: true, detail: 'no rows updated' }
  return { pass: false, detail: `update returned rows: ${JSON.stringify(update.data)}` }
}

/** Sign-ups must be refused by the project, not by an email validator. */
export function judgeSignUp({ data, error }: Outcome): Verdict {
  if (!error) return { pass: false, detail: `sign-up accepted: ${JSON.stringify(data)}` }
  return { pass: error.code === 'signup_disabled', detail: describeError(error) }
}

/** The magic link must never yield a session; the error or success reply is only noted. */
export function judgeOtp({ data, error }: Outcome): Verdict {
  const session = (data as { session?: unknown } | null)?.session ?? null
  const reply = error ? describeError(error) : 'no error (reply does not reveal whether the user exists)'
  return { pass: session === null, detail: reply }
}

/** True for keys that bypass RLS: running the check with one would prove nothing. */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: unknown }
    return claims.role === 'service_role'
  } catch {
    return false
  }
}

/** Tables that the migrations, applied in order, leave in the public schema. */
export function publicTablesFrom(migrations: string[]): string[] {
  const tables = new Set<string>()
  for (const sql of migrations) {
    for (const [, kind, name] of sql.matchAll(/\b(create|drop)\s+table\s+(?:if\s+(?:not\s+)?exists\s+)?public\.(\w+)/gi)) {
      if (kind.toLowerCase() === 'create') tables.add(name)
      else tables.delete(name)
    }
  }
  return [...tables]
}

export function formatTable(checks: Check[]): string {
  const width = (pick: (check: Check) => string) => Math.max(...checks.map((check) => pick(check).length))
  const targetWidth = width((check) => check.target)
  const operationWidth = width((check) => check.operation)
  return checks
    .map((check) => {
      const status = check.pass ? 'PASS' : 'FAIL'
      return `${status}  ${check.target.padEnd(targetWidth)}  ${check.operation.padEnd(operationWidth)}  ${check.detail}`
    })
    .join('\n')
}
