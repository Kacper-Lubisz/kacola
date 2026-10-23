import { esc } from './data.ts'

// Sign-in with the accounts service (accounts.kacperlubisz.com) instead of pairing, when the build named
// one in <meta name="kacola-accounts" content="https://accounts.…">. Its session cookie lives on the
// parent domain, so a viewer on any subdomain asks it for a short-lived JWT and sends that to its own
// server as the bearer. Without the meta tag the viewer pairs, as before. Free of the DOM, like data.ts.

export const ACCOUNTS_META = 'kacola-accounts'

export type AuthMode = { kind: 'pairing' } | { kind: 'account'; issuer: string }

/** An issuer URL without a trailing slash, or null for anything that is not an http(s) URL. */
export function normalizeIssuer(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  let u: URL
  try {
    u = new URL(s.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
}

/** The meta tag's content decides how this viewer signs in. */
export function authMode(meta: string | null | undefined): AuthMode {
  const issuer = normalizeIssuer(meta)
  return issuer ? { kind: 'account', issuer } : { kind: 'pairing' }
}

export const signInUrl = (issuer: string, returnTo: string): string =>
  `${issuer}/sign-in?return_to=${encodeURIComponent(returnTo)}`

/** What the button calls the account: accounts.kacperlubisz.com → kacperlubisz.com. */
export const accountName = (issuer: string): string => new URL(issuer).host.replace(/^accounts\./, '')

/** A JWT's claims, unverified: the server verifies; the viewer only reads its expiry and email. */
export function jwtClaims(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
    const claims: unknown = JSON.parse(json)
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const RENEW_BEFORE_MS = 60_000

/**
 * Until when (this browser's clock) a token fetched at `fetchedAt` may be reused: a minute before it
 * expires. The earlier of `exp` and fetch time + the token's own lifetime (exp - iat), so a clock that
 * runs behind the issuer's still renews in time.
 */
export function tokenFreshUntil(jwt: string, fetchedAt: number): number {
  const c = jwtClaims(jwt)
  if (typeof c?.exp !== 'number') return fetchedAt
  const byExp = c.exp * 1000
  const byLifetime = typeof c.iat === 'number' ? fetchedAt + (c.exp - c.iat) * 1000 : byExp
  return Math.min(byExp, byLifetime) - RENEW_BEFORE_MS
}

export type AccountTokens = {
  /** The current token, renewed when stale; null when nobody is signed in to the accounts service. */
  get(): Promise<string | null>
  /** Forget the cached token (the server refused it). */
  clear(): void
}

export function accountTokens(
  issuer: string,
  opts: { fetch?: typeof fetch; now?: () => number } = {},
): AccountTokens {
  const f = opts.fetch ?? globalThis.fetch
  const now = opts.now ?? Date.now
  let cached: { token: string; until: number } | null = null
  let pending: Promise<string | null> | null = null

  async function fetchToken(): Promise<string | null> {
    const fetchedAt = now()
    let res: Response
    try {
      res = await f(`${issuer}/api/auth/token`, { credentials: 'include' })
    } catch {
      throw new Error(`Can’t reach ${accountName(issuer)} to sign in.`)
    }
    if (res.status === 401) {
      cached = null
      return null
    }
    if (!res.ok) throw new Error(`Signing in with ${accountName(issuer)} failed (${res.status}).`)
    const { token } = (await res.json()) as { token?: unknown }
    if (typeof token !== 'string' || !token) throw new Error(`${accountName(issuer)} sent no token.`)
    cached = { token, until: tokenFreshUntil(token, fetchedAt) }
    return token
  }

  return {
    get() {
      if (cached && now() < cached.until) return Promise.resolve(cached.token)
      // the page and the live stream ask at once on load: one fetch serves both
      pending ??= fetchToken().finally(() => {
        pending = null
      })
      return pending
    },
    clear() {
      cached = null
    },
  }
}

export async function signOutOfAccounts(issuer: string, f: typeof fetch = globalThis.fetch): Promise<void> {
  await f(`${issuer}/api/auth/sign-out`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
}

/**
 * The sign-in screen. `refused` is the signed-in account the server would not let in (it is not one of
 * the server's owners); the button then signs out first, or the accounts service would hand back the
 * same account.
 */
export function renderAccountSignIn(issuer: string, refused: { email: string | null } | null): string {
  const name = esc(accountName(issuer))
  if (refused)
    return `<div class="pairing"><h1>Sign in to your meetings</h1><p class="error">${refused.email ? esc(refused.email) : 'This account'} can’t open the meetings on this server.</p><p><button id="switch-account">Sign in with another account</button></p></div>`
  return `<div class="pairing"><h1>Sign in to your meetings</h1><p>Use your ${name} account.</p><p><button id="signin">Sign in with ${name}</button></p></div>`
}
