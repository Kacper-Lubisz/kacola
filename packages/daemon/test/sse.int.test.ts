import { join } from 'node:path'
import { AnyEvent, createClient, type DurableEvent, isDurable } from '@kacola/protocol'
import { Store } from '@kacola/store'
import { type DaemonHandle, seededRandom, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@kacola/testkit/invariants'
import { afterEach, describe, expect, it } from 'vitest'
import { cuttingFetch, durable, readEvents, sleep } from './helpers.ts'

// The event stream is the one piece of the protocol a remote deployment leans on hardest: every
// connection will die (function duration caps), so resumption by cursor must be exact. These tests kill
// connections on purpose, at seeded random byte offsets, while events are being produced — and assert
// the durable stream a client reconstructs is gap-free, duplicate-free, and identical to the store's log.

const FAST = JSON.stringify({ segmentEveryMs: 40, finalizeAfterMs: 30, partialEveryMs: 15, levelEveryMs: 15 })

let daemons: DaemonHandle[] = []
afterEach(async () => {
  await Promise.all(daemons.map((d) => d.stop()))
  daemons = []
})
async function daemon(env: Record<string, string> = {}): Promise<DaemonHandle> {
  const d = await startDaemon({ env: { KACOLA_FAKE_PIPELINE: FAST, KACOLA_HEARTBEAT_MS: '200', ...env } })
  daemons.push(d)
  return d
}

/** Keep the log growing from several directions at once until `stop()` is called. */
function produce(d: DaemonHandle) {
  let running = true
  const sessions: string[] = []
  const done = (async () => {
    for (let i = 0; i < 2; i++) {
      const s = await d.client.call('createSession', { body: { title: `producer ${i}` } })
      sessions.push(s.id)
      await d.client.call('startSession', { params: { id: s.id } })
    }
    let n = 0
    while (running) {
      await d.client.call('updateSession', { params: { id: sessions[n % 2]! }, body: { title: `t${n++}` } })
      await sleep(5)
    }
    for (const id of sessions) await d.client.call('stopSession', { params: { id } })
  })()
  return {
    async stop() {
      running = false
      await done
    },
  }
}

/** Read the store's log straight from the SQLite file (after the daemon has exited). */
function logOnDisk(d: DaemonHandle): DurableEvent[] {
  const s = Store.open(join(d.dataDir, 'kacola.db'), { readonly: true })
  try {
    return s.eventsAfter(0)
  } finally {
    s.close()
  }
}

describe('SSE resumption', () => {
  for (const seed of [11, 2024, 90210]) {
    it(`subscribe() survives 80+ connections cut at random byte offsets (seed ${seed})`, async () => {
      const d = await daemon()
      const rnd = seededRandom(seed)
      const cut = cuttingFetch(rnd, 64, 4096)
      const client = createClient({ baseUrl: d.baseUrl, fetch: cut.fetch })
      const received: DurableEvent[] = []
      const errors: string[] = []
      const ac = new AbortController()
      const sub = client.subscribe({
        since: 0,
        signal: ac.signal,
        reconnectDelayMs: 1,
        onEvent: (e) => {
          if (isDurable(e)) received.push(e)
        },
        onDisconnect: (err) => {
          if (err && !String((err as Error).cause ?? err).includes('connection cut by test'))
            errors.push(String(err))
        },
      })
      const p = produce(d)
      await waitFor(() => cut.stats.cuts >= 80 && received.length >= 400, 30_000, '80 cuts and 400 events')
      await p.stop()
      const { lastSeq } = await d.client.call('health')
      await waitFor(() => received.at(-1)?.seq === lastSeq, 20_000, `cursor to reach ${lastSeq}`)
      ac.abort()
      await sub

      expect(errors.filter((e) => /gap/.test(e))).toEqual([])
      assertNoViolations(checkEventLog(received), `seed ${seed}`)
      expect(received.length).toBeGreaterThanOrEqual(400)
      expect(cut.stats.cuts).toBeGreaterThanOrEqual(80)
      await d.kill('SIGTERM')
      expect(received).toEqual(logOnDisk(d))
    })
  }

  it('the raw stream, resumed by cursor after every cut, never repeats or skips (no client-side dedupe)', async () => {
    const d = await daemon()
    const rnd = seededRandom(7)
    const cut = cuttingFetch(rnd, 32, 2048)
    const client = createClient({ baseUrl: d.baseUrl, fetch: cut.fetch })
    const p = produce(d)
    const got: DurableEvent[] = []
    let cursor = 0
    for (let conn = 0; conn < 60; conn++) {
      try {
        for await (const msg of client.stream('events', {
          query: { since: cursor, ephemeral: rnd() < 0.5 },
        })) {
          if (!msg.data) continue
          const e = AnyEvent.parse(JSON.parse(msg.data))
          if (!isDurable(e)) continue
          got.push(e) // no filtering here: a duplicate or gap from the server shows up in the check below
          cursor = e.seq
        }
      } catch (err) {
        if (!String((err as Error).message).includes('connection cut by test')) throw err
      }
    }
    await p.stop()
    const { lastSeq } = await d.client.call('health')
    got.push(...durable(await readEvents(d.client, { since: cursor, untilSeq: lastSeq })))
    assertNoViolations(checkEventLog(got), 'raw resumed stream')
    expect(cut.stats.cuts).toBeGreaterThanOrEqual(60)
    await d.kill('SIGTERM')
    expect(got).toEqual(logOnDisk(d))
  })

  it('honours Last-Event-ID over ?since=, as an EventSource reconnect sends both', async () => {
    const d = await daemon()
    for (let i = 0; i < 5; i++) await d.client.call('createSession', {})
    const res = await fetch(`${d.baseUrl}/events?since=0&ephemeral=false`, {
      headers: { accept: 'text/event-stream', 'last-event-id': '3' },
    })
    const reader = res.body!.getReader()
    let text = ''
    while (!text.includes('id: 5')) text += new TextDecoder().decode((await reader.read()).value)
    await reader.cancel()
    expect([...text.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]))).toEqual([4, 5])
    const bad = await fetch(`${d.baseUrl}/events`, { headers: { 'last-event-id': 'nope' } })
    expect(bad.status).toBe(400)
  })
})

