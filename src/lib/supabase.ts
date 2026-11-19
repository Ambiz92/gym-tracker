import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)')
}

// Anon key only: the service_role key must never reach the front end.
// detectSessionInUrl is off because the hash belongs to the router: src/auth/oauthReturn.ts reads the
// Google return itself. PKCE puts a one-time `?code=` in the query instead of tokens in the hash.
export const supabase = createClient(url, anonKey, { auth: { flowType: 'pkce', detectSessionInUrl: false } })
