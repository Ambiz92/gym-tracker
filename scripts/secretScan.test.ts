import { describe, expect, it } from 'vitest'
import { scanText } from './secretScan'

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (role: string) => `${b64({ alg: 'HS256' })}.${b64({ role, iss: 'supabase' })}.${'s'.repeat(20)}`
const NO_KEYS: ReadonlySet<string> = new Set()

describe('scanText', () => {
  it('flags a Supabase secret key and redacts it', () => {
    const key = `sb_secret_${'a'.repeat(24)}`
    const [finding] = scanText('f.js', `const k = "${key}"`, NO_KEYS)
    expect(finding).toMatchObject({ file: 'f.js', line: 1, kind: 'secret key' })
    expect(finding.preview).not.toContain(key)
  })

  it('flags a service_role JWT even when it is listed as public', () => {
    const token = jwt('service_role')
    const findings = scanText('f.js', token, new Set([token]))
    expect(findings.map((f) => f.kind)).toEqual(['service_role JWT'])
  })

  it('accepts the public key and flags any other JWT', () => {
    const publicKey = jwt('anon')
    const other = `${jwt('authenticated')}x`
    expect(scanText('f.js', publicKey, new Set([publicKey]))).toEqual([])
    expect(scanText('f.js', other, new Set([publicKey])).map((f) => f.kind)).toEqual(['JWT other than the public key'])
  })

  it('accepts the new publishable key format', () => {
    expect(scanText('f.js', `sb_publishable_${'a'.repeat(24)}`, NO_KEYS)).toEqual([])
  })

  it('flags a service role key assignment and reports the line', () => {
    const findings = scanText('.env', `A=1\nSUPABASE_SERVICE_ROLE_KEY=${'x'.repeat(30)}`, NO_KEYS)
    expect(findings).toMatchObject([{ line: 2, kind: 'service_role key assignment' }])
  })

  it('ignores placeholders and prose', () => {
    expect(scanText('README.md', 'Never put the service_role key or an sb_secret_ key here.', NO_KEYS)).toEqual([])
  })
})
