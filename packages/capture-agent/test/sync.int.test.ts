import { createClient, type GnomeolaClient, type Session } from '@gnomeola/protocol'
import { createHostedApp, type HostedApp, type Served, serve } from '@gnomeola/server'
import { SqliteStoreApi } from '@gnomeola/store'
import { MemoryBlobStore } from '@gnomeola/store/blob'
import { type DaemonHandle, seededRandom, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { afterEach, describe, expect, it } from 'vitest'
import { SyncAgent } from '../src/sync.ts'

// H-7 — hybrid sync end to end: a REAL local daemon (child process, fake capture/STT) pushing to a local
// "remote" — the hosted server app on its own SQLite store, over HTTP, with pairing auth and a device
// token. Checked: the remote converges on exactly the public part of the local state (sessions,
// transcripts, Q&A, notes), private sessions never leave, pushes are idempotent and survive failures at
// any point (including a lost response after the server applied), and an agent restart resumes from
// the server's cursor without duplicating a single remote event.

const FAST = JSON.stringify({ segmentEveryMs: 30, finalizeAfterMs: 20, partialEveryMs: 15, levelEveryMs: 50 })
const SECRET = 'sync-test-secret-0123456789abcdef0123456'
const ADMIN = 'sync-admin-token-0123456789'

type Remote = { app: HostedApp; served: Served; store: SqliteStoreApi; url: string; client: GnomeolaClient }

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const c of cleanup.splice(0).reverse()) await c().catch(() => {})
})

async function remoteServer(): Promise<Remote> {
  const store = SqliteStoreApi.open(':memory:')
  const app = createHostedApp({
    store,
    blobs: new MemoryBlobStore(),
    auth: { secret: SECRET, adminToken: ADMIN },
    trustLoopback: false,
  })
  const served = await serve(app)
  cleanup.push(() => served.close())
  return { app, served, store, url: served.url, client: createClient({ baseUrl: served.url, token: ADMIN }) }
}

/** Pair a "laptop" with the remote the real way: device code, approval, token. */
async function pairDevice(r: Remote, name = 'laptop'): Promise<{ token: string; deviceId: string }> {
  const anon = createClient({ baseUrl: r.url })
  const start = await anon.call('pairStart', { body: { name } })
  await r.client.call('pairApprove', { body: { userCode: start.userCode } })
  const tok = await anon.call('pairToken', { body: { deviceCode: start.deviceCode } })
  if (tok.status !== 'approved') throw new Error('pairing failed')
  return tok
}

async function localDaemon(): Promise<DaemonHandle> {
  const d = await startDaemon({ env: { GNOMEOLA_FAKE_PIPELINE: FAST, GNOMEOLA_FAKE_QA: '1' } })
  cleanup.push(() => d.stop())
  return d
}

/** A recorded meeting with final segments, a question and notes. */
async function meeting(
  c: GnomeolaClient,
  title: string,
  opts: { private?: boolean; ms?: number } = {},
): Promise<Session> {
  const s = await c.call('createSession', { body: { title, private: opts.private } })
  await c.call('startSession', { params: { id: s.id } })
  await new Promise((r) => setTimeout(r, opts.ms ?? 250))
  await c.call('stopSession', { params: { id: s.id } })
  // a private meeting is only ever asked about on-device (private never goes to the cloud)
  if (opts.private) await c.call('updateSettings', { body: { llm: { provider: 'ollama' } } })
  for await (const _ of c.ask({
    question: `what happened in ${title}?`,
    sessionId: s.id,
    includePrivate: true,
  })) {
  }
  if (opts.private) await c.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
  await c.call('putNotes', {
    params: { id: s.id },
    body: { markdown: `# ${title}\n\n- [ ] Ana: follow up\n`, baseVersion: 0 },
  })
  return c.call('getSession', { params: { id: s.id }, query: { includePrivate: true } })
}

