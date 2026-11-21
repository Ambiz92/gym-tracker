import { describe, expect, it } from 'vitest'
import {
  formatTable,
  isPrivilegedKey,
  judgeDuplicate,
  judgeHiddenByPolicy,
  judgeOtp,
  judgeSelect,
  judgeSignUp,
  judgeSignedInRead,
  judgeWrite,
  publicTablesFrom,
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
