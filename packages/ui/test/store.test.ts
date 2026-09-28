import {
  type AnyEvent,
  DaemonUnreachableError,
  type DurableEvent,
  encodeSse,
  Health,
  Session,
} from '@gnomeola/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readConfig } from '../src/data/config.ts'
import { createDaemonSource } from '../src/data/daemon-source.ts'
import { createDemoSource } from '../src/data/demo-source.ts'
import type { DataSource, SubscribeHandlers } from '../src/data/source.ts'
import { SessionStore } from '../src/data/store.ts'

const mk = (id: string, createdAt: string, over: Partial<Session> = {}): Session =>
  Session.parse({
    id,
    title: id,
    createdAt,
    startedAt: createdAt,
    endedAt: null,
    status: 'stopped',
    private: false,
    durationMs: 0,
    tracks: [],
    error: null,
    ...over,
  })
const upsert = (seq: number, s: Session): DurableEvent => ({
  seq,
  at: '2026-09-28T12:00:00.000Z',
  sessionId: s.id,
  data: { type: 'session.upserted', session: s },
})

/** A controllable source: the test decides when load resolves and pushes events by hand. */
function fakeSource(opts: { fail?: Error; sessions?: Session[]; seq?: number } = {}) {
  let handlers: SubscribeHandlers | null = null
  const calls = { load: 0, subscribeSince: [] as number[] }
  const src: DataSource = {
    origin: 'http://fake',
    async load() {
      calls.load++
      if (opts.fail) throw opts.fail
      return { sessions: opts.sessions ?? [], seq: opts.seq ?? 0 }
    },
    subscribe(h) {
      handlers = h
      calls.subscribeSince.push(h.since)
      h.onConnect()
      return new Promise((r) => h.signal.addEventListener('abort', () => r(), { once: true }))
    },
    async startRecording() {
      throw new Error('unused')
    },
    async stopRecording() {
      throw new Error('unused')
    },
  }
  return { src, calls, push: (e: AnyEvent) => handlers!.onEvent(e), handlers: () => handlers! }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SessionStore', () => {
  it('loads a snapshot, subscribes from its cursor and folds events', async () => {
    const a = mk('ses_a', '2026-09-28T09:00:00.000Z')
    const f = fakeSource({ sessions: [a], seq: 4 })
    const store = new SessionStore(f.src)
    const seen: string[] = []
    store.subscribe(() => seen.push(store.getSnapshot().connection.kind))
    store.start()
    expect(store.getSnapshot().connection.kind).toBe('connecting')
    await flush()
    expect(store.getSnapshot().connection.kind).toBe('live')
    expect(f.calls.subscribeSince).toEqual([4])
    expect(store.getSnapshot().sessions.ordered.map((s) => s.id)).toEqual(['ses_a'])

    const b = mk('ses_b', '2026-09-28T10:00:00.000Z', { status: 'recording' })
    f.push(upsert(5, b))
    expect(store.getSnapshot().sessions.ordered.map((s) => s.id)).toEqual(['ses_b', 'ses_a'])
    expect(seen).toContain('live')
    store.stop()
  })

  it('does not notify React for events that change nothing', async () => {
    const f = fakeSource({ sessions: [], seq: 2 })
    const store = new SessionStore(f.src)
    store.start()
    await flush()
    const listener = vi.fn()
    store.subscribe(listener)
    f.push(upsert(1, mk('ses_old', '2026-09-28T09:00:00.000Z'))) // already in the snapshot
    f.push({
      seq: null,
      at: '2026-09-28T12:00:00.000Z',
      sessionId: null,
      data: { type: 'heartbeat', lastSeq: 2 },
    })
    expect(listener).not.toHaveBeenCalled()
    store.stop()
  })

  it('fans every event (durable and ephemeral) out to onEvent listeners', async () => {
    const f = fakeSource()
    const store = new SessionStore(f.src)
    store.start()
    await flush()
    const got: AnyEvent[] = []
    const off = store.onEvent((e) => got.push(e))
    const lvl: AnyEvent = {
      seq: null,
      at: '2026-09-28T12:00:00.000Z',
      sessionId: 'ses_a',
      data: { type: 'audio.level', track: 'mic', rms: 0.5, peak: 0.6, elapsedMs: 10 },
    }
    f.push(lvl)
    off()
    f.push(lvl)
    expect(got).toEqual([lvl])
    store.stop()
  })

  it('reports reconnecting on a dropped stream and live again on reconnect', async () => {
    const f = fakeSource()
    const store = new SessionStore(f.src)
    store.start()
    await flush()
    f.handlers().onDisconnect(new Error('socket hang up'))
    expect(store.getSnapshot().connection).toEqual({ kind: 'reconnecting', error: 'socket hang up' })
    f.handlers().onConnect()
    expect(store.getSnapshot().connection.kind).toBe('live')
    store.stop()
  })

  it('marks an unreachable daemon, schedules a retry and retries on demand', async () => {
    const timers: { fn: () => void; ms: number }[] = []
    const f = fakeSource({ fail: new DaemonUnreachableError('http://fake', new Error('ECONNREFUSED')) })
    const store = new SessionStore(f.src, {
      retryMs: 5000,
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
      clearTimeout: () => {},
    })
    store.start()
    await flush()
    const c = store.getSnapshot().connection
    expect(c.kind).toBe('unreachable')
    if (c.kind !== 'unreachable') throw new Error('unreachable')
    expect(c.origin).toBe('http://fake')
    expect(c.error).toContain('not reachable at http://fake')
    expect(c.error).toContain('ECONNREFUSED')
    expect(timers).toHaveLength(1)
    expect(timers[0]!.ms).toBe(5000)
    timers[0]!.fn() // the scheduled retry fires
    await flush()
    expect(f.calls.load).toBe(2)
    store.retry()
    await flush()
    expect(f.calls.load).toBe(3)
    store.stop()
  })
})

