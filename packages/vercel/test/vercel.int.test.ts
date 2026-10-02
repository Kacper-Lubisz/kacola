import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildPath,
  createClient,
  type DurableEvent,
  type GnomeolaClient,
  isDurable,
  type RouteDef,
  type RouteName,
  routes,
  type SyncItem,
} from '@gnomeola/protocol'
import { SHARE_LINK_ROUTES } from '@gnomeola/server'
import { SqliteStoreApi } from '@gnomeola/store'
import { type FakeDeepgram, startFakeDeepgram } from '@gnomeola/testkit/cloud-stt'
import { seededRandom } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { type PostgresContainer, podmanPostgresAvailable, startPostgres } from '@gnomeola/testkit/postgres'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { API_PREFIXES, RUNTIME } from '../scripts/build.ts'
import { built, type Harness, startHarness } from './harness.ts'

// H-5 verified locally, without Vercel: the Build Output this package produces, served by a harness that
// routes like Vercel's edge (config.json), runs each function's bundle as (req, res) with Vercel's
// forwarded headers, and HARD-KILLS any response still open at the function's maxDuration — here 2 s
// for /events, so the duration cap is hit many times per test. Against SQLite and, with podman, a real
// Postgres (the Neon engine family).

const SECRET = 'vercel-harness-secret-0123456789abcdef01'
const ADMIN = 'vercel-harness-admin-0123456789'

const pgUnavailable = await podmanPostgresAvailable()
let pgServer: PostgresContainer | null = null
let admin: pg.Client | null = null
let dg: FakeDeepgram
const tmp = mkdtempSync(join(tmpdir(), 'gnomeola-vercel-int-'))
beforeAll(async () => {
  dg = await startFakeDeepgram()
  if (pgUnavailable) return
  pgServer = await startPostgres()
  admin = new pg.Client({ connectionString: pgServer.url })
  await admin.connect()
}, 120_000)
afterAll(async () => {
  await dg?.close()
  await admin?.end()
  await pgServer?.stop()
  rmSync(tmp, { recursive: true, force: true })
})
let harnesses: Harness[] = []
afterEach(async () => {
  await Promise.all(harnesses.map((h) => h.close()))
  harnesses = []
})

let n = 0
async function databaseUrl(dialect: 'sqlite' | 'postgres'): Promise<string> {
  n++
  if (dialect === 'sqlite') return `sqlite:${join(tmp, `db${n}.sqlite`)}`
  await admin!.query(`CREATE DATABASE vercel${process.pid}_${n}`)
  return pgServer!.urlFor(`vercel${process.pid}_${n}`)
}

async function harness(
  dialect: 'sqlite' | 'postgres',
  env: Record<string, string> = {},
  events = 2,
): Promise<Harness> {
  const out = await built({ events, finalize: 20 })
  const h = await startHarness(out, {
    DATABASE_URL: await databaseUrl(dialect),
    GNOMEOLA_AUTH_SECRET: SECRET,
    GNOMEOLA_ADMIN_TOKEN: ADMIN,
    GNOMEOLA_BLOB_DIR: join(tmp, `blobs${n}`),
    GNOMEOLA_POLL_MS: '25',
    GNOMEOLA_STREAM_MARGIN_MS: '700',
    ...env,
  })
  harnesses.push(h)
  return h
}

/** A device's log: sessions + segments, made by a real store, as hybrid sync would push it. */
async function deviceLog(sessions: number, segments: number): Promise<DurableEvent[]> {
  const dev = SqliteStoreApi.open(':memory:')
  for (let i = 0; i < sessions; i++) {
    const s = await dev.createSession({ title: `meeting ${i} about the retry budget` })
    for (let j = 0; j < segments; j++)
      await dev.upsertSegment({
        id: `seg_${i}_${j}`,
        sessionId: s.id,
        track: j % 2 ? 'mic' : 'system',
        speaker: j % 2 ? 'me' : 'Ana',
        startMs: j * 1000,
        endMs: j * 1000 + 900,
        text: `line ${j} of meeting ${i}: retry budget is ${j}`,
        quality: 'final',
        confidence: 0.9,
      })
  }
  const log = await dev.eventsAfter(0)
  await dev.close()
  return log
}
const items = (es: DurableEvent[]): SyncItem[] => es.map((e) => ({ seq: e.seq, data: e.data }))

