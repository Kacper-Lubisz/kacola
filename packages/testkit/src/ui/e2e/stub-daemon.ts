import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  type DurableEvent,
  DurableEvent as DurableEventSchema,
  encodeSse,
  encodeSseComment,
  matchPath,
  newId,
  type RouteName,
  routes,
  type Session,
} from '@kacola/protocol'

// A protocol-conformant stand-in for kacolad, just big enough to drive the UI's *real* client path
// (health → listSessions → resumable /events SSE → create/start/stop) in e2e tests before the real
// daemon exists. Every response body is validated against the route table's zod schema before it
// is sent, so the stub cannot drift from the contract without failing loudly.

export type StubDaemon = {
  url: string
  sessions: Map<string, Session>
  /** The `since` query of every /events connection, in order — proves resume-from-cursor. */
  eventConnections: (number | undefined)[]
  requests: string[]
  upsert(s: Session): DurableEvent
  /** Destroy every open event stream (the client must reconnect with its cursor). */
  dropStreams(): number
  /** While true, /events answers 503 so reconnects keep failing. */
  refuseEvents: boolean
  close(): Promise<void>
}

export function makeSession(title: string, over: Partial<Session> = {}): Session {
  const now = Date.now()
  return {
    id: newId('ses', now),
    title,
    createdAt: new Date(now).toISOString(),
    startedAt: new Date(now).toISOString(),
    endedAt: new Date(now).toISOString(),
    status: 'stopped',
    private: false,
    durationMs: 60_000,
    tracks: [],
    error: null,
    ...over,
  }
}

export async function startStubDaemon(initial: Session[] = [], port = 0): Promise<StubDaemon> {
  const sessions = new Map(initial.map((s) => [s.id, s]))
  const log: DurableEvent[] = []
  const streams = new Set<ServerResponse>()
  const eventConnections: (number | undefined)[] = []
  const requests: string[] = []
  let seq = 0
  const startedAt = Date.now()

  function upsert(s: Session): DurableEvent {
    sessions.set(s.id, s)
    const ev = DurableEventSchema.parse({
      seq: ++seq,
      at: new Date().toISOString(),
      sessionId: s.id,
      data: { type: 'session.upserted', session: s },
    })
    log.push(ev)
    for (const res of streams) res.write(encodeSse({ id: String(ev.seq), data: JSON.stringify(ev) }))
    return ev
  }
  for (const s of initial) upsert(s)

  const send = (res: ServerResponse, name: RouteName, body: unknown, status = 200) => {
    const schema = routes[name].response
    const checked = typeof schema === 'string' ? body : schema.parse(body)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(checked))
  }
  const notFound = (res: ServerResponse, message: string) => {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'not_found', message } }))
  }

  function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://stub')
    requests.push(`${req.method} ${url.pathname}${url.search}`)
    const route = (Object.keys(routes) as RouteName[]).find(
      (n) => routes[n].method === req.method && matchPath(routes[n].path, url.pathname),
    )
    if (!route) return notFound(res, `no route ${req.method} ${url.pathname}`)
    const params = matchPath(routes[route].path, url.pathname)!
    switch (route) {
      case 'health':
        return send(res, 'health', {
          ok: true,
          version: '0.0.0-stub',
          uptimeMs: Date.now() - startedAt,
          lastSeq: seq,
          capture: { available: true, backend: 'stub', detail: null },
          models: [],
          llm: { provider: 'none', ready: false },
        })
      case 'listSessions':
        return send(res, 'listSessions', {
          sessions: [...sessions.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        })
      case 'createSession': {
        const now = new Date().toISOString()
        const s: Session = {
          ...makeSession('New recording'),
          createdAt: now,
          startedAt: null,
          endedAt: null,
          status: 'idle',
          durationMs: 0,
        }
        upsert(s)
        return send(res, 'createSession', s, 201)
      }
      case 'startSession':
      case 'stopSession': {
        const s = sessions.get(params.id!)
        if (!s) return notFound(res, `no session ${params.id}`)
        const now = new Date().toISOString()
        const next: Session =
          route === 'startSession'
            ? { ...s, status: 'recording', startedAt: now }
            : { ...s, status: 'stopped', endedAt: now }
        upsert(next)
        return send(res, route, next)
      }
      case 'events': {
        if (stub.refuseEvents) {
          res.writeHead(503, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { code: 'unavailable', message: 'stub is refusing streams' } }))
          return
        }
        const sinceRaw = url.searchParams.get('since')
        const since = sinceRaw === null ? undefined : Number(sinceRaw)
        eventConnections.push(since)
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
        res.write(encodeSseComment('stub hello'))
        if (since !== undefined) {
          for (const ev of log) {
            if (ev.seq > since) res.write(encodeSse({ id: String(ev.seq), data: JSON.stringify(ev) }))
          }
        }
        streams.add(res)
        req.on('close', () => streams.delete(res))
        return
      }
      default:
        return notFound(res, `stub does not implement ${route}`)
    }
  }

  const server: Server = createServer(handle)
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r))
  const bound = (server.address() as AddressInfo).port
  const stub: StubDaemon = {
    refuseEvents: false,
    url: `http://127.0.0.1:${bound}`,
    sessions,
    eventConnections,
    requests,
    upsert,
    dropStreams() {
      const n = streams.size
      for (const res of streams) res.destroy()
      streams.clear()
      return n
    },
    async close() {
      for (const res of streams) res.destroy()
      server.closeAllConnections()
      await new Promise<void>((r) => server.close(() => r()))
    },
  }
  return stub
}