describe('the replay → live seam under concurrent writes', () => {
  it('many subscribers joining mid-flood, with replay paged across event-loop turns, each get an exact stream', async () => {
    // small replay pages: the handover from store to bus happens many times per connection, while the
    // producers keep committing between pages
    const d = await daemon({
      KACOLA_REPLAY_PAGE_SIZE: '25',
      KACOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 10, finalizeAfterMs: 5, levelEveryMs: 10 }),
    })
    const p = produce(d)
    await waitFor(async () => (await d.client.call('health')).lastSeq > 1500, 30_000, 'history to build up')
    const readers: Promise<{ since: number | undefined; events: DurableEvent[] }>[] = []
    for (let i = 0; i < 16; i++) {
      const { lastSeq } = await d.client.call('health')
      const since = i % 4 === 3 ? undefined : Math.floor((lastSeq * i) / 16)
      readers.push(
        (async () => {
          const events: DurableEvent[] = []
          const ac = new AbortController()
          const it = d.client.stream('events', {
            query: { since, ephemeral: i % 2 === 0 },
            signal: ac.signal,
          })
          const target = { seq: Number.POSITIVE_INFINITY }
          seams.push(target)
          try {
            for await (const msg of it) {
              if (!msg.data) continue
              const e = AnyEvent.parse(JSON.parse(msg.data))
              if (isDurable(e)) events.push(e)
              if (events.at(-1) && events.at(-1)!.seq >= target.seq) break
            }
          } finally {
            ac.abort()
          }
          return { since, events }
        })(),
      )
      await sleep(40)
    }
    await sleep(300)
    await p.stop()
    const { lastSeq } = await d.client.call('health')
    for (const t of seams) t.seq = lastSeq
    // nudge readers that are already caught up so they observe the new target
    await d.client.call('createSession', { body: { title: 'final nudge' } })
    const results = await Promise.all(readers)
    for (const { since, events } of results) {
      const after = since ?? events[0]!.seq - 1
      assertNoViolations(checkEventLog(events, after), `subscriber since=${since}`)
      expect(events.at(-1)!.seq).toBeGreaterThanOrEqual(lastSeq)
    }
    // at least some subscribers really did straddle the seam: history replayed AND live events received
    expect(results.filter((r) => r.since !== undefined && r.events.length > 200).length).toBeGreaterThan(5)
  })
})

const seams: { seq: number }[] = []

describe('stream contents', () => {
  it('filters by session, carries ephemeral levels/partials without ids, and heartbeats', async () => {
    const d = await daemon({ KACOLA_HEARTBEAT_MS: '100' })
    const a = await d.client.call('createSession', {})
    const b = await d.client.call('createSession', {})
    const ac = new AbortController()
    const seen: AnyEvent[] = []
    const sub = d.client.subscribe({
      since: 0,
      sessionId: a.id,
      signal: ac.signal,
      onEvent: (e) => seen.push(e),
    })
    await d.client.call('startSession', { params: { id: a.id } })
    await d.client.call('startSession', { params: { id: b.id } })
    await waitFor(
      () =>
        seen.some((e) => e.data.type === 'audio.level') &&
        seen.some((e) => e.data.type === 'transcript.partial') &&
        seen.some((e) => e.data.type === 'segment.upserted') &&
        seen.some((e) => e.data.type === 'heartbeat'),
      10_000,
      'all event kinds',
    )
    await d.client.call('stopSession', { params: { id: a.id } })
    await d.client.call('stopSession', { params: { id: b.id } })
    ac.abort()
    await sub
    const forSessions = seen.filter((e) => e.data.type !== 'heartbeat')
    expect(forSessions.every((e) => e.sessionId === a.id)).toBe(true)
    const hb = seen.find((e) => e.data.type === 'heartbeat')!
    expect(hb.seq).toBeNull()

    // ephemeral=false: nothing but durable events
    const { lastSeq } = await d.client.call('health')
    const onlyDurable = await readEvents(d.client, { since: 0, untilSeq: lastSeq, ephemeral: false })
    expect(onlyDurable.every(isDurable)).toBe(true)
  })
})
