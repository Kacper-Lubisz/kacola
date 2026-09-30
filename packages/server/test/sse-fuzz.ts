import { AnyEvent, createClient, type DurableEvent, isDurable, newId } from '@gnomeola/protocol'
import type { StoreApi } from '@gnomeola/store/core'
import { seededRandom } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { type PostgresContainer, podmanPostgresAvailable, startPostgres } from '@gnomeola/testkit/postgres'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cuttingFetch, type Dialect, type Hosted, openStore, sleep, startHosted, waitFor } from './helpers.ts'

// H-4 / V-8 — cursor-resumable SSE proven against the function duration cap. The plan's version kills a
// connection at 300 s; here the cap is ~150 ms so it is hit dozens of times per test, and on top of it
// every connection is ALSO cut at a random byte offset (often mid-message). Meanwhile a writer keeps
// committing. The durable stream the client reconstructs must equal the store's log exactly: zero gaps,
// zero duplicates. Run against SQLite, Postgres (PGlite) and — when podman is available — a real
// Postgres server with the writer on a separate connection pool, as a second function instance would be.

const pgUnavailable = await podmanPostgresAvailable()
let server: PostgresContainer | null = null
let admin: pg.Client | null = null
beforeAll(async () => {
  if (pgUnavailable) return
  server = await startPostgres()
  admin = new pg.Client({ connectionString: server.url })
  await admin.connect()
}, 120_000)
afterAll(async () => {
  await admin?.end()
  await server?.stop()
})
let dbN = 0
async function realPostgres(): Promise<Dialect> {
  const name = `sse${process.pid}_${++dbN}`
  await admin!.query(`CREATE DATABASE ${name}`)
  return { postgresUrl: server!.urlFor(name) }
}

let open: { close(): Promise<void> }[] = []
let producers: { stop(): Promise<void> }[] = []
afterEach(async () => {
  await Promise.all(producers.map((p) => p.stop().catch(() => {})))
  await Promise.all(open.map((o) => o.close()))
  open = []
  producers = []
})

async function setup(dialect: Dialect, maxStreamMs: number): Promise<{ h: Hosted; writer: StoreApi }> {
  const h = await startHosted({ dialect, maxStreamMs, pollMs: 15, heartbeatMs: 40, replayPageSize: 25 })
  open.push(h)
  // On a real server the writer is another instance with its own pool: no in-process wake-up, the
  // stream only learns about its commits by polling — exactly the Vercel situation.
  const writer = typeof dialect === 'object' ? await openStore(dialect) : h.store
  if (writer !== h.store) open.push(writer)
  return { h, writer }
}

/** Keep the log growing (sessions, segments, revisions, deletes) until stop(). */
function produce(store: StoreApi, rnd: () => number) {
  let running = true
  const done = (async () => {
    const sessions: string[] = []
    let n = 0
    while (running) {
      const r = rnd()
      if (!sessions.length || r < 0.1) sessions.push((await store.createSession({ title: `s${n}` })).id)
      else if (r < 0.13 && sessions.length > 3) await store.deleteSession(sessions.shift()!)
      else
        await store.upsertSegment({
          id: newId('seg'),
          sessionId: sessions[Math.floor(rnd() * sessions.length)]!,
          track: 'system',
          speaker: 'them',
          startMs: n,
          endMs: n + 10,
          text: `line ${n} ${'x'.repeat(Math.floor(rnd() * 300))}`,
          quality: 'live',
          confidence: null,
        })
      n++
      if (rnd() < 0.3) await sleep(1 + Math.floor(rnd() * 4))
    }
  })()
  const p = {
    async stop() {
      running = false
      await done
    },
  }
  producers.push(p)
  return p
}

const dialects: [string, () => Promise<Dialect>, boolean][] = [
  ['sqlite', async () => 'sqlite', true],
  ['postgres/pglite', async () => 'pglite', true],
  ['postgres/server', realPostgres, pgUnavailable === null],
]
if (pgUnavailable) console.warn(`[skip] real-Postgres SSE fuzz: ${pgUnavailable}`)