describe('demo source', () => {
  // Drive its timers by hand so the test is instant and deterministic.
  function demo(intervalMs = 4000, maxSessions = 6) {
    let t = Date.parse('2026-09-28T12:00:00.000Z')
    const ivs: { fn: () => void; ms: number; live: boolean }[] = []
    const src = createDemoSource({
      intervalMs,
      maxSessions,
      now: () => t,
      setInterval: (fn, ms) => {
        const h = { fn, ms, live: true }
        ivs.push(h)
        return h
      },
      clearInterval: (h) => {
        ;(h as { live: boolean }).live = false
      },
    })
    let elapsed = 0
    const advance = (ms: number) => {
      for (let step = 0; step < ms; step += 1000) {
        t += 1000
        elapsed += 1000
        for (const iv of ivs) if (iv.live && elapsed % iv.ms === 0) iv.fn()
      }
    }
    return { src, advance }
  }

  it('seeds valid history and grows a live list through the store', async () => {
    const { src, advance } = demo(4000, 6)
    const store = new SessionStore(src)
    store.start()
    await flush()
    const titles = () => store.getSnapshot().sessions.ordered.map((s) => s.title)
    expect(titles()).toEqual(['1:1 with Sam', 'Design review: onboarding flow', 'Weekly product sync'])
    for (const s of store.getSnapshot().sessions.ordered) expect(() => Session.parse(s)).not.toThrow()

    advance(4000)
    expect(titles()[0]).toBe('Standup #1')
    expect(store.getSnapshot().sessions.ordered[0]!.status).toBe('recording')
    advance(3000)
    expect(store.getSnapshot().sessions.ordered[0]!.durationMs).toBe(3000)
    advance(1000)
    expect(titles().slice(0, 2)).toEqual(['Customer call: Acme #2', 'Standup #1'])
    const [newest, previous] = store.getSnapshot().sessions.ordered
    expect(newest!.status).toBe('recording')
    expect(previous!.status).toBe('stopped')
    expect(previous!.durationMs).toBe(4000) // final length is set when it stops

    // cap reached: the demo stops its recording and goes quiet
    advance(4000 * 5)
    const all = store.getSnapshot().sessions.ordered
    expect(all).toHaveLength(6)
    expect(all.every((s) => s.status === 'stopped')).toBe(true)
    const seq = store.getSnapshot().sessions.seq
    advance(20_000)
    expect(store.getSnapshot().sessions.seq).toBe(seq)
    store.stop()
    src.dispose()
  })

  it('replays from the cursor so nothing between load and subscribe is lost', async () => {
    const { src, advance } = demo(1000, 10)
    const snap = await src.load(new AbortController().signal)
    advance(1000) // an event lands before we subscribe
    const got: AnyEvent[] = []
    const ac = new AbortController()
    const done = src.subscribe({
      since: snap.seq,
      signal: ac.signal,
      onEvent: (e) => got.push(e),
      onConnect() {},
      onDisconnect() {},
    })
    const durable = got.filter((e) => e.seq !== null) as DurableEvent[]
    expect(durable.map((e) => e.seq)).toEqual([snap.seq + 1])
    ac.abort()
    await done
    src.dispose()
  })

  it('records by hand and stops', async () => {
    const { src } = demo(4000, 3) // already at the cap: no automatic churn
    const s = await src.startRecording()
    expect(s.status).toBe('recording')
    expect(s.title).toBe('New recording')
    const stopped = await src.stopRecording(s.id)
    expect(stopped.status).toBe('stopped')
    expect(stopped.endedAt).not.toBeNull()
    src.dispose()
  })
})

