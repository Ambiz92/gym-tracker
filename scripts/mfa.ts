import type { SupabaseClient } from '@supabase/supabase-js'
import { totp } from './totp'

/** Challenges the factor and verifies a code computed from `secret`: the client's session becomes aal2. */
export async function verifyTotp(client: SupabaseClient, factorId: string, secret: string, who: string): Promise<void> {
  // The codes of the neighbouring 30 s steps cover a few seconds of clock drift.
  for (const drift of [0, -30_000, 30_000]) {
    const challenge = await client.auth.mfa.challenge({ factorId })
    if (challenge.error) throw new Error(`TOTP challenge failed for ${who}: ${challenge.error.message}`)
    const code = totp(secret, Date.now() + drift)
    const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code })
    if (!verified.error) return
  }
  throw new Error(`The TOTP code for ${who} was refused: check the secret and the clock`)
}
