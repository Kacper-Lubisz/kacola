import { describe, expect, it } from 'vitest'
import { createClient, DaemonUnreachableError, GnomeolaApiError, toQueryString } from '../src/client.ts'
import type { AnyEvent, DurableEvent } from '../src/events.ts'
import type { Session } from '../src/schemas.ts'
import { encodeSse } from '../src/sse.ts'

const session: Session = {
  id: 'ses_1',
  title: 'Standup',
  createdAt: '2026-09-28T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  status: 'idle',
  private: false,
  durationMs: 0,
  tracks: [],
  error: null,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function durable(seq: number): DurableEvent {
  return {
    seq,
    at: '2026-09-28T10:00:00.000Z',
    sessionId: 'ses_1',
    data: { type: 'session.upserted', session },
  }
}

// Pull-based, so a "connection reset" happens only after the preceding events were actually
// delivered — erroring a push stream would discard its unread queue, which is not how a network
// drop behaves and would make the resumption test vacuous.
function sseResponse(events: AnyEvent[], opts: { breakAfter?: number } = {}): Response {
  const enc = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (opts.breakAfter !== undefined && i === opts.breakAfter)
        return c.error(new Error('connection reset'))
      const e = events[i++]
      if (!e) return c.close()
      c.enqueue(
        enc.encode(encodeSse({ id: e.seq === null ? undefined : String(e.seq), data: JSON.stringify(e) })),
      )
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

describe('typed client', () => {
  it('builds URLs from params + query and validates the response', async () => {
    const seen: string[] = []
    const client = createClient({
      baseUrl: 'http://d',
      fetch: async (url, init) => {
        seen.push(`${init?.method} ${url}`)
        return json(session)
      },
    })
    const s = await client.call('getSession', { params: { id: 'ses 1' }, query: { includePrivate: true } })
    expect(s.id).toBe('ses_1')
    expect(seen).toEqual(['GET http://d/sessions/ses%201?includePrivate=true'])
  })

  it('fails loudly when the daemon drifts from the contract', async () => {
    const client = createClient({ fetch: async () => json({ ...session, status: 'exploded' }) })
    await expect(client.call('getSession', { params: { id: 'x' } })).rejects.toThrow()
  })

  it('maps error bodies to GnomeolaApiError with code and status', async () => {
    const client = createClient({
      fetch: async () => json({ error: { code: 'not_found', message: 'no such session' } }, 404),
    })
    const err = await client.call('getSession', { params: { id: 'x' } }).catch((e) => e)
    expect(err).toBeInstanceOf(GnomeolaApiError)
    expect(err).toMatchObject({ status: 404, code: 'not_found', message: 'no such session' })
  })

  it('distinguishes an unreachable daemon from an error response', async () => {
    const client = createClient({
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    await expect(client.call('health')).rejects.toBeInstanceOf(DaemonUnreachableError)
  })

  it('serialises query values and drops undefined', () => {
    expect(toQueryString({ a: 1, b: undefined, c: false, d: 'x y', e: null, f: true })).toBe(
      '?a=1&c=false&d=x+y&f=true',
    )
    expect(toQueryString({})).toBe('')
  })
})

describe('subscribe — resumable, gap-free, duplicate-free', () => {
  it('reconnects with its cursor after a dropped connection and never delivers a seq twice', async () => {
    const all = Array.from({ length: 10 }, (_, i) => durable(i + 1))
    const requests: string[] = []
    let connection = 0
    const client = createClient({
      baseUrl: 'http://d',
      fetch: async (url) => {
        requests.push(String(url))
        connection++
        const since = Number(new URL(String(url)).searchParams.get('since') ?? 0)
        // The server replays from the cursor but, like a real server racing a reconnect, also re-sends
        // one event the client already has. The client must drop it.
        const replay = all.filter((e) => e.seq > since - 1)
        return sseResponse(replay, connection < 3 ? { breakAfter: 4 } : {})
      },
    })
    const got: number[] = []
    const ac = new AbortController()
    await client.subscribe({
      since: 0,
      signal: ac.signal,
      reconnectDelayMs: 1,
      onEvent: (e) => {
        if (e.seq !== null) got.push(e.seq)
        if (e.seq === 10) ac.abort()
      },
    })
    expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(requests.length).toBe(3)
    expect(new URL(requests[1]!).searchParams.get('since')).toBe('4')
  })

  it('surfaces a real gap instead of silently skipping it', async () => {
    const client = createClient({ fetch: async () => sseResponse([durable(1), durable(3)]) })
    const errors: unknown[] = []
    const ac = new AbortController()
    await client.subscribe({
      since: 0,
      signal: ac.signal,
      reconnectDelayMs: 1,
      onEvent: () => {},
      onDisconnect: (err) => {
        errors.push(err)
        ac.abort()
      },
    })
    expect(String(errors[0])).toMatch(/event gap: expected seq 2, got 3/)
  })
})
