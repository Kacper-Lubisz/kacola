import {
  buildPath,
  createClient,
  PairStart,
  PairToken,
  type RouteDef,
  type RouteName,
  routes,
} from '@kacola/protocol'
import { MemoryBlobStore } from '@kacola/store/blob'
import { afterEach, describe, expect, it } from 'vitest'
import { createHostedApp, type HostedApp } from '../src/app.ts'
import { isLoopbackRequest, OPEN_ROUTES, signToken, verifyToken } from '../src/auth.ts'
import { SHARE_LINK_ROUTES } from '../src/sharing.ts'
import { ADMIN, type Hosted, openStore, SECRET, startHosted } from './helpers.ts'

// H-6: pairing auth. Loopback may stay anonymous; a remote request ALWAYS needs a valid token — on every
// route, the event stream included — except the two routes a device uses to obtain one.

const REMOTE = { remoteAddress: '203.0.113.7' }
const LOOPBACK = { remoteAddress: '127.0.0.1' }
const entries = Object.entries(routes) as [RouteName, RouteDef][]

/** A request for every route, with placeholder params and an (invalid) body: auth must answer first. */
function requestFor(
  _name: RouteName,
  def: RouteDef,
  host = 'kacola.example',
  headers: Record<string, string> = {},
) {
  const params = Object.fromEntries([...def.path.matchAll(/:([A-Za-z]+)/g)].map((m) => [m[1]!, 'x']))
  const url = `https://${host}${buildPath(def.path, params)}${def.response === 'sse' ? '?since=0' : ''}`
  return new Request(url, {
    method: def.method,
    headers: { host, ...headers, ...(def.response === 'sse' ? { accept: 'text/event-stream' } : {}) },
    ...(def.body ? { body: '{}' } : {}),
  })
}

let apps: HostedApp[] = []
let servers: Hosted[] = []
afterEach(async () => {
  await Promise.all(apps.map((a) => a.store.close()))
  await Promise.all(servers.map((s) => s.close()))
  apps = []
  servers = []
})
async function app(o: { auth?: boolean; trustLoopback?: boolean } = {}) {
  const a = createHostedApp({
    store: await openStore('sqlite'),
    blobs: new MemoryBlobStore(),
    auth: o.auth === false ? null : { secret: SECRET, adminToken: ADMIN },
    trustLoopback: o.trustLoopback,
    maxStreamMs: 200,
  })
  apps.push(a)
  return a
}

describe('tokens', () => {
  it('sign and verify; any change to payload, signature or secret fails', () => {
    const t = signToken(SECRET, 'dev_abc', new Date('2026-09-01T00:00:00Z'))
    expect(verifyToken(SECRET, t)).toEqual({
      deviceId: 'dev_abc',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
    })
    const [p, payload, sig] = t.split('.') as [string, string, string]
    const forged = Buffer.from(JSON.stringify({ d: 'dev_admin', i: 1 })).toString('base64url')
    expect(verifyToken(SECRET, `${p}.${forged}.${sig}`)).toBeNull()
    expect(verifyToken(SECRET, `${p}.${payload}.${sig.slice(0, -2)}AA`)).toBeNull()
    expect(verifyToken(`${SECRET}x`, t)).toBeNull()
    for (const bad of ['', 'gnm1', 'gnm1.a.b', 'x.y.z', `gnm2.${payload}.${sig}`, 'gnm1..'])
      expect(verifyToken(SECRET, bad), bad).toBeNull()
  })

  it('refuse a weak secret or admin token at startup', async () => {
    const store = await openStore('sqlite')
    expect(() => createHostedApp({ store, blobs: new MemoryBlobStore(), auth: { secret: 'short' } })).toThrow(
      /32/,
    )
    expect(() =>
      createHostedApp({ store, blobs: new MemoryBlobStore(), auth: { secret: SECRET, adminToken: 'x' } }),
    ).toThrow(/16/)
    await store.close()
  })
})

describe('loopback detection', () => {
  it('needs a loopback socket AND a loopback Host AND no proxy headers', () => {
    expect(isLoopbackRequest({ remoteAddress: '127.0.0.1', host: '127.0.0.1:8787' })).toBe(true)
    expect(isLoopbackRequest({ remoteAddress: '::1', host: '[::1]:8787' })).toBe(true)
    expect(isLoopbackRequest({ remoteAddress: '::ffff:127.0.0.1', host: 'localhost' })).toBe(true)
    expect(isLoopbackRequest({ remoteAddress: '192.168.1.5', host: '127.0.0.1' })).toBe(false)
    // DNS rebinding: a loopback socket but a foreign Host
    expect(isLoopbackRequest({ remoteAddress: '127.0.0.1', host: 'evil.example' })).toBe(false)
    // a reverse proxy on the same machine: loopback socket, but it forwarded someone else's request
    expect(isLoopbackRequest({ remoteAddress: '127.0.0.1', host: '127.0.0.1', forwarded: true })).toBe(false)
    expect(isLoopbackRequest({ host: '127.0.0.1' })).toBe(false)
  })
})

