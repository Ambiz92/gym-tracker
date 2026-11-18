import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)')
}

// Anon key only: the service_role key must never reach the front end.
// detectSessionInUrl is off: there is no OAuth or magic-link flow, and the hash belongs to the router.
export const supabase = createClient(url, anonKey, { auth: { detectSessionInUrl: false } })
