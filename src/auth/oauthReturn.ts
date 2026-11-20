import type { AuthErrorLike } from './errors'

/** What the identity provider left in the URL when it sent the browser back. */
export type OAuthReturn = { code: string; flowId?: string } | { error: AuthErrorLike }

// Parameters of the PKCE return. sb_flow_id only appears when supabase-js runs with
// experimental.appendPkceFlowIdToRedirects; it is handled in case that is ever turned on.
const RETURN_PARAMS = ['code', 'sb_flow_id', 'error', 'error_code', 'error_description']

/** A route hash starts with `#/`; anything else (`#error=...`) is auth data, not a route. */
function isRouteHash(url: URL): boolean {
  return url.hash.startsWith('#/')
}

/** Where Google sends the browser back: the app root, with no hash (Supabase matches it against its redirect list). */
export function oauthRedirectUrl(origin: string, base: string): string {
  return new URL(base, origin).href
}

/**
 * Reads the return from the provider: an authorization code, or the error Supabase reports.
 * A refusal is written to both the query and the hash, and the hash is where HashRouter looks.
 */
export function parseOAuthReturn(href: string): OAuthReturn | null {
  const url = new URL(href)
  const hash = new URLSearchParams(isRouteHash(url) ? '' : url.hash.slice(1))
  const read = (key: string) => url.searchParams.get(key) ?? hash.get(key)

  const error = read('error')
  if (error) return { error: { message: read('error_description') ?? error, code: read('error_code') ?? undefined } }

  const code = url.searchParams.get('code')
  if (!code) return null
  return { code, flowId: url.searchParams.get('sb_flow_id') ?? undefined }
}

/** The same URL without the return parameters, keeping the route; for `history.replaceState`. */
export function withoutOAuthReturn(href: string): string {
  const url = new URL(href)
  for (const key of RETURN_PARAMS) url.searchParams.delete(key)
  if (!isRouteHash(url)) url.hash = ''
  return url.toString()
}

/** The slice of `window` used by `takeOAuthReturn`. */
interface ReturnWindow {
  location: { href: string }
  history: { replaceState(data: null, unused: string, url: string): void }
}

/** Reads the return and removes it from the address bar, so a reload or a shared URL does not replay it. */
export function takeOAuthReturn(win: ReturnWindow): OAuthReturn | null {
  const returned = parseOAuthReturn(win.location.href)
  if (returned) win.history.replaceState(null, '', withoutOAuthReturn(win.location.href))
  return returned
}
