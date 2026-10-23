import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createClient, type KacolaClient, type Session } from '@kacola/protocol'
import { createHostedApp, serve } from '@kacola/server'
import { SqliteStoreApi } from '@kacola/store'
import { MemoryBlobStore } from '@kacola/store/blob'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Two-way sync end to end: two REAL local daemons ("Mac A" and "Mac B", fake capture/STT) and the hosted
// server app, signed in the way the window signs them in — an account from an accounts service (a small
// stand-in here: JWKS + the OAuth refresh grant, as accounts.kacperlubisz.com serves them). Each daemon
// pushes its own changes and pulls the other's. Checked: a meeting recorded on A arrives on B, notes edited
// on B arrive on A, two edits at once converge with both kept, a rename on B keeps A's audio, deleting on B
// leaves A's recording, nothing echoes once quiet, and another account is refused.

const FAST = JSON.stringify({ segmentEveryMs: 30, finalizeAfterMs: 20, partialEveryMs: 15, levelEveryMs: 50 })
const OWNER = 'user_owner'

let issuer = ''
let resource = ''
let accounts: Server
let sign: (sub: string, email: string) => Promise<string>
let remote: { store: SqliteStoreApi; url: string; close: () => Promise<void> }
let a: DaemonHandle
let b: DaemonHandle

/** accounts.kacperlubisz.com, as far as kacola uses it: published keys and the refresh grant. */
async function fakeAccounts(): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' }
  sign = (sub, email) =>
    new SignJWT({ email })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(resource)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)
  let n = 0
  accounts = createServer(async (req, res) => {
    if (req.url === '/api/auth/jwks') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (req.url === '/api/auth/oauth2/token' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const q = new URLSearchParams(body)
      const rt = q.get('refresh_token') ?? ''
      if (
        q.get('grant_type') !== 'refresh_token' ||
        !rt.startsWith('rt-owner') ||
        q.get('resource') !== resource
      ) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'invalid_grant' }))
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          access_token: await sign(OWNER, 'owner@example.com'),
          refresh_token: `rt-owner-${++n}`,
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      )
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((r) => accounts.listen(0, '127.0.0.1', r))
  issuer = `http://127.0.0.1:${(accounts.address() as AddressInfo).port}`
}

async function signIn(d: DaemonHandle): Promise<void> {
  const s = await d.client.call('setSyncAccount', {
    body: {
      issuer,
      clientId: 'kacola-desktop',
      resource,
      refreshToken: 'rt-owner-0',
      email: 'owner@example.com',
    },
  })
  expect(s).toMatchObject({ state: 'syncing', email: 'owner@example.com' })
}

const syncedDaemon = () => startDaemon({ env: { KACOLA_FAKE_PIPELINE: FAST, KACOLA_SYNC_URL: remote.url } })

beforeAll(async () => {
  await fakeAccounts()
  const store = SqliteStoreApi.open(':memory:')
  // the audience is the server's own URL: its port is chosen first
  const port = await freePort()
  resource = `http://127.0.0.1:${port}`
  const app = createHostedApp({
    store,
    blobs: new MemoryBlobStore(),
    auth: { secret: 's'.repeat(40), accounts: { issuer, audience: resource, owners: [OWNER] } },
    trustLoopback: false,
  })
  const served = await serve(app, { host: '127.0.0.1', port })
  remote = { store, url: served.url, close: () => served.close() }
  a = await syncedDaemon()
  b = await syncedDaemon()
  await signIn(a)
  await signIn(b)
}, 60_000)

afterAll(async () => {
  await a?.stop()
  await b?.stop()
  await remote?.close()
  accounts?.close()
})

async function record(c: KacolaClient, title: string): Promise<Session> {
  const s = await c.call('createSession', { body: { title } })
  await c.call('startSession', { params: { id: s.id } })
  await new Promise((r) => setTimeout(r, 300))
  await c.call('stopSession', { params: { id: s.id } })
  await c.call('putNotes', { params: { id: s.id }, body: { markdown: `# ${title}\n`, baseVersion: 0 } })
  return c.call('getSession', { params: { id: s.id } })
}

const sessionOn = (d: DaemonHandle, id: string) =>
  d.client.call('getSession', { params: { id }, query: { includePrivate: true } }).catch(() => null)
const notesOn = async (d: DaemonHandle, id: string) =>
  (await d.client.call('getNotes', { params: { id } })).note.markdown
const historyOn = async (d: DaemonHandle, id: string) =>
  (await d.client.call('listNoteVersions', { params: { id } })).versions.map((v) => v.markdown).sort()

/** Both daemons have pushed and pulled everything: the server's log stops growing for 1.5 s. */
async function quiet(): Promise<void> {
  const deadline = Date.now() + 20_000
  let last = await remote.store.lastSeq()
  for (;;) {
    await new Promise((r) => setTimeout(r, 1_500))
    const now = await remote.store.lastSeq()
    if (now === last) return
    if (Date.now() > deadline) throw new Error('sync did not go quiet')
    last = now
  }
}

async function freePort(): Promise<number> {
  const s = createServer()
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r))
  const port = (s.address() as AddressInfo).port
  await new Promise((r) => s.close(r))
  return port
}

