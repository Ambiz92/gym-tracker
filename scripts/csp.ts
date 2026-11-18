/** Content-Security-Policy for the production build; connect-src is limited to the Supabase origin. */
export function buildCsp(supabaseUrl: string): string {
  let origin: string
  try {
    origin = new URL(supabaseUrl).origin
  } catch {
    throw new Error('VITE_SUPABASE_URL is not a valid URL, cannot build the CSP')
  }
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    `connect-src ${origin}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ')
}
