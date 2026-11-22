import { describe, expect, it } from 'vitest'
import {
  formatTable,
  isPrivilegedKey,
  isTestLink,
  judgeDuplicate,
  judgeForeignKey,
  judgeHiddenByPolicy,
  judgeAccepted,
  judgeNoRowsWritten,
  judgeOnlyOwners,
  judgeOtp,
  judgePermissionDenied,
  judgeRefusedTransition,
  judgeRlsRefusal,
  judgeRowIds,
  judgeRowUnchanged,
  judgeSelect,
  judgeSignUp,
  judgeSignedInRead,
  judgeVisibleRows,
  judgeWrite,
  publicTablesFrom,
  testLinkCleanupStatement,
} from './rlsAssertions'

const denied = { data: null, error: { code: '42501', message: 'permission denied for table plan' } }

describe('judgeSelect', () => {
  it('passes on permission denied', () => {
    expect(judgeSelect(denied).pass).toBe(true)
  })

  it('passes on an empty array', () => {
    expect(judgeSelect({ data: [], error: null }).pass).toBe(true)
  })

  it('fails when rows are returned', () => {
    expect(judgeSelect({ data: [{ id: 1 }], error: null }).pass).toBe(false)
  })

  it('fails on an unrelated error, which proves nothing', () => {
    const outcome = { data: null, error: { code: 'PGRST205', message: 'table not found' } }
    expect(judgeSelect(outcome).pass).toBe(false)
  })
})

describe('judgeWrite', () => {
  it('passes on permission denied', () => {
    expect(judgeWrite(denied).pass).toBe(true)
  })

  it('fails on an empty success, which is vacuous', () => {
    expect(judgeWrite({ data: [], error: null }).pass).toBe(false)
  })

  it('fails on a constraint error that is not a denial', () => {
    const outcome = { data: null, error: { code: '23502', message: 'null value in column owner_id' } }
    expect(judgeWrite(outcome).pass).toBe(false)
  })
})

describe('judgeSignedInRead', () => {
  it('passes on rows or on an empty array', () => {
    expect(judgeSignedInRead({ data: [{ id: 1 }], error: null }).pass).toBe(true)
    expect(judgeSignedInRead({ data: [], error: null }).pass).toBe(true)
  })

  it('fails on permission denied, since a signed-in user must be able to read', () => {
    expect(judgeSignedInRead(denied).pass).toBe(false)
  })
})

describe('judgeHiddenByPolicy', () => {
  it('passes only on an empty result', () => {
    expect(judgeHiddenByPolicy({ data: [], error: null }).pass).toBe(true)
    expect(judgeHiddenByPolicy({ data: [{ id: 1 }], error: null }).pass).toBe(false)
  })

  it('fails on permission denied, which means a missing grant and not the policy', () => {
    expect(judgeHiddenByPolicy(denied).pass).toBe(false)
  })
})

describe('judgeDuplicate', () => {
  it('passes only on a unique violation', () => {
    const unique = { data: null, error: { code: '23505', message: 'duplicate key value' } }
    expect(judgeDuplicate(unique).pass).toBe(true)
    expect(judgeDuplicate(denied).pass).toBe(false)
  })

  it('fails when the duplicate is accepted', () => {
    expect(judgeDuplicate({ data: [{ id: 2 }], error: null }).pass).toBe(false)
  })
})

describe('judgeForeignKey', () => {
  it('passes only on a foreign key violation', () => {
    const foreignKey = { data: null, error: { code: '23503', message: 'violates foreign key constraint' } }
    expect(judgeForeignKey(foreignKey).pass).toBe(true)
    expect(judgeForeignKey(denied).pass).toBe(false)
  })

  it('fails when the cross-owner reference is accepted', () => {
    expect(judgeForeignKey({ data: [{ id: 1 }], error: null }).pass).toBe(false)
  })
})

const byPolicy = {
  data: null,
  error: { code: '42501', message: 'new row violates row-level security policy for table "workout"' },
}
const byGrant = { data: null, error: { code: '42501', message: 'permission denied for table coach_athlete' } }

describe('judgeRlsRefusal', () => {
  it('passes on a policy violation, both WITH CHECK and USING', () => {
    expect(judgeRlsRefusal(byPolicy).pass).toBe(true)
    const using = { data: null, error: { code: '42501', message: 'new row violates row-level security policy (USING expression) for table "workout"' } }
    expect(judgeRlsRefusal(using).pass).toBe(true)
  })

  it('fails on a missing grant, which is another layer with the same code', () => {
    expect(judgeRlsRefusal(byGrant).pass).toBe(false)
  })

  it('fails when the write is accepted, with or without rows', () => {
    expect(judgeRlsRefusal({ data: [{ id: 1 }], error: null }).pass).toBe(false)
    expect(judgeRlsRefusal({ data: [], error: null }).pass).toBe(false)
  })
})

