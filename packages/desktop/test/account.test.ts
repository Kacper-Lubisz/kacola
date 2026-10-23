import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { AUTH_CALLBACK, CLIENT_ID, finishSignIn, isAuthCallback, startSignIn } from '../src/main/account.ts'

// Signing two-way sync in: the authorization request the browser opens, and the callback's checks.

const target = { issuer: 'https://accounts.example.com/', resource: 'https://kacola.example.com' }

describe('sync sign-in', () => {
  it('asks for a code with PKCE (S256) for this server, back on kacola://auth/callback', async () => {
    const p = await startSignIn(target)
    const u = new URL(p.url)
    expect(u.origin + u.pathname).toBe('https://accounts.example.com/api/auth/oauth2/authorize')
    const q = u.searchParams
    expect(Object.fromEntries(q)).toMatchObject({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: AUTH_CALLBACK,
      code_challenge_method: 'S256',
      resource: target.resource,
      state: p.state,
    })
    expect(q.get('scope')).toContain('offline_access')
    expect(q.get('code_challenge')).toBe(createHash('sha256').update(p.verifier).digest('base64url'))
    // each request is its own
    expect((await startSignIn(target)).state).not.toBe(p.state)
  })

  it('knows its callback, and nothing else', () => {
    expect(isAuthCallback('kacola://auth/callback?code=x&state=y')).toBe(true)
    expect(isAuthCallback('kacola://meeting/abc')).toBe(false)
    expect(isAuthCallback(42)).toBe(false)
  })

  it('trades the code for a refresh token, reading the email from the id token', async () => {
    const p = await startSignIn(target)
    const idToken = `x.${Buffer.from(JSON.stringify({ email: 'me@example.com' })).toString('base64url')}.y`
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body))
      expect(body.get('code_verifier')).toBe(p.verifier)
      expect(body.get('code')).toBe('the-code')
      return Response.json({ access_token: 'a', refresh_token: 'r', id_token: idToken, expires_in: 3600 })
    })
    expect(
      await finishSignIn(`${AUTH_CALLBACK}?code=the-code&state=${p.state}`, p, fetchImpl as never),
    ).toEqual({
      refreshToken: 'r',
      email: 'me@example.com',
    })
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://accounts.example.com/api/auth/oauth2/token')
  })

  it('refuses a callback it did not start, and says why the service refused', async () => {
    const p = await startSignIn(target)
    const never = vi.fn()
    await expect(finishSignIn(`${AUTH_CALLBACK}?code=c&state=other`, p, never as never)).rejects.toThrow(
      /not started here/,
    )
    await expect(finishSignIn(`${AUTH_CALLBACK}?error=access_denied`, p, never as never)).rejects.toThrow(
      /access_denied/,
    )
    expect(never).not.toHaveBeenCalled()
    const refused = async () =>
      Response.json({ error: 'invalid_grant', error_description: 'code used' }, { status: 400 })
    await expect(
      finishSignIn(`${AUTH_CALLBACK}?code=c&state=${p.state}`, p, refused as never),
    ).rejects.toThrow(/code used/)
  })
})
