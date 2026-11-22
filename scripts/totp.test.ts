import { describe, expect, it } from 'vitest'
import { decodeBase32, totp } from './totp'

// RFC 6238 appendix B: the SHA-1 secret is the ASCII string "12345678901234567890".
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('decodeBase32', () => {
  it('decodes the RFC 4648 test vectors', () => {
    expect(decodeBase32('MZXW6YTBOI======').toString('utf8')).toBe('foobar')
    expect(decodeBase32('mzxw6ytboi').toString('utf8')).toBe('foobar')
    expect(decodeBase32('MZXW 6YTB OI').toString('utf8')).toBe('foobar')
  })

  it('refuses characters outside the alphabet', () => {
    expect(() => decodeBase32('MZXW1YTB')).toThrow('not base32')
  })
})

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 test vectors, 8 digits', () => {
    expect(totp(RFC_SECRET, 59_000, 8)).toBe('94287082')
    expect(totp(RFC_SECRET, 1_111_111_109_000, 8)).toBe('07081804')
    expect(totp(RFC_SECRET, 1_234_567_890_000, 8)).toBe('89005924')
    expect(totp(RFC_SECRET, 20_000_000_000_000, 8)).toBe('65353130')
  })

  it('gives 6 digits by default, with leading zeros kept', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082')
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe('081804')
  })

  it('keeps one code for the whole 30 second step', () => {
    expect(totp(RFC_SECRET, 30_000)).toBe(totp(RFC_SECRET, 59_999))
    expect(totp(RFC_SECRET, 30_000)).not.toBe(totp(RFC_SECRET, 60_000))
  })
})
