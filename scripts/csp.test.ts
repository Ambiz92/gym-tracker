import { describe, expect, it } from 'vitest'
import { buildCsp } from './csp'

describe('buildCsp', () => {
  it('limits connect-src to the Supabase origin and drops any path', () => {
    const csp = buildCsp('https://abcd.supabase.co/rest/v1/')
    expect(csp).toContain('connect-src https://abcd.supabase.co;')
    expect(csp).not.toContain('/rest/v1')
  })

  it('allows no inline scripts, eval or foreign script origins', () => {
    const csp = buildCsp('https://abcd.supabase.co')
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("script-src 'self';")
    expect(csp).not.toContain('unsafe-')
  })

  it('rejects an invalid URL', () => {
    expect(() => buildCsp('not a url')).toThrow(/VITE_SUPABASE_URL/)
  })
})
