import { createHmac } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Decodes an RFC 4648 base32 string (the form authenticator apps show), ignoring spaces, case and padding. */
export function decodeBase32(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) throw new Error('The TOTP secret is not base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

/** RFC 6238 time-based code (HMAC-SHA1, 30 s steps, 6 digits: what Supabase TOTP factors use). */
export function totp(secret: string, nowMs: number, digits = 6, stepSeconds = 30): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / stepSeconds)))
  const hmac = createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 10 ** digits).padStart(digits, '0')
}
