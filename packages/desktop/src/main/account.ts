// Signing the daemon's two-way sync in with the accounts service (accounts.kacperlubisz.com): OAuth 2
// authorization code + PKCE in the system browser (where the user's passkeys are), back to the app on
// kacola://auth/callback. That link carries a one-time code, not a page: it never reaches the renderer
// or the deep-link queue. The window only runs this hand-over; the refresh token goes straight to the
// daemon (PUT /sync/account), which keeps it in the keyring and renews access itself.

export const CLIENT_ID = 'kacola-desktop'
export const AUTH_CALLBACK = 'kacola://auth/callback'

export type SignInTarget = { issuer: string; resource: string }
export type PendingSignIn = SignInTarget & { url: string; verifier: string; state: string }
export type SignedIn = { refreshToken: string; email: string | null }

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')

export function isAuthCallback(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length <= 4000 && raw.toLowerCase().startsWith(AUTH_CALLBACK)
}

/** A fresh sign-in request: the URL to open in the browser, and what to keep until the callback. */
export async function startSignIn(t: SignInTarget): Promise<PendingSignIn> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  )
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: AUTH_CALLBACK,
    scope: 'openid email offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    resource: t.resource,
  })
  return { ...t, url: `${t.issuer.replace(/\/+$/, '')}/api/auth/oauth2/authorize?${q}`, verifier, state }
}

/** The email in an OIDC id token (decoded, not verified: it is only shown, never trusted). */
function emailOf(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

/** The browser came back: check it answers our request, and trade the code for tokens. */
export async function finishSignIn(
  callback: string,
  pending: PendingSignIn,
  fetchImpl: typeof fetch = fetch,
): Promise<SignedIn> {
  const q = new URL(callback).searchParams
  if (q.get('error')) throw new Error(q.get('error_description') ?? q.get('error')!)
  if (q.get('state') !== pending.state) throw new Error('this sign-in was not started here')
  const code = q.get('code')
  if (!code) throw new Error('the sign-in came back without a code')
  const res = await fetchImpl(`${pending.issuer.replace(/\/+$/, '')}/api/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: AUTH_CALLBACK,
      code_verifier: pending.verifier,
      client_id: CLIENT_ID,
      resource: pending.resource,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.error_description ?? json.error ?? `HTTP ${res.status}`))
  if (typeof json.refresh_token !== 'string') throw new Error('the accounts service gave no refresh token')
  return { refreshToken: json.refresh_token, email: emailOf(json.id_token) }
}
