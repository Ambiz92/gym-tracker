import { afterEach, describe, expect, test, vi } from 'vitest'
import { newUuid } from './uuid'

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