async function pairDevice(url: string): Promise<GnomeolaClient> {
  const anon = createClient({ baseUrl: url })
  const start = await anon.call('pairStart', { body: { name: 'laptop' } })
  await createClient({ baseUrl: url, token: ADMIN }).call('pairApprove', {
    body: { userCode: start.userCode },
  })
  const t = await anon.call('pairToken', { body: { deviceCode: start.deviceCode } })
  if (t.status !== 'approved') throw new Error('pairing failed')
  return createClient({ baseUrl: url, token: t.token, timeoutMs: 20_000 })
}

describe('the build output', () => {
  it('is Build Output API v3: routed functions with per-function maxDuration, and the static viewer', async () => {
    const out = await built({ events: 2, finalize: 20 })
    const config = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'))
    expect(config.version).toBe(3)
    const vc = (fn: string) =>
      JSON.parse(readFileSync(join(out, 'functions', '_fn', `${fn}.func`, '.vc-config.json'), 'utf8'))
    expect(vc('api')).toMatchObject({
      runtime: RUNTIME,
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      maxDuration: 30,
      supportsResponseStreaming: true,
    })
    expect(vc('events').maxDuration).toBe(2)
    expect(vc('finalize').maxDuration).toBe(20)
    // every top-level protocol path reaches a function
    for (const def of Object.values(routes) as RouteDef[])
      expect(API_PREFIXES, def.path).toContain(def.path.split('/')[1])
    const bundle = readFileSync(join(out, 'functions', '_fn', 'api.func', 'index.mjs'), 'utf8')
    // nothing local-only or native got bundled
    expect(bundle).not.toMatch(/sherpa-onnx|pw-record|PipeWireCaptureSource|pglite\.wasm/)
    // the SQLite entry (native driver) stays a lazy external import(), reached only by a sqlite: URL
    expect(bundle).toContain('import("@gnomeola/store")')
    expect(bundle).not.toMatch(/^import [^\n]*better-sqlite3/m)
    expect(readFileSync(join(out, 'static', 'index.html'), 'utf8')).toContain('/app.js')
  })
})