describe('daemon source (protocol client over a fake fetch)', () => {
  afterEach(() => vi.restoreAllMocks())

  const health = Health.parse({
    ok: true,
    version: '0.1.0',
    uptimeMs: 1,
    lastSeq: 12,
    capture: { available: true, backend: 'fake', detail: null },
    models: [],
    llm: { provider: 'none', ready: false },
  })

  it('loads health.lastSeq then the list, including private sessions', async () => {
    const urls: string[] = []
    const a = mk('ses_a', '2026-09-28T09:00:00.000Z', { private: true })
    const fetchFn = (async (url: string) => {
      urls.push(url)
      const body = url.endsWith('/health') ? health : { sessions: [a] }
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    const src = createDaemonSource({ baseUrl: 'http://daemon.test:1', fetch: fetchFn })
    const snap = await src.load(new AbortController().signal)
    expect(snap).toEqual({ sessions: [a], seq: 12 })
    expect(urls[0]).toBe('http://daemon.test:1/health')
    expect(urls[1]).toBe('http://daemon.test:1/sessions?includePrivate=true&limit=500')
  })

  it('surfaces a refused connection as DaemonUnreachableError', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:1') })
    }) as unknown as typeof fetch
    const src = createDaemonSource({ baseUrl: 'http://127.0.0.1:1', fetch: fetchFn })
    await expect(src.load(new AbortController().signal)).rejects.toBeInstanceOf(DaemonUnreachableError)
  })

  it('subscribes with the cursor and delivers parsed events', async () => {
    const b = mk('ses_b', '2026-09-28T10:00:00.000Z')
    let seenUrl = ''
    const fetchFn = (async (url: string) => {
      seenUrl = url
      const body = encodeSse({ id: '13', data: JSON.stringify(upsert(13, b)) })
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
    }) as unknown as typeof fetch
    const src = createDaemonSource({ baseUrl: 'http://daemon.test:1', fetch: fetchFn })
    const ac = new AbortController()
    const got: AnyEvent[] = []
    const done = src.subscribe({
      since: 12,
      signal: ac.signal,
      onEvent: (e) => {
        got.push(e)
        ac.abort()
      },
      onConnect() {},
      onDisconnect() {},
    })
    await done
    expect(seenUrl).toBe('http://daemon.test:1/events?since=12&ephemeral=true')
    expect(got).toEqual([upsert(13, b)])
  })
})

describe('readConfig', () => {
  it('defaults to the local daemon', () => {
    expect(readConfig({})).toEqual({ mode: 'daemon', baseUrl: 'http://127.0.0.1:8787', timeoutMs: 5000 })
    expect(readConfig({ GNOMEOLA_URL: 'http://10.0.0.2:9000' })).toMatchObject({
      baseUrl: 'http://10.0.0.2:9000',
    })
  })
  it('enables the demo with GNOMEOLA_UI_DEMO', () => {
    expect(readConfig({ GNOMEOLA_UI_DEMO: '1' })).toEqual({ mode: 'demo', intervalMs: 4000, maxSessions: 40 })
    expect(readConfig({ GNOMEOLA_UI_DEMO: 'true', GNOMEOLA_UI_DEMO_INTERVAL_MS: '250' })).toMatchObject({
      intervalMs: 250,
    })
    expect(readConfig({ GNOMEOLA_UI_DEMO: '0' }).mode).toBe('daemon')
  })
  it('rejects bad values loudly', () => {
    expect(() => readConfig({ GNOMEOLA_URL: 'not a url' })).toThrow(/GNOMEOLA_URL/)
    expect(() => readConfig({ GNOMEOLA_UI_DEMO: '1', GNOMEOLA_UI_DEMO_INTERVAL_MS: '-1' })).toThrow(
      /positive/,
    )
  })
})