describe('every route refuses an unauthenticated remote request', () => {
  it('401 + WWW-Authenticate on every route but the pairing entry points and a shared agenda link, SSE included', async () => {
    const a = await app()
    const open: RouteName[] = []
    for (const [name, def] of entries) {
      const res = await a.fetch(requestFor(name, def), REMOTE)
      if (OPEN_ROUTES.has(name) || SHARE_LINK_ROUTES.includes(name)) {
        expect(res.status, name).not.toBe(401)
        open.push(name)
        await res.body?.cancel()
        continue
      }
      expect(res.status, name).toBe(401)
      expect(res.headers.get('www-authenticate'), name).toMatch(/^Bearer/)
      expect(res.headers.get('content-type'), name).toMatch(/json/) // never an event stream
      expect(await res.json(), name).toMatchObject({ error: { code: 'unauthorized' } })
    }
    // the link routes are keyed by the link token (an unknown one is a 404), not by pairing
    expect(open.sort()).toEqual(['pairStart', 'pairToken', ...SHARE_LINK_ROUTES].sort())
  })

  it('refuses forged, garbage and wrongly-schemed credentials the same way', async () => {
    const a = await app()
    const forged = signToken(`${SECRET}-other`, 'dev_x', new Date())
    const unknown = signToken(SECRET, 'dev_never_paired', new Date())
    for (const authz of [
      `Bearer ${forged}`,
      `Bearer ${unknown}`,
      'Bearer ',
      `Basic ${ADMIN}`,
      ADMIN,
      `Bearer ${ADMIN}x`,
    ])
      for (const name of ['listSessions', 'events', 'syncPush', 'pairApprove'] as const) {
        const res = await a.fetch(requestFor(name, routes[name], undefined, { authorization: authz }), REMOTE)
        expect(res.status, `${name} ${authz}`).toBe(401)
        await res.body?.cancel()
      }
  })

  it('a loopback proxy hop, a foreign Host on loopback, or trustLoopback=false all require a token', async () => {
    const a = await app()
    const def = routes.listSessions
    const via = await a.fetch(
      requestFor('listSessions', def, '127.0.0.1', { 'x-forwarded-for': '198.51.100.1' }),
      LOOPBACK,
    )
    expect(via.status).toBe(401)
    const rebinding = await a.fetch(requestFor('listSessions', def, 'evil.example'), LOOPBACK)
    expect(rebinding.status).toBe(401)
    const ok = await a.fetch(requestFor('listSessions', def, '127.0.0.1'), LOOPBACK)
    expect(ok.status).toBe(200)
    const strict = await app({ trustLoopback: false })
    expect((await strict.fetch(requestFor('listSessions', def, '127.0.0.1'), LOOPBACK)).status).toBe(401)
  })

  it('a server with no auth configured answers loopback only — even the pairing routes refuse remote', async () => {
    const a = await app({ auth: false })
    for (const [name, def] of entries) {
      const res = await a.fetch(requestFor(name, def), REMOTE)
      expect(res.status, name).toBe(401)
    }
    expect((await a.fetch(requestFor('health', routes.health, '127.0.0.1'), LOOPBACK)).status).toBe(200)
  })
})

describe('pairing: device code → approval → signed token', () => {
  it('end to end over HTTP, with the token issued exactly once and revocation immediate', async () => {
    const h = await startHosted({ auth: { secret: SECRET, adminToken: ADMIN }, trustLoopback: false })
    servers.push(h)
    const anon = createClient({ baseUrl: h.url })
    const admin = createClient({ baseUrl: h.url, token: ADMIN })

    const start = PairStart.parse(await anon.call('pairStart', { body: { name: 'Kacper’s phone' } }))
    expect(start.userCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(start.verificationPath).toBe(`/#/pair/${start.userCode}`)
    expect(await anon.call('pairToken', { body: { deviceCode: start.deviceCode } })).toEqual({
      status: 'pending',
    })

    // approval needs a trusted caller: anonymous is refused, the owner (admin token) is not
    await expect(anon.call('pairApprove', { body: { userCode: start.userCode } })).rejects.toMatchObject({
      status: 401,
    })
    // lower-case and without the dash, as people type it
    const approved = await admin.call('pairApprove', {
      body: { userCode: start.userCode.replace('-', '').toLowerCase() },
    })
    expect(approved).toMatchObject({ approved: true, name: 'Kacper’s phone' })

    const tok = PairToken.parse(await anon.call('pairToken', { body: { deviceCode: start.deviceCode } }))
    if (tok.status !== 'approved') throw new Error('expected a token')
    expect(tok.deviceId).toBe(approved.deviceId)
    await expect(anon.call('pairToken', { body: { deviceCode: start.deviceCode } })).rejects.toMatchObject({
      status: 404,
    })

    const phone = createClient({ baseUrl: h.url, token: tok.token })
    expect((await phone.call('health')).ok).toBe(true)
    // a paired device can approve the next one (you pair your laptop from your phone)
    const next = await anon.call('pairStart', { body: { name: 'laptop' } })
    expect((await phone.call('pairApprove', { body: { userCode: next.userCode } })).approved).toBe(true)
    // sync from a device token is attributed to that device, whatever the body claims
    expect((await phone.call('syncPush', { body: { deviceId: 'spoofed', items: [] } })).deviceId).toBe(
      tok.deviceId,
    )

    // revocation through the API (by the owner): immediate, and only once
    expect(await admin.call('pairRevoke', { body: { deviceId: tok.deviceId } })).toEqual({ revoked: true })
    expect(await admin.call('pairRevoke', { body: { deviceId: tok.deviceId } })).toEqual({ revoked: false })
    await expect(phone.call('health')).rejects.toMatchObject({ status: 401 })
    await expect(admin.call('pairApprove', { body: { userCode: 'ZZZZ-ZZZZ' } })).rejects.toMatchObject({
      status: 404,
    })
  })
})
