import { describe, expect, it } from 'vitest'
import { createClient, DaemonUnreachableError, KacolaApiError } from '../src/client.ts'
import type { AnyEvent } from '../src/events.ts'
import type { AskStreamEvent } from '../src/routes.ts'
import type { Session } from '../src/schemas.ts'
import { encodeSse } from '../src/sse.ts'

const session: Session = {
  id: 'ses_1',
  title: 'S',
  createdAt: '2026-09-28T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  status: 'idle',
  private: false,
  durationMs: 0,
  tracks: [],
  error: null,
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

function sse(messages: string[], opts: { chunkSize?: number } = {}): Response {
  const bytes = new TextEncoder().encode(messages.join(''))
  const size = opts.chunkSize ?? bytes.length
  let i = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(c) {
        if (i >= bytes.length) return c.close()
        c.enqueue(bytes.slice(i, i + size))
        i += size
      },
    }),
  )
}

type Seen = { url: string; init: RequestInit }
function recorder(respond: (s: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = []
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    const s = { url: String(url), init: init ?? {} }
    seen.push(s)
    return respond(s)
  }
  return { seen, fetch: fetchFn as typeof fetch }
}

describe('client requests', () => {
  it('sends JSON bodies with a content type, and none on bodiless calls', async () => {
    const r = recorder(() => ok(session))
    const c = createClient({ baseUrl: 'http://d/', fetch: r.fetch, headers: { 'x-a': '1' } })
    await c.call('createSession', { body: { title: 'T' } })
    await c.call('getSession', { params: { id: 'x' } })
    const [post, get] = r.seen
    expect(post!.url).toBe('http://d/sessions') // trailing slash on baseUrl normalised
    expect(post!.init.method).toBe('POST')
    expect(post!.init.body).toBe('{"title":"T"}')
    expect(post!.init.headers).toEqual({ 'x-a': '1', 'content-type': 'application/json' })
    expect(get!.init.body).toBeUndefined()
    expect(get!.init.headers).toEqual({ 'x-a': '1' })
    expect(c.baseUrl).toBe('http://d')
  })

  it('asks for an event stream on streaming routes only', async () => {
    const r = recorder(() => sse([]))
    const c = createClient({ fetch: r.fetch })
    for await (const _ of c.stream('events', { query: {} })) {
      // drain
    }
    expect((r.seen[0]!.init.headers as Record<string, string>).accept).toBe('text/event-stream')
  })

  it('applies the timeout to JSON calls and reports it as unreachable', async () => {
    const r = recorder(
      (s) =>
        new Promise<Response>((_, reject) =>
          s.init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('t'), { name: 'TimeoutError' })),
          ),
        ),
    )
    const c = createClient({ fetch: r.fetch, timeoutMs: 20 })
    const t0 = Date.now()
    await expect(c.call('health')).rejects.toBeInstanceOf(DaemonUnreachableError)
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('never times out streams', async () => {
    const r = recorder(() => sse([encodeSse({ data: '{}' })]))
    const c = createClient({ fetch: r.fetch, timeoutMs: 5 })
    for await (const _ of c.stream('events', { query: {} })) {
      // drain
    }
    expect(r.seen[0]!.init.signal).toBeUndefined()
  })

  it('rethrows a caller abort as an abort, not as "daemon unreachable"', async () => {
    const r = recorder(
      (s) =>
        new Promise<Response>((_, reject) =>
          s.init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
    )
    const c = createClient({ fetch: r.fetch })
    const ac = new AbortController()
    const p = c.call('health', { signal: ac.signal })
    ac.abort()
    const err = await p.catch((e) => e)
    expect(err.name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(DaemonUnreachableError)
  })

  it('keeps a non-JSON error body as the message with code internal', async () => {
    const c = createClient({
      fetch: async () => new Response('upstream exploded', { status: 502, statusText: 'Bad Gateway' }),
    })
    const err = await c.call('health').catch((e) => e)
    expect(err).toBeInstanceOf(KacolaApiError)
    expect(err).toMatchObject({ status: 502, code: 'internal', message: 'upstream exploded' })
    const empty = createClient({
      fetch: async () => new Response('', { status: 503, statusText: 'Service Unavailable' }),
    })
    expect(await empty.call('health').catch((e) => e.message)).toBe('Service Unavailable')
    const wrongShape = createClient({ fetch: async () => new Response('{"oops":1}', { status: 500 }) })
    expect(await wrongShape.call('health').catch((e) => e.code)).toBe('internal')
  })

  it('names its errors and keeps the cause', async () => {
    const cause = new TypeError('fetch failed')
    const c = createClient({
      baseUrl: 'http://x:1',
      fetch: async () => {
        throw cause
      },
    })
    const err = await c.call('health').catch((e) => e)
    expect(err.name).toBe('DaemonUnreachableError')
    expect(err.message).toBe("kacola's background service is not reachable at http://x:1")
    expect(err.cause).toBe(cause)
    expect(new KacolaApiError(400, 'bad_request', 'm').name).toBe('KacolaApiError')
  })

  it('handles a stream response without a body', async () => {
    const c = createClient({ fetch: async () => new Response(null, { status: 200 }) })
    const got = []
    for await (const m of c.stream('events', { query: {} })) got.push(m)
    expect(got).toEqual([])
  })

  it('decodes multi-byte UTF-8 split across chunks', async () => {
    const c = createClient({ fetch: async () => sse([encodeSse({ data: '"🎙️ café"' })], { chunkSize: 3 }) })
    const got = []
    for await (const m of c.stream('events', { query: {} })) got.push(m.data)
    expect(got).toEqual(['"🎙️ café"'])
  })
})

describe('client.ask', () => {
  it('yields parsed events in order and skips empty keep-alive messages', async () => {
    const evs: AskStreamEvent[] = [
      { type: 'delta', text: 'a' },
      { type: 'error', error: { code: 'unavailable', message: 'x' } },
    ]
    const c = createClient({
      fetch: async () =>
        sse([encodeSse({ data: '' }), ...evs.map((e) => encodeSse({ data: JSON.stringify(e) }))]),
    })
    const got = []
    for await (const e of c.ask({ question: 'q' })) got.push(e)
    expect(got).toEqual(evs)
  })
  it('rejects a malformed stream event instead of passing it on', async () => {
    const c = createClient({ fetch: async () => sse([encodeSse({ data: '{"type":"delta"}' })]) })
    await expect(async () => {
      for await (const _ of c.ask({ question: 'q' })) {
        // drain
      }
    }).rejects.toThrow()
  })
})

describe('client.subscribe — details', () => {
  const durable = (seq: number): AnyEvent => ({
    seq,
    at: '2026-09-28T10:00:00.000Z',
    sessionId: null,
    data: { type: 'session.upserted', session },
  })
  const ephemeral = (): AnyEvent => ({
    seq: null,
    at: '2026-09-28T10:00:00.000Z',
    sessionId: null,
    data: { type: 'heartbeat', lastSeq: 0 },
  })
  const wire = (e: AnyEvent) =>
    encodeSse({ id: e.seq === null ? undefined : String(e.seq), data: JSON.stringify(e) })

  it('passes ephemeral events through without moving the cursor, and asks for them by default', async () => {
    const r = recorder(() =>
      sse([wire(durable(1)), wire(ephemeral()), wire(durable(2)), encodeSse({ data: '' })]),
    )
    const c = createClient({ fetch: r.fetch })
    const ac = new AbortController()
    const got: (number | null)[] = []
    let connects = 0
    await c.subscribe({
      since: 0,
      signal: ac.signal,
      reconnectDelayMs: 1,
      onConnect: () => connects++,
      onEvent: (e) => {
        got.push(e.seq)
        if (e.seq === 2) ac.abort()
      },
    })
    expect(got).toEqual([1, null, 2])
    expect(connects).toBe(1)
    expect(new URL(r.seen[0]!.url).searchParams.get('ephemeral')).toBe('true')
  })

  it('can opt out of ephemeral events', async () => {
    const r = recorder(() => sse([wire(durable(1))]))
    const ac = new AbortController()
    await createClient({ fetch: r.fetch }).subscribe({
      since: 0,
      ephemeral: false,
      signal: ac.signal,
      onEvent: () => ac.abort(),
    })
    expect(new URL(r.seen[0]!.url).searchParams.get('ephemeral')).toBe('false')
  })

  it('without a starting cursor, receives only new events and then resumes from the first one it saw', async () => {
    let n = 0
    const r = recorder((s) => {
      n++
      const since = new URL(s.url).searchParams.get('since')
      if (n === 1) {
        expect(since).toBeNull() // only-new semantics: no replay requested
        return sse([wire(durable(57)), wire(durable(58))])
      }
      expect(since).toBe('58')
      return sse([wire(durable(59))])
    })
    const ac = new AbortController()
    const got: (number | null)[] = []
    await createClient({ fetch: r.fetch }).subscribe({
      signal: ac.signal,
      reconnectDelayMs: 1,
      onEvent: (e) => {
        got.push(e.seq)
        if (e.seq === 59) ac.abort()
      },
    })
    expect(got).toEqual([57, 58, 59])
  })

  it('reports a clean server-side close as a disconnect and reconnects', async () => {
    let n = 0
    const r = recorder(() => (++n === 1 ? sse([wire(durable(1))]) : sse([wire(durable(2))])))
    const reasons: unknown[] = []
    const ac = new AbortController()
    await createClient({ fetch: r.fetch }).subscribe({
      since: 0,
      signal: ac.signal,
      reconnectDelayMs: 1,
      onDisconnect: (e) => reasons.push(e),
      onEvent: (e) => {
        if (e.seq === 2) ac.abort()
      },
    })
    expect(reasons[0]).toBeNull()
    expect(n).toBe(2)
  })

  it('stops immediately when already aborted', async () => {
    const r = recorder(() => sse([]))
    const ac = new AbortController()
    ac.abort()
    await createClient({ fetch: r.fetch }).subscribe({ signal: ac.signal, onEvent: () => {} })
    expect(r.seen).toEqual([])
  })
})

describe('client auth and timeouts', () => {
  it('sends the pairing token as a bearer header, and no authorization without one', async () => {
    const r = recorder(() => ok({ ok: true }))
    await createClient({ fetch: r.fetch, token: 'tok_1' })
      .call('health')
      .catch(() => {})
    await createClient({ fetch: r.fetch })
      .call('health')
      .catch(() => {})
    expect((r.seen[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer tok_1')
    expect(r.seen[1]!.init.headers).toEqual({})
  })

  // A fetch that only settles when its signal aborts; with no signal it would hang, which is the point.
  const hangs = () =>
    recorder(
      (s) =>
        new Promise<Response>((_, reject) => {
          const sig = s.init.signal
          if (!sig) return
          sig.addEventListener('abort', () => reject(sig.reason))
        }),
    )

  it('a JSON call carries a timeout signal even when the caller passes none', async () => {
    const r = hangs()
    const err = await createClient({ fetch: r.fetch, timeoutMs: 10 })
      .call('health')
      .catch((e) => e)
    expect(r.seen[0]!.init.signal).toBeInstanceOf(AbortSignal)
    expect(err).toBeInstanceOf(DaemonUnreachableError)
    expect(err.cause.name).toBe('TimeoutError')
  })

  it('with a timeout configured, the caller can still abort', async () => {
    const r = hangs()
    const ac = new AbortController()
    const p = createClient({ fetch: r.fetch, timeoutMs: 60_000 })
      .call('health', { signal: ac.signal })
      .catch((e) => e)
    ac.abort()
    const err = await p
    expect(err.name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(DaemonUnreachableError)
  })

  it('an abort the caller did not ask for is the daemon being unreachable', async () => {
    const abortErr = Object.assign(new Error('socket aborted'), { name: 'AbortError' })
    const fail = (e: unknown) =>
      createClient({
        fetch: async () => {
          throw e
        },
      })
        .call('health')
        .catch((x) => x)
    expect(await fail(abortErr)).toBeInstanceOf(DaemonUnreachableError)
    // a caller signal that never fired does not make it the caller's abort either
    const ac = new AbortController()
    const err = await createClient({
      fetch: async () => {
        throw abortErr
      },
    })
      .call('health', { signal: ac.signal })
      .catch((x) => x)
    expect(err).toBeInstanceOf(DaemonUnreachableError)
    // the caller having aborted does not turn a different failure into an abort
    const gone = new AbortController()
    gone.abort()
    const refused = await createClient({
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
      .call('health', { signal: gone.signal })
      .catch((x) => x)
    expect(refused).toBeInstanceOf(DaemonUnreachableError)
    // whatever a broken fetch throws, even nothing at all
    expect(await fail(undefined)).toBeInstanceOf(DaemonUnreachableError)
  })
})

describe('client.ask — request', () => {
  it('posts the question as the body and passes the caller signal through', async () => {
    const r = recorder(() => sse([]))
    const ac = new AbortController()
    for await (const _ of createClient({ fetch: r.fetch }).ask(
      { question: 'what did we decide?' },
      ac.signal,
    )) {
      // drain
    }
    expect(r.seen[0]!.init.method).toBe('POST')
    expect(JSON.parse(r.seen[0]!.init.body as string)).toEqual({ question: 'what did we decide?' })
    expect(r.seen[0]!.init.signal).toBe(ac.signal)
  })
})

describe('client.subscribe — cursors and lifecycle', () => {
  const durable = (seq: number): AnyEvent => ({
    seq,
    at: '2026-09-28T10:00:00.000Z',
    sessionId: null,
    data: { type: 'session.upserted', session },
  })
  const wire = (e: AnyEvent) => encodeSse({ id: String(e.seq), data: JSON.stringify(e) })
  const announce = (id: string) => `id: ${id}\n\n`
  const sinceOf = (s: Seen) => new URL(s.url).searchParams.get('since')

  /** Run a subscription over scripted connections until `stop` says so; returns the `since` of each request. */
  async function run(
    connections: string[][],
    o: { since?: number; stop: (seq: number | null) => boolean },
  ): Promise<{ since: (string | null)[]; got: (number | null)[]; disconnects: unknown[] }> {
    let n = 0
    const r = recorder(() => sse(connections[Math.min(n++, connections.length - 1)]!))
    const ac = new AbortController()
    const got: (number | null)[] = []
    const disconnects: unknown[] = []
    await createClient({ fetch: r.fetch }).subscribe({
      since: o.since,
      signal: ac.signal,
      reconnectDelayMs: 1,
      onDisconnect: (e) => {
        disconnects.push(e)
        if (n > 10) ac.abort()
      },
      onEvent: (e) => {
        got.push(e.seq)
        if (o.stop(e.seq)) ac.abort()
      },
    })
    return { since: r.seen.map(sinceOf), got, disconnects }
  }

  it('adopts the cursor a new-events-only stream announces, so a reconnect misses nothing', async () => {
    const res = await run([[announce('41')], [wire(durable(42))]], { stop: (s) => s === 42 })
    expect(res.since).toEqual([null, '41'])
    expect(res.got).toEqual([42])
  })

  it('an announcement never overrides a cursor it already has', async () => {
    const res = await run([[announce('41')], [wire(durable(11))]], { since: 10, stop: (s) => s === 11 })
    expect(res.since).toEqual(['10', '10'])
    expect(res.got).toEqual([11])
  })

  it('ignores an announcement that is not a plain seq number', async () => {
    for (const id of ['x7', '7x', 'abc']) {
      const res = await run([[announce(id), wire(durable(5)), wire(durable(6))]], { stop: (s) => s === 6 })
      expect(res.got).toEqual([5, 6])
      expect(res.disconnects.filter((e) => e !== null)).toEqual([])
    }
  })

  it('skips a data-less keep-alive mid-stream without dropping the connection', async () => {
    const res = await run([[wire(durable(1)), encodeSse({ data: '' }), wire(durable(2))]], {
      since: 0,
      stop: (s) => s === 2,
    })
    expect(res.got).toEqual([1, 2])
    expect(res.disconnects.filter((e) => e !== null)).toEqual([])
  })

  it('a caller abort mid-stream ends the subscription without reporting a disconnect', async () => {
    const ac = new AbortController()
    const disconnects: unknown[] = []
    const r = recorder(
      (s) =>
        new Promise<Response>((_, reject) =>
          s.init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
    )
    const p = createClient({ fetch: r.fetch }).subscribe({
      since: 0,
      signal: ac.signal,
      onEvent: () => {},
      onDisconnect: (e) => disconnects.push(e),
    })
    ac.abort()
    await p
    expect(disconnects).toEqual([])
  })

  it('returns promptly after an abort instead of sleeping out the reconnect delay', async () => {
    const ac = new AbortController()
    const t0 = performance.now()
    await createClient({ fetch: async () => sse([wire(durable(1))]) }).subscribe({
      since: 0,
      signal: ac.signal,
      reconnectDelayMs: 5_000,
      onEvent: () => ac.abort(),
    })
    expect(performance.now() - t0).toBeLessThan(2_000)
  })

  it('waits half a second between reconnects by default', async () => {
    const at: number[] = []
    const ac = new AbortController()
    await createClient({
      fetch: async () => {
        at.push(performance.now())
        if (at.length === 2) ac.abort()
        return sse([])
      },
    }).subscribe({ since: 0, signal: ac.signal, onEvent: () => {} })
    expect(at).toHaveLength(2)
    expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(450)
  })

  it('runs without a signal until a callback throws, reporting each disconnect', async () => {
    const stop = new Error('stop')
    const boom = new Error('boom')
    let n = 0
    const reasons: unknown[] = []
    const p = createClient({
      fetch: async () => (++n === 1 ? sse([wire(durable(1))]) : sse([wire(durable(2))])),
    }).subscribe({
      since: 0,
      reconnectDelayMs: 1,
      onEvent: (e) => {
        if (e.seq === 2) throw boom
      },
      onDisconnect: (e) => {
        reasons.push(e)
        if (e) throw stop
      },
    })
    await expect(p).rejects.toBe(stop)
    expect(reasons).toEqual([null, boom])
  })
})