describe('two-way sync between two signed-in devices', () => {
  let meeting: Session

  it('a meeting recorded on A arrives on B: transcript and notes, marked as A’s', async () => {
    meeting = await record(a.client, 'Standup on A')
    const there = await waitFor(() => sessionOn(b, meeting.id), 15_000, 'the meeting on B')
    expect(there.origin).toMatch(/^dev_/)
    expect(there.title).toBe('Standup on A')
    // audio never syncs
    expect(there.tracks.every((t) => t.audioPath === null)).toBe(true)
    await waitFor(async () => (await notesOn(b, meeting.id)) === '# Standup on A\n', 15_000, 'notes on B')
    const ta = await a.client.call('getTranscript', { params: { id: meeting.id } })
    await waitFor(
      async () =>
        (await b.client.call('getTranscript', { params: { id: meeting.id } })).segments.length ===
        ta.segments.length,
      15_000,
      'the transcript on B',
    )
    // A's own copy is A's: no origin
    expect((await sessionOn(a, meeting.id))!.origin).toBeUndefined()
  })

  it('notes edited on B arrive on A', async () => {
    const head = (await b.client.call('getNotes', { params: { id: meeting.id } })).note
    await b.client.call('putNotes', {
      params: { id: meeting.id },
      body: { markdown: '# Standup on A\n\n- from B\n', baseVersion: head.version },
    })
    await waitFor(async () => (await notesOn(a, meeting.id)).includes('from B'), 15_000, 'B’s edit on A')
  })

  it('two edits at once: both kept on both devices, the same text current everywhere', async () => {
    await quiet()
    const [ha, hb] = (
      await Promise.all([
        a.client.call('getNotes', { params: { id: meeting.id } }),
        b.client.call('getNotes', { params: { id: meeting.id } }),
      ])
    ).map((r) => r.note)
    await Promise.all([
      a.client.call('putNotes', {
        params: { id: meeting.id },
        body: { markdown: 'A wins?\n', baseVersion: ha!.version },
      }),
      b.client.call('putNotes', {
        params: { id: meeting.id },
        body: { markdown: 'B wins?\n', baseVersion: hb!.version },
      }),
    ])
    await quiet()
    for (const d of [a, b])
      expect(await historyOn(d, meeting.id)).toEqual(expect.arrayContaining(['A wins?\n', 'B wins?\n']))
    const heads = await Promise.all([notesOn(a, meeting.id), notesOn(b, meeting.id)])
    expect(heads[0]).toBe(heads[1])
    expect(['A wins?\n', 'B wins?\n']).toContain(heads[0])
  })

  it('a rename on B reaches A, and A keeps its audio', async () => {
    await b.client.call('updateSession', { params: { id: meeting.id }, body: { title: 'Renamed on B' } })
    const onA = await waitFor(
      async () => {
        const s = await sessionOn(a, meeting.id)
        return s?.title === 'Renamed on B' ? s : null
      },
      15_000,
      'the rename on A',
    )
    expect(onA.tracks).toEqual(meeting.tracks)
    expect(onA.tracks.some((t) => t.audioPath !== null)).toBe(true)
    expect(onA.origin).toBeUndefined()
  })

  it('deleting on B leaves A’s recording and the server’s copy', async () => {
    await b.client.call('deleteSession', { params: { id: meeting.id } })
    await quiet()
    expect(await sessionOn(b, meeting.id)).toBeNull()
    expect(await sessionOn(a, meeting.id)).not.toBeNull()
    expect(await remote.store.getSession(meeting.id)).not.toBeNull()
  })

  it('nothing echoes: once quiet, the server log stays still', async () => {
    await quiet()
    const seq = await remote.store.lastSeq()
    await new Promise((r) => setTimeout(r, 3_000))
    expect(await remote.store.lastSeq()).toBe(seq)
  })

  it('a recording live on A is left alone when B restarts (B does not recover what it is not recording)', async () => {
    const live = await a.client.call('createSession', { body: { title: 'Live on A' } })
    await a.client.call('startSession', { params: { id: live.id } })
    await waitFor(
      async () => (await sessionOn(b, live.id))?.status === 'recording' || null,
      15_000,
      'B to see it live',
    )
    await b.restart()
    await signIn(b)
    await new Promise((r) => setTimeout(r, 2_000))
    expect((await sessionOn(b, live.id))?.status).toBe('recording')
    expect((await sessionOn(a, live.id))?.status).toBe('recording')
    expect((await remote.store.getSession(live.id))?.status).toBe('recording')
    await a.client.call('stopSession', { params: { id: live.id } })
    await waitFor(
      async () => (await sessionOn(b, live.id))?.status === 'stopped' || null,
      15_000,
      'the stop on B',
    )
  })

  it('another account, or none, is refused by the server', async () => {
    const stranger = createClient({
      baseUrl: remote.url,
      token: await sign('user_stranger', 'x@example.com'),
    })
    await expect(
      stranger.call('syncCursor', { query: { deviceId: 'dev_strangerdevice' } }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      createClient({ baseUrl: remote.url }).call('syncCursor', { query: {} }),
    ).rejects.toMatchObject({ status: 401 })
  })
})
