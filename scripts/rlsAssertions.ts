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