/** The public part of a server's state, as a client sees it. */
async function view(c: GnomeolaClient) {
  const { sessions } = await c.call('listSessions', { query: { limit: 500 } })
  const out = []
  for (const s of sessions.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const t = await c.call('getTranscript', { params: { id: s.id } })
    const qa = await c.call('getQaHistory', { params: { id: s.id } })
    const notes = await c.call('listNoteVersions', { params: { id: s.id } })
    out.push({
      session: { ...s, tracks: s.tracks.map((x) => ({ ...x, audioPath: null, archivePath: null })) },
      segments: t.segments,
      qa: qa.messages,
      notes: notes.versions,
    })
  }
  return out
}

describe('hybrid sync: local daemon → hosted server', () => {
  it('converges on the public state, keeps private meetings home, and is idempotent', async () => {
    const d = await localDaemon()
    const r = await remoteServer()
    const dev = await pairDevice(r)
    await meeting(d.client, 'Standup')
    const secret = await meeting(d.client, 'Salary review', { private: true })
    await meeting(d.client, 'Roadmap')

    const agent = new SyncAgent({
      local: d.client,
      remote: createClient({ baseUrl: r.url, token: dev.token }),
    })
    const first = await agent.syncOnce()
    expect(first.rejected).toBe(0)
    expect(first.remoteCursor).toBe((await d.client.call('health')).lastSeq)

    const want = await view(d.client)
    const got = await view(r.client)
    expect(got).toEqual(want)
    expect(got.map((x) => x.session.title).sort()).toEqual(['Roadmap', 'Standup'])
    expect(got.every((x) => x.segments.length > 0 && x.qa.length === 2 && x.notes.length === 1)).toBe(true)
    // the private meeting: not even its id reached the server
    expect(await r.store.getSession(secret.id)).toBeNull()
    expect(JSON.stringify(await r.store.eventsAfter(0))).not.toContain(secret.id)
    // audio never syncs; local paths do not leak
    expect(JSON.stringify(await r.store.eventsAfter(0))).not.toMatch(/\.wav/)
    // settings are device-local
    expect(await r.store.getSettings()).toBeNull()

    const remoteSeq = await r.store.lastSeq()
    const again = await agent.syncOnce()
    expect(again.pushes).toBe(0)
    expect(await r.store.lastSeq()).toBe(remoteSeq)
    // a brand-new agent (a restarted process) resumes from the server's cursor, pushing nothing old
    const fresh = await new SyncAgent({
      local: d.client,
      remote: createClient({ baseUrl: r.url, token: dev.token }),
    }).syncOnce()
    expect(fresh.pushes).toBe(0)
    expect(await r.store.syncCursor(dev.deviceId)).toBe(first.remoteCursor)
  })

  it('follows privacy changes: private → delete upstream, public again → full snapshot', async () => {
    const d = await localDaemon()
    const r = await remoteServer()
    const dev = await pairDevice(r)
    const remote = createClient({ baseUrl: r.url, token: dev.token })
    const s = await meeting(d.client, 'Board prep', { ms: 400 })
    const agent = new SyncAgent({ local: d.client, remote, batchSize: 5 }) // tiny batches: snapshot groups split
    await agent.syncOnce()
    expect(await r.store.getSession(s.id)).not.toBeNull()

    await d.client.call('updateSession', { params: { id: s.id }, body: { private: true } })
    await agent.syncOnce()
    expect(await r.store.getSession(s.id)).toBeNull()

    // edits while private stay home…
    await d.client.call('updateSession', {
      params: { id: s.id },
      body: { title: 'Board prep (confidential)' },
    })
    await d.client.call('putNotes', {
      params: { id: s.id },
      body: { markdown: 'while private', baseVersion: 1 },
    })
    await agent.syncOnce()
    expect(await r.store.getSession(s.id)).toBeNull()

    // …and arrive, complete, when it becomes public again (a snapshot bigger than one push)
    await d.client.call('updateSession', { params: { id: s.id }, body: { private: false } })
    const st = await agent.syncOnce()
    expect(st.rejected).toBe(0)
    expect(await view(r.client)).toEqual(await view(d.client))
    expect((await r.client.call('getNotes', { params: { id: s.id } })).note.markdown).toBe('while private')
    const segs = (await d.client.call('getTranscript', { params: { id: s.id } })).total
    expect(segs).toBeGreaterThan(5) // the snapshot really had to be split across pushes
  })

  it('survives failures at any point — including a lost response after the server applied — without duplicating', async () => {
    const d = await localDaemon()
    for (let i = 0; i < 4; i++) await meeting(d.client, `m${i}`)

    // reference: a clean sync to one server
    const clean = await remoteServer()
    const cleanDev = await pairDevice(clean)
    await new SyncAgent({
      local: d.client,
      remote: createClient({ baseUrl: clean.url, token: cleanDev.token }),
      batchSize: 7,
    }).syncOnce()

    // the same sync to another server through a network that drops requests before AND after delivery
    const flaky = await remoteServer()
    const dev = await pairDevice(flaky)
    const rnd = seededRandom(1234)
    let lostBefore = 0
    let lostAfter = 0
    const net: typeof fetch = async (input, init) => {
      const roll = rnd()
      if (roll < 0.2) {
        lostBefore++
        throw new TypeError('network down (before sending)')
      }
      const res = await fetch(input, init)
      if (roll < 0.4) {
        lostAfter++
        await res.body?.cancel()
        throw new TypeError('connection reset (after the server answered)')
      }
      return res
    }
    const agent = new SyncAgent({
      local: d.client,
      remote: createClient({ baseUrl: flaky.url, token: dev.token, fetch: net }),
      batchSize: 7,
      retryMinMs: 1,
      retryMaxMs: 5,
    })
    const st = await agent.syncOnce()
    expect(lostBefore).toBeGreaterThan(2)
    expect(lostAfter).toBeGreaterThan(2)
    expect(st.failures).toBe(lostBefore + lostAfter) // every failure was retried, none surfaced

    // identical remote state AND identical remote logs: not one event applied twice
    expect(await view(flaky.client)).toEqual(await view(clean.client))
    const a = await clean.store.eventsAfter(0)
    const b = await flaky.store.eventsAfter(0)
    assertNoViolations(checkEventLog(b))
    expect(b.map((e) => e.data)).toEqual(a.map((e) => e.data))
  })

  it('runs continuously: follows a live recording, and a restarted agent picks up where the server is', async () => {
    const d = await localDaemon()
    const r = await remoteServer()
    const dev = await pairDevice(r)
    const remote = createClient({ baseUrl: r.url, token: dev.token })
    const ac = new AbortController()
    const agent = new SyncAgent({ local: d.client, remote, flushMs: 50 })
    const running = agent.run(ac.signal)
    const s = await d.client.call('createSession', { body: { title: 'live' } })
    await d.client.call('startSession', { params: { id: s.id } })
    // segments reach the server while the meeting is still going
    await waitFor(
      async () => ((await r.store.transcript(s.id).catch(() => null))?.total ?? 0) >= 3,
      15_000,
      'live segments upstream',
    )
    expect((await r.store.getSession(s.id))?.status).toBe('recording')
    ac.abort()
    await running

    await d.client.call('stopSession', { params: { id: s.id } })
    const ac2 = new AbortController()
    const again = new SyncAgent({ local: d.client, remote, flushMs: 50 })
    const running2 = again.run(ac2.signal)
    const last = (await d.client.call('health')).lastSeq
    await waitFor(async () => (await r.store.syncCursor(dev.deviceId)) >= last, 15_000, 'cursor catches up')
    ac2.abort()
    await running2
    expect(await view(r.client)).toEqual(await view(d.client))
    assertNoViolations(checkEventLog(await r.store.eventsAfter(0)))
  })
})
