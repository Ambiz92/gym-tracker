import { afterEach, describe, expect, test, vi } from 'vitest'
import { isUuid, newUuid } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newUuid', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('returns a v4 uuid with the native generator', () => {
    expect(newUuid()).toMatch(V4)
  })

  test('falls back to getRandomValues when randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(255) })
    expect(newUuid()).toMatch(V4)
  })

  test('two calls differ', () => {
    expect(newUuid()).not.toBe(newUuid())
  })
})

describe('isUuid', () => {
  test('accepts the canonical form in either case', () => {
    expect(isUuid('3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b')).toBe(true)
    expect(isUuid('3F2B8C1E-5D4A-4E6F-9A7B-0C1D2E3F4A5B')).toBe(true)
  })

  test.each(['', 'abc', '3f2b8c1e5d4a4e6f9a7b0c1d2e3f4a5b', '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5', '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5g', ' 3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b'])(
    'rejects %j',
    (value) => expect(isUuid(value)).toBe(false),
  )
})