/** The suite, run by the int tier with one seed and by the e2e tier with more. */
export function sseFuzz(seeds: number[], rawConnections: number): void {
  for (const [label, dialect, enabled] of dialects) {
    describe.skipIf(!enabled)(`SSE resumption under a duration cap [${label}]`, () => {
      for (const seed of seeds) {
        it(`subscribe(): random byte cuts + a 150 ms cap, zero gaps and zero duplicates (seed ${seed})`, async () => {
          const { h, writer } = await setup(await dialect(), 150)
          const rnd = seededRandom(seed)
          const cut = cuttingFetch(rnd, 64, 6000, 0.5)
          const client = createClient({ baseUrl: h.url, fetch: cut.fetch })
          const received: DurableEvent[] = []
          const errors: string[] = []
          let capEnds = 0
          const ac = new AbortController()
          const sub = client.subscribe({
            since: 0,
            signal: ac.signal,
            reconnectDelayMs: 1,
            onEvent: (e) => {
              if (isDurable(e)) received.push(e)
            },
            onDisconnect: (err) => {
              if (err === null)
                capEnds++ // the server ended the stream itself: the cap
              else if (!String((err as Error).cause ?? err).includes('connection cut by test'))
                errors.push(String(err))
            },
          })
          const p = produce(writer, seededRandom(seed + 1))
          await waitFor(
            () => cut.stats.cuts >= 30 && capEnds >= 5 && received.length >= 300,
            60_000,
            'cuts, cap ends, events',
            () =>
              `cuts=${cut.stats.cuts} connections=${cut.stats.connections} capEnds=${capEnds} events=${received.length} errors=${errors.length}`,
          )
          await p.stop()
          const last = await h.store.lastSeq()
          await waitFor(() => received.at(-1)?.seq === last, 30_000, `cursor to reach ${last}`)
          ac.abort()
          await sub
          expect(errors).toEqual([])
          assertNoViolations(checkEventLog(received), `${label} seed ${seed}`)
          expect(received).toEqual(await h.store.eventsAfter(0))
          expect(cut.stats.cuts).toBeGreaterThanOrEqual(30)
          expect(capEnds).toBeGreaterThanOrEqual(5)
        })
      }

      it('the raw stream, resumed with Last-Event-ID after every cut or cap, never repeats or skips', async () => {
        const { h, writer } = await setup(await dialect(), 100)
        const rnd = seededRandom(99)
        const cut = cuttingFetch(rnd, 32, 3000, 0.4)
        const p = produce(writer, seededRandom(100))
        const got: DurableEvent[] = []
        let cursor = 0
        let conns = 0
        const deadline = performance.now() + 60_000
        while ((conns < rawConnections || got.length < 300) && performance.now() < deadline) {
          conns++
          // an EventSource reconnects with its ORIGINAL url (since=0) plus Last-Event-ID; the header wins
          const res = await cut.fetch(`${h.url}/events?since=0&ephemeral=${rnd() < 0.5}`, {
            headers: { accept: 'text/event-stream', 'last-event-id': String(cursor) },
          })
          const decoder = new (await import('@gnomeola/protocol')).SseDecoder()
          const text = new TextDecoder()
          try {
            for await (const chunk of res.body as AsyncIterable<Uint8Array>)
              for (const m of decoder.push(text.decode(chunk, { stream: true }))) {
                if (!m.data) continue
                const e = AnyEvent.parse(JSON.parse(m.data))
                if (!isDurable(e)) continue
                expect(m.id).toBe(String(e.seq))
                got.push(e) // no client-side filtering: a server duplicate or gap shows up below
                cursor = e.seq
              }
          } catch (err) {
            if (!String((err as Error).message).includes('connection cut by test')) throw err
          }
        }
        await p.stop()
        const last = await h.store.lastSeq()
        // drain the tail on one last uncut connection
        while (cursor < last) {
          const res = await fetch(`${h.url}/events?since=${cursor}&ephemeral=false`, {
            headers: { accept: 'text/event-stream' },
          })
          const decoder = new (await import('@gnomeola/protocol')).SseDecoder()
          for await (const chunk of res.body as AsyncIterable<Uint8Array>)
            for (const m of decoder.push(Buffer.from(chunk).toString('utf8'))) {
              if (!m.data) continue
              const e = AnyEvent.parse(JSON.parse(m.data))
              if (isDurable(e)) {
                got.push(e)
                cursor = e.seq
              }
            }
        }
        assertNoViolations(checkEventLog(got), `${label} raw`)
        expect(got).toEqual(await h.store.eventsAfter(0))
        expect(conns).toBeGreaterThanOrEqual(rawConnections)
      })
    })
  }
}
