import { isPrivilegedKey } from './rlsAssertions'

export interface Finding {
  file: string
  line: number
  kind: string
  /** Redacted: never the whole value. */
  preview: string
}

const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{8,}/g
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const SERVICE_ROLE_ASSIGNMENT = /service_role_key\s*[=:]\s*["']?[A-Za-z0-9_.-]{20,}/gi

function redact(value: string): string {
  return `${value.slice(0, 8)}...`
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

/**
 * Finds values that look like a private Supabase credential. A JWT passes only when it is
 * one of `publicKeys` (the key meant for the bundle) and is not a service_role token.
 */
export function scanText(file: string, text: string, publicKeys: ReadonlySet<string>): Finding[] {
  const found: Finding[] = []
  const add = (match: RegExpMatchArray, kind: string) =>
    found.push({ file, line: lineOf(text, match.index ?? 0), kind, preview: redact(match[0]) })

  for (const match of text.matchAll(SECRET_KEY)) add(match, 'secret key')
  for (const match of text.matchAll(SERVICE_ROLE_ASSIGNMENT)) add(match, 'service_role key assignment')
  for (const match of text.matchAll(JWT)) {
    if (isPrivilegedKey(match[0])) add(match, 'service_role JWT')
    else if (!publicKeys.has(match[0])) add(match, 'JWT other than the public key')
  }
  return found
}
