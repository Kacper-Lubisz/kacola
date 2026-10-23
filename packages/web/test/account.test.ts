import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withAccountsMeta } from '../scripts/build.ts'
import {
  accountName,
  accountTokens,
  authMode,
  jwtClaims,
  RENEW_BEFORE_MS,
  renderAccountSignIn,
  signInUrl,
  signOutOfAccounts,
  tokenFreshUntil,
} from '../src/account.ts'

// Sign-in with the accounts service: which mode the page is in, the token cache, the URLs, the screen.

const ISSUER = 'https://accounts.kacperlubisz.com'
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims: Record<string, unknown>) => `${b64url({ alg: 'EdDSA' })}.${b64url(claims)}.sig`

describe('which sign-in the viewer uses', () => {
  it('an http(s) issuer in the meta tag means account sign-in; anything else, pairing', () => {
    expect(authMode(`${ISSUER}/`)).toEqual({ kind: 'account', issuer: ISSUER })
    expect(authMode(' http://localhost:3000 ')).toEqual({ kind: 'account', issuer: 'http://localhost:3000' })
    for (const meta of [null, undefined, '', '  ', 'not a url', 'javascript:alert(1)'])
      expect(authMode(meta)).toEqual({ kind: 'pairing' })
  })

  it('the build writes the meta tag into index.html only when an issuer is set', () => {
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
    expect(withAccountsMeta(html, undefined)).toBe(html)
    expect(withAccountsMeta(html, '')).toBe(html)
    const out = withAccountsMeta(html, `${ISSUER}/`)
    expect(out).toContain(`<meta name="kacola-accounts" content="${ISSUER}" />\n  </head>`)
    expect(out.match(/kacola-accounts/g)).toHaveLength(1)
    expect(() => withAccountsMeta(html, 'accounts.kacperlubisz.com')).toThrow(/KACOLA_ACCOUNTS_ISSUER/)
  })
})

describe('URLs and names', () => {
  it('sign-in returns to this page', () => {
    expect(signInUrl(ISSUER, 'https://kacola.kacperlubisz.com/#/s/ses_1?x=1&y')).toBe(
      `${ISSUER}/sign-in?return_to=https%3A%2F%2Fkacola.kacperlubisz.com%2F%23%2Fs%2Fses_1%3Fx%3D1%26y`,
    )
  })

  it('names the account by its domain', () => {
    expect(accountName(ISSUER)).toBe('kacperlubisz.com')
    expect(accountName('http://localhost:3000')).toBe('localhost:3000')
  })

  it('signs out of the accounts service with its session cookie', async () => {
    const seen: [string, RequestInit | undefined][] = []
    await signOutOfAccounts(ISSUER, async (u, init) => {
      seen.push([String(u), init])
      return new Response('{}')
    })
    expect(seen).toEqual([
      [
        `${ISSUER}/api/auth/sign-out`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      ],
    ])
  })
})

describe('the token', () => {
  it('reads claims without verifying, and tolerates junk', () => {
    expect(jwtClaims(jwt({ sub: 'u1', email: 'ünï@x.com' }))).toEqual({ sub: 'u1', email: 'ünï@x.com' })
    expect(jwtClaims('nope')).toBeNull()
    expect(jwtClaims('a.!!!.c')).toBeNull()
  })

  it('is reused until a minute before it expires, measured on the token’s own lifetime too', () => {
    const t0 = 1_800_000_000_000
    const exp = t0 / 1000 + 900
    expect(tokenFreshUntil(jwt({ exp }), t0)).toBe(exp * 1000 - RENEW_BEFORE_MS)
    expect(tokenFreshUntil(jwt({ iat: t0 / 1000, exp }), t0)).toBe(t0 + 900_000 - RENEW_BEFORE_MS)
    // this browser's clock is 10 minutes behind the issuer's: exp alone would reuse it 10 minutes too long
    const behind = t0 - 600_000
    expect(tokenFreshUntil(jwt({ iat: t0 / 1000, exp }), behind)).toBe(behind + 900_000 - RENEW_BEFORE_MS)
    // no expiry: never reused
    expect(tokenFreshUntil(jwt({}), t0)).toBe(t0)
  })

  function tokenServer(answers: (() => Response)[]) {
    let calls = 0
    const seen: RequestInit[] = []
    const f: typeof fetch = async (u, init) => {
      expect(String(u)).toBe(`${ISSUER}/api/auth/token`)
      seen.push(init ?? {})
      return answers[Math.min(calls++, answers.length - 1)]!()
    }
    return { f, seen, calls: () => calls }
  }
  const ok = (t: string) => () => Response.json({ token: t })

  it('fetches with the session cookie, caches it, renews it when stale, and is null when signed out', async () => {
    let now = 1_800_000_000_000
    const first = jwt({ iat: now / 1000, exp: now / 1000 + 900 })
    const second = jwt({ iat: now / 1000 + 900, exp: now / 1000 + 1800 })
    const srv = tokenServer([ok(first), ok(second), () => new Response('', { status: 401 })])
    const tokens = accountTokens(ISSUER, { fetch: srv.f, now: () => now })
    expect(await Promise.all([tokens.get(), tokens.get()])).toEqual([first, first])
    expect(srv.calls()).toBe(1)
    expect(srv.seen[0]).toEqual({ credentials: 'include' })
    now += 900_000 - RENEW_BEFORE_MS - 1
    expect(await tokens.get()).toBe(first)
    now += 1
    expect(await tokens.get()).toBe(second)
    expect(srv.calls()).toBe(2)
    tokens.clear()
    expect(await tokens.get()).toBeNull()
    expect(await tokens.get()).toBeNull()
    expect(srv.calls()).toBe(4)
  })

  it('a failing or unreachable accounts service is an error, not “signed out”', async () => {
    const down = accountTokens(ISSUER, { fetch: tokenServer([() => new Response('', { status: 502 })]).f })
    await expect(down.get()).rejects.toThrow('Signing in with kacperlubisz.com failed (502).')
    const gone = accountTokens(ISSUER, {
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(gone.get()).rejects.toThrow('Can’t reach kacperlubisz.com to sign in.')
  })
})

describe('the sign-in screen', () => {
  it('offers the account; a refused account is named and can be switched', () => {
    expect(renderAccountSignIn(ISSUER, null)).toContain(
      '<button id="signin">Sign in with kacperlubisz.com</button>',
    )
    const refused = renderAccountSignIn(ISSUER, { email: '<b>eve</b>@x.com' })
    expect(refused).toContain('&lt;b&gt;eve&lt;/b&gt;@x.com can’t open the meetings on this server.')
    expect(refused).toContain('<button id="switch-account">Sign in with another account</button>')
    expect(renderAccountSignIn(ISSUER, { email: null })).toContain('This account can’t open')
  })
})
