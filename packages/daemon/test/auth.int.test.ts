import { mkdtempSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { networkInterfaces, tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPath, createClient, PairToken, type RouteDef, type RouteName, routes } from '@gnomeola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { MemoryKeyring } from '../src/keyring.ts'

// H-6 on the local daemon: it may listen beyond loopback only with pairing auth configured, and then an
// unauthenticated remote request is refused on EVERY route — the event stream included — except the two
// routes an unpaired device uses to get a token. Loopback stays anonymous.

const SECRET = 'daemon-test-secret-0123456789abcdef012345'
const dirs: string[] = []
const daemons: Daemon[] = []
afterEach(async () => {
  await Promise.all(daemons.splice(0).map((d) => d.close()))
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
async function daemon(o: Partial<Parameters<typeof createDaemon>[0]> = {}): Promise<Daemon> {
  const dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-auth-'))
  dirs.push(dataDir)
  const d = await createDaemon({
    dataDir,
    port: 0,
    keyring: new MemoryKeyring(),
    env: {},
    heartbeatMs: 50,
    ...o,
  })
  daemons.push(d)
  return d
}

/** A LAN address of this machine, to make a genuinely non-loopback connection. */
const lanAddress = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address

/** Raw request with full control of the Host header. */
function raw(url: string, path: string, method: string, headers: Record<string, string> = {}, body?: string) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>(
    (resolve, reject) => {
      const u = new URL(url)
      const req = request(
        {
          host: u.hostname,
          port: u.port,
          path,
          method,
          headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
        },
        (res) => {
          let text = ''
          // an event stream would never end: read the first chunk only, then drop the connection
          res.on('data', (c: Buffer) => {
            text += c.toString()
            if (res.headers['content-type']?.includes('event-stream')) res.destroy()
          })
          res.on('close', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }))
        },
      )
      req.on('error', reject)
      req.end(body)
    },
  )
}

function pathFor(def: RouteDef): string {
  const params = Object.fromEntries([...def.path.matchAll(/:([A-Za-z]+)/g)].map((m) => [m[1]!, 'x']))
  return buildPath(def.path, params) + (def.response === 'sse' ? '?since=0' : '')
}

describe('binding beyond loopback', () => {
  it('is refused without pairing auth, and allowed with it', async () => {
    await expect(daemon({ host: '0.0.0.0' })).rejects.toThrow(/without pairing auth/)
    const d = await daemon({ host: '0.0.0.0', auth: { secret: SECRET } })
    expect(d.host).toBe('0.0.0.0')
  })

  it('without auth, a foreign Host header is still refused (DNS rebinding), as before', async () => {
    const d = await daemon()
    const r = await raw(d.url, '/health', 'GET', { host: 'evil.example' })
    expect(r.status).toBe(403)
    expect((await raw(d.url, '/health', 'GET')).status).toBe(200)
  })
})

describe('an unauthenticated remote request is refused on every route', () => {
  it('401 with a Bearer challenge on all routes but pairStart/pairToken — SSE included (loopback treated as remote)', async () => {
    const d = await daemon({ auth: { secret: SECRET }, trustLoopback: false })
    const open: RouteName[] = []
    for (const [name, def] of Object.entries(routes) as [RouteName, RouteDef][]) {
      const r = await raw(
        d.url,
        pathFor(def),
        def.method,
        def.response === 'sse' ? { accept: 'text/event-stream' } : {},
        def.body ? '{}' : undefined,
      )
      if (name === 'pairStart' || name === 'pairToken') {
        expect(r.status, name).not.toBe(401)
        open.push(name)
        continue
      }
      expect(r.status, name).toBe(401)
      expect(r.headers['www-authenticate'], name).toMatch(/^Bearer/)
      expect(String(r.headers['content-type']), name).toMatch(/json/)
      expect(JSON.parse(r.body), name).toMatchObject({ error: { code: 'unauthorized' } })
    }
    expect(open.sort()).toEqual(['pairStart', 'pairToken'])
    expect(d.sseClients).toBe(0) // no stream was ever opened for an unauthenticated caller
  })

  it('a loopback socket with a proxy header or a foreign Host is remote too', async () => {
    const d = await daemon({ auth: { secret: SECRET } })
    expect((await raw(d.url, '/sessions', 'GET')).status).toBe(200) // plain loopback: anonymous owner
    expect((await raw(d.url, '/sessions', 'GET', { 'x-forwarded-for': '198.51.100.1' })).status).toBe(401)
    expect((await raw(d.url, '/sessions', 'GET', { host: 'evil.example' })).status).toBe(401)
    expect(
      (await raw(d.url, '/events?since=0', 'GET', { host: 'evil.example', accept: 'text/event-stream' }))
        .status,
    ).toBe(401)
  })
})

describe.skipIf(!lanAddress)(`a real remote connection (via ${lanAddress ?? 'no LAN address'})`, () => {
  it('pairs by device code approved on the machine itself, then streams with the token; revocation is immediate', async () => {
    const d = await daemon({ host: '0.0.0.0', auth: { secret: SECRET } })
    const remoteUrl = `http://${lanAddress}:${d.port}`
    const local = createClient({ baseUrl: `http://127.0.0.1:${d.port}` })
    const anonRemote = createClient({ baseUrl: remoteUrl })
    await local.call('createSession', { body: { title: 'visible to paired devices' } })

    await expect(anonRemote.call('listSessions')).rejects.toMatchObject({ status: 401 })
    // spoofing a loopback Host from a remote socket buys nothing
    expect((await raw(remoteUrl, '/sessions', 'GET', { host: '127.0.0.1' })).status).toBe(401)
    expect((await raw(remoteUrl, '/events?since=0', 'GET', { accept: 'text/event-stream' })).status).toBe(401)

    const start = await anonRemote.call('pairStart', { body: { name: 'phone' } })
    // a remote, unpaired device cannot approve itself
    await expect(
      anonRemote.call('pairApprove', { body: { userCode: start.userCode } }),
    ).rejects.toMatchObject({ status: 401 })
    // the owner, at the machine (loopback, anonymous), approves
    await local.call('pairApprove', { body: { userCode: start.userCode } })
    const tok = PairToken.parse(
      await anonRemote.call('pairToken', { body: { deviceCode: start.deviceCode } }),
    )
    if (tok.status !== 'approved') throw new Error('not approved')

    const phone = createClient({ baseUrl: remoteUrl, token: tok.token })
    expect((await phone.call('listSessions')).sessions.map((s) => s.title)).toEqual([
      'visible to paired devices',
    ])
    const it = phone.stream('events', { query: { since: 0 } })
    const first = await it.next()
    expect(JSON.parse(first.value!.data).seq).toBe(1)
    await it.return(undefined)

    await createClient({ baseUrl: `http://127.0.0.1:${d.port}` }) // (loopback still anonymous)
      .call('health')
    const { SqliteStoreApi } = await import('@gnomeola/store')
    expect(await new SqliteStoreApi(d.store).revokeDevice(tok.deviceId, new Date())).toBe(true)
    await expect(phone.call('listSessions')).rejects.toMatchObject({ status: 401 })
  })
})