describe('judgePermissionDenied', () => {
  it('passes only on a privilege error', () => {
    expect(judgePermissionDenied(byGrant).pass).toBe(true)
    expect(judgePermissionDenied(byPolicy).pass).toBe(false)
  })

  it('fails when the write is accepted', () => {
    expect(judgePermissionDenied({ data: [{ id: 1 }], error: null }).pass).toBe(false)
  })

  it('fails on an unrelated error', () => {
    expect(judgePermissionDenied({ data: null, error: { code: '23505', message: 'duplicate key' } }).pass).toBe(false)
  })
})

describe('judgeNoRowsWritten', () => {
  it('passes only on an empty success', () => {
    expect(judgeNoRowsWritten({ data: [], error: null }).pass).toBe(true)
    expect(judgeNoRowsWritten({ data: [{ id: 1 }], error: null }).pass).toBe(false)
  })

  it('fails on an error: a refusal by error is a different outcome', () => {
    expect(judgeNoRowsWritten(byPolicy).pass).toBe(false)
  })
})

describe('judgeVisibleRows', () => {
  const rows = [{ owner_id: 'athlete' }, { owner_id: 'athlete' }]

  it('passes when every row is the owner\'s and the count matches', () => {
    expect(judgeVisibleRows({ data: rows, error: null }, 'athlete', 2).pass).toBe(true)
    expect(judgeVisibleRows({ data: [], error: null }, 'athlete', 0).pass).toBe(true)
  })

  it('fails when a row belongs to someone else, even if the count matches', () => {
    const mixed = [{ owner_id: 'athlete' }, { owner_id: 'coach' }]
    expect(judgeVisibleRows({ data: mixed, error: null }, 'athlete', 2).pass).toBe(false)
  })

  it('fails when the count differs, so a hidden table is not mistaken for a seeded one', () => {
    expect(judgeVisibleRows({ data: [], error: null }, 'athlete', 2).pass).toBe(false)
    expect(judgeVisibleRows({ data: rows, error: null }, 'athlete', 0).pass).toBe(false)
  })

  it('fails on an error or a non-array', () => {
    expect(judgeVisibleRows(denied, 'athlete', 0).pass).toBe(false)
    expect(judgeVisibleRows({ data: null, error: null }, 'athlete', 0).pass).toBe(false)
  })
})

describe('judgeOnlyOwners', () => {
  it('passes when every row belongs to a listed owner, and on no rows', () => {
    expect(judgeOnlyOwners({ data: [{ owner_id: 'c' }, { owner_id: 'a' }], error: null }, ['c', 'a']).pass).toBe(true)
    expect(judgeOnlyOwners({ data: [], error: null }, ['c']).pass).toBe(true)
  })

  it('fails on a row of anyone else, or a row without an owner', () => {
    expect(judgeOnlyOwners({ data: [{ owner_id: 's' }], error: null }, ['c', 'a']).pass).toBe(false)
    expect(judgeOnlyOwners({ data: [{ id: 1 }], error: null }, ['c']).pass).toBe(false)
  })

  it('fails on an error', () => {
    expect(judgeOnlyOwners(denied, ['c']).pass).toBe(false)
  })
})

describe('judgeRowIds', () => {
  it('passes on exactly the expected ids, in any order', () => {
    expect(judgeRowIds({ data: [{ id: 'b' }, { id: 'a' }], error: null }, ['a', 'b']).pass).toBe(true)
    expect(judgeRowIds({ data: [], error: null }, []).pass).toBe(true)
  })

  it('fails on a missing, extra or different id', () => {
    expect(judgeRowIds({ data: [{ id: 'a' }], error: null }, ['a', 'b']).pass).toBe(false)
    expect(judgeRowIds({ data: [{ id: 'a' }, { id: 'c' }], error: null }, ['a']).pass).toBe(false)
    expect(judgeRowIds({ data: [{ id: 'c' }], error: null }, ['a']).pass).toBe(false)
  })

  it('fails on an error', () => {
    expect(judgeRowIds(denied, []).pass).toBe(false)
  })
})

describe('judgeAccepted', () => {
  it('passes when the expected number of rows was written', () => {
    expect(judgeAccepted({ data: [{ id: 1 }], error: null }).pass).toBe(true)
    expect(judgeAccepted({ data: [{ id: 1 }, { id: 2 }], error: null }, 2).pass).toBe(true)
  })

  it('fails on an error, an empty write or a different count', () => {
    expect(judgeAccepted(byPolicy).pass).toBe(false)
    expect(judgeAccepted({ data: [], error: null }).pass).toBe(false)
    expect(judgeAccepted({ data: [{ id: 1 }, { id: 2 }], error: null }).pass).toBe(false)
  })
})

describe('judgeRowUnchanged', () => {
  it('compares what was read before and after', () => {
    expect(judgeRowUnchanged([{ id: 1, status: 'pending' }], [{ id: 1, status: 'pending' }]).pass).toBe(true)
    expect(judgeRowUnchanged([{ id: 1, status: 'pending' }], [{ id: 1, status: 'active' }]).pass).toBe(false)
  })

  it('fails when the row disappeared', () => {
    expect(judgeRowUnchanged([{ id: 1 }], []).pass).toBe(false)
  })
})