for (const dialect of ['sqlite', 'postgres'] as const) {
  describe.skipIf(dialect === 'postgres' && pgUnavailable !== null)(`deployed functions [${dialect}]`, () => {
    it('serves the viewer statically with security headers, and refuses to run without auth configured', async () => {
      const h = await harness(dialect)
      const page = await fetch(`${h.url}/`)
      expect(page.headers.get('content-type')).toMatch(/text\/html/)
      expect(page.headers.get('x-frame-options')).toBe('DENY')
      expect(await page.text()).toContain('kacola')
      expect((await fetch(`${h.url}/app.js`)).headers.get('content-type')).toMatch(/javascript/)

      const bare = await harness(dialect, { GNOMEOLA_AUTH_SECRET: '' })
      const r = await fetch(`${bare.url}/health`)
      expect(r.status).toBe(503)
      expect(await r.text()).toMatch(/GNOMEOLA_AUTH_SECRET/)
    })

    it('every route refuses an unauthenticated request (401) — through the function it is routed to', async () => {
      const h = await harness(dialect)
      for (const [name, def] of Object.entries(routes) as [RouteName, RouteDef][]) {
        const params = Object.fromEntries([...def.path.matchAll(/:([A-Za-z]+)/g)].map((m) => [m[1]!, 'x']))
        const res = await fetch(
          `${h.url}${buildPath(def.path, params)}${def.response === 'sse' ? '?since=0' : ''}`,
          {
            method: def.method,
            headers: def.response === 'sse' ? { accept: 'text/event-stream' } : {},
            ...(def.body ? { body: '{}' } : {}),
          },
        )
        // the pairing entry points, and a shared agenda's link routes (keyed by the link token: 404 here)
        if (name === 'pairStart' || name === 'pairToken' || SHARE_LINK_ROUTES.includes(name))
          expect(res.status, name).not.toBe(401)
        else expect(res.status, name).toBe(401)
        await res.body?.cancel()
      }
      const s = await h.stats()
      expect(s.invocations.events).toBeGreaterThanOrEqual(1)
      expect(s.invocations.finalize).toBeGreaterThanOrEqual(1)
      expect(s.invocations.api).toBeGreaterThan(20)
    })

    it('hybrid sync in, reads out: pairing, push, sessions, transcript, search', async () => {
      const h = await harness(dialect)
      const device = await pairDevice(h.url)
      const log = await deviceLog(3, 6)
      const r = await device.call('syncPush', { body: { items: items(log) } })
      expect(r).toMatchObject({ cursor: log.length, rejected: [] })
      const { sessions } = await device.call('listSessions')
      expect(sessions).toHaveLength(3)
      const t = await device.call('getTranscript', { params: { id: sessions[0]!.id } })
      expect(t.total).toBe(6)
      const hits = await device.call('search', { query: { q: 'retry budget', limit: 100 } })
      expect(hits.total).toBe(18)
      expect(hits.hits[0]!.snippet).toMatch(/\[retry] \[budget]/)
      // a re-push after a lost response is a no-op
      expect((await device.call('syncPush', { body: { items: items(log) } })).applied).toBe(0)
    })

    for (const [label, margin, platformKills] of [
      ['streams end themselves just before the 2 s cap', '700', false],
      ['streams outlive the cap and the platform kills them', '-3000', true],
    ] as const) {
      it(`SSE across the duration cap: ${label} — zero gaps, zero duplicates`, async () => {
        const h = await harness(dialect, { GNOMEOLA_STREAM_MARGIN_MS: margin })
        const device = await pairDevice(h.url)
        const log = await deviceLog(6, 25)
        const received: DurableEvent[] = []
        let ends = 0
        const ac = new AbortController()
        const sub = device.subscribe({
          since: 0,
          signal: ac.signal,
          reconnectDelayMs: 20,
          onEvent: (e) => {
            if (isDurable(e)) received.push(e)
          },
          onDisconnect: () => {
            ends++
          },
        })
        // push the log in small batches over ~6 s: the stream must span several caps
        const rnd = seededRandom(7)
        for (let at = 0; at < log.length; ) {
          const k = 1 + Math.floor(rnd() * 8)
          await device.call('syncPush', { body: { items: items(log.slice(at, at + k)) } })
          at += k
          await new Promise((r) => setTimeout(r, 150))
        }
        const last = log.length
        const deadline = performance.now() + 30_000
        while (received.at(-1)?.seq !== last && performance.now() < deadline)
          await new Promise((r) => setTimeout(r, 50))
        ac.abort()
        await sub
        assertNoViolations(checkEventLog(received))
        expect(received.map((e) => e.data)).toEqual(log.map((e) => e.data))
        expect(ends).toBeGreaterThanOrEqual(2) // ~6 s of pushes across a 2 s cap
        const s = await h.stats()
        if (platformKills) expect(s.kills.events ?? 0).toBeGreaterThanOrEqual(2)
        else expect(s.kills.events ?? 0).toBe(0)
      })
    }

    it('full offload through the finalize function: chunks in, diarized transcript out (fake Deepgram)', async () => {
      const h = await harness(dialect, { DEEPGRAM_API_KEY: 'dg-test-key', DEEPGRAM_URL: dg.url })
      const device = await pairDevice(h.url)
      const s = await device.call('createSession', { body: { title: 'offloaded' } })
      const pcm = new Uint8Array(96_000).map((_, i) => (i * 37) & 0xff)
      for (const track of ['mic', 'system'] as const)
        await device.call('putAudioChunk', {
          params: { id: s.id, chunkSeq: track === 'mic' ? '0' : '1' },
          body: {
            track,
            sampleRate: 16000,
            format: 's16le',
            data: Buffer.from(pcm).toString('base64'),
            sha256: createHash('sha256').update(pcm).digest('hex'),
          },
        })
      const done = await device.call('finalizeAudio', {
        params: { id: s.id },
        body: { chunks: { mic: 1, system: 1 }, durationMs: 3000 },
      })
      expect(done.status).toBe('stopped')
      const t = await device.call('getTranscript', { params: { id: s.id } })
      expect(t.segments.map((g) => [g.track, g.speaker])).toEqual([
        ['mic', 'me'],
        ['system', 'speaker-1'],
      ])
      expect((await h.stats()).invocations.finalize).toBe(1)
    })
  })
}