describe('judgeRefusedTransition', () => {
  it('passes on a 42501 refusal with the status unchanged', () => {
    expect(judgeRefusedTransition(byPolicy, 'pending', 'pending').pass).toBe(true)
    expect(judgeRefusedTransition(byGrant, 'pending', 'pending').pass).toBe(true)
  })

  it('passes when the update matched no row and the status is unchanged', () => {
    expect(judgeRefusedTransition({ data: [], error: null }, 'revoked', 'revoked').pass).toBe(true)
  })

  it('fails when the update returned the changed row', () => {
    expect(judgeRefusedTransition({ data: [{ status: 'active' }], error: null }, 'pending', 'pending').pass).toBe(false)
  })

  it('fails when the status moved, whatever the update reported', () => {
    expect(judgeRefusedTransition({ data: [], error: null }, 'revoked', 'active').pass).toBe(false)
    expect(judgeRefusedTransition(byPolicy, 'pending', 'active').pass).toBe(false)
  })

  it('fails on an unrelated error and when the row is gone', () => {
    const other = { data: null, error: { code: '23514', message: 'check constraint' } }
    expect(judgeRefusedTransition(other, 'pending', 'pending').pass).toBe(false)
    expect(judgeRefusedTransition({ data: [], error: null }, 'pending', undefined).pass).toBe(false)
  })
})

describe('judgeSignUp', () => {
  it('passes only on signup_disabled', () => {
    expect(judgeSignUp({ data: {}, error: { code: 'signup_disabled', message: 'Signups not allowed' } }).pass).toBe(true)
    expect(judgeSignUp({ data: {}, error: { code: 'email_address_invalid', message: 'invalid' } }).pass).toBe(false)
  })

  it('fails when the sign-up is accepted', () => {
    expect(judgeSignUp({ data: { user: { id: 'u' } }, error: null }).pass).toBe(false)
  })
})

describe('judgeOtp', () => {
  it('passes when no session is returned, with or without an error', () => {
    expect(judgeOtp({ data: { user: null, session: null }, error: null }).pass).toBe(true)
    expect(judgeOtp({ data: { user: null, session: null }, error: { code: 'otp_disabled', message: 'x' } }).pass).toBe(true)
  })

  it('fails when a session is returned', () => {
    expect(judgeOtp({ data: { user: null, session: { access_token: 't' } }, error: null }).pass).toBe(false)
  })
})

describe('isPrivilegedKey', () => {
  const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`

  it('flags service_role JWTs and secret keys', () => {
    expect(isPrivilegedKey(jwt('service_role'))).toBe(true)
    expect(isPrivilegedKey('sb_secret_abc')).toBe(true)
  })

  it('accepts anon JWTs and publishable keys', () => {
    expect(isPrivilegedKey(jwt('anon'))).toBe(false)
    expect(isPrivilegedKey('sb_publishable_abc')).toBe(false)
  })
})

describe('formatTable', () => {
  it('prefixes each row with its verdict', () => {
    const table = formatTable([
      { target: 'plan', operation: 'select', pass: true, detail: 'empty result' },
      { target: 'workout', operation: 'insert', pass: false, detail: 'oops' },
    ])
    expect(table.split('\n')).toEqual([
      'PASS  plan     select  empty result',
      'FAIL  workout  insert  oops',
    ])
  })
})

describe('publicTablesFrom', () => {
  it('lists created tables across migrations and drops the removed ones', () => {
    const first = 'create table public.plan (id uuid);\nCREATE TABLE IF NOT EXISTS public.set_log (id uuid);'
    const second = 'alter table public.plan add column x int;\ndrop table if exists public.set_log;'
    expect(publicTablesFrom([first, second])).toEqual(['plan'])
  })

  it('ignores tables outside the public schema', () => {
    expect(publicTablesFrom(['create table private.audit (id int);'])).toEqual([])
  })
})

describe('test link cleanup', () => {
  const users = ['u1', 'u2']

  it('recognises only rows between fixture users that carry the label', () => {
    expect(isTestLink({ coach_id: 'u1', athlete_id: 'u2', athlete_label: 'rls-check' }, users, 'rls-check')).toBe(true)
    expect(isTestLink({ coach_id: 'u1', athlete_id: 'u2', athlete_label: 'Marco' }, users, 'rls-check')).toBe(false)
    expect(isTestLink({ coach_id: 'u1', athlete_id: 'u2', athlete_label: null }, users, 'rls-check')).toBe(false)
    expect(isTestLink({ coach_id: 'u1', athlete_id: 'real', athlete_label: 'rls-check' }, users, 'rls-check')).toBe(false)
  })

  it('limits the statement to both ends and the label', () => {
    expect(testLinkCleanupStatement(users, 'rls-check')).toBe(
      "delete from public.coach_athlete where athlete_id in ('u1', 'u2') and coach_id in ('u1', 'u2') and athlete_label = 'rls-check';",
    )
  })
})
