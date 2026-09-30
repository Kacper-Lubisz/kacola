import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  type AgentAccess,
  type AgentMode,
  type AgentPresenceState,
  encodeSse,
  type LeaseInfo,
  matchPath,
  type RouteName,
  routes,
} from '@gnomeola/protocol'

// The window's agent-channel routes (listAgentLeases, updateAgentLease, releaseAgentLease,
// get/setAgentAccess) and the `agent.presence` events, for window e2e while the agent-channel wave's
// handlers are not merged (the daemon answers them 501). A proxy in front of the REAL daemon: every
// request goes to the daemon first; only a 501 from one of these routes is answered here instead, from an
// in-memory state validated against the protocol's response schemas (so it cannot drift from the
// contract). `presence()` writes an ephemeral agent.presence message into the window's /events stream at
// a message boundary. Once the real handlers answer, the overlay passes them straight through.

const OWNED: RouteName[] = [
  'listAgentLeases',
  'updateAgentLease',
  'releaseAgentLease',
  'getAgentAccess',
  'setAgentAccess',
]

export type AgentChannelOverlay = {
  url: string
  leases: LeaseInfo[]
  access: Map<string, AgentAccess>
  /** Requests this overlay answered itself (route names), in order. */
  answered: RouteName[]
  presence(
    sessionId: string,
    p: { leaseId: string; name: string; mode: AgentMode; state: AgentPresenceState },
  ): void
  close(): Promise<void>
}

export async function startAgentChannelOverlay(daemonUrl: string): Promise<AgentChannelOverlay> {
  const leases: LeaseInfo[] = []
  const access = new Map<string, AgentAccess>()
  const answered: RouteName[] = []
  const streams = new Set<{ res: ServerResponse; pending: string[]; midMessage: boolean }>()

  const table = OWNED.map((name) => ({ name, def: routes[name] }))
  const own = (method: string, path: string) => {
    for (const r of table) {
      if (r.def.method !== method) continue
      const params = matchPath(r.def.path, path)
      if (params) return { name: r.name, params }
    }
    return null
  }
  const send = (res: ServerResponse, name: RouteName, status: number, body: unknown) => {
    const schema = routes[name].response
    if (schema !== 'sse') schema.parse(body)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const answer = (name: RouteName, params: Record<string, string>, body: unknown, res: ServerResponse) => {
    answered.push(name)
    switch (name) {
      case 'listAgentLeases':
        return send(res, name, 200, { leases: leases.filter((l) => l.sessionId === params.id) })
      case 'updateAgentLease': {
        const l = leases.find((x) => x.id === params.leaseId)
        if (!l) return send404(res)
        l.mode = (body as { mode: AgentMode }).mode
        const { state: _s, endedAt: _e, endReason: _r, counts: _c, actions: _a, ...lease } = l
        return send(res, name, 200, lease)
      }
      case 'releaseAgentLease': {
        const l = leases.find((x) => x.id === params.leaseId)
        if (!l) return send404(res)
        Object.assign(l, { state: 'disconnected', endedAt: new Date().toISOString(), endReason: 'revoked' })
        return send(res, name, 200, { released: true })
      }
      case 'getAgentAccess':
        return send(res, name, 200, access.get(params.id!) ?? accessOf(params.id!, false, false))
      case 'setAgentAccess': {
        const cur = access.get(params.id!) ?? accessOf(params.id!, false, false)
        const next = accessOf(params.id!, cur.private, (body as { allowAgents: boolean }).allowAgents)
        access.set(params.id!, next)
        return send(res, name, 200, next)
      }
      default:
        return send404(res)
    }
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const raw = Buffer.concat(chunks)
    const url = new URL(req.url ?? '/', 'http://overlay')
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers))
      if (typeof v === 'string' && !['host', 'connection', 'content-length'].includes(k)) headers[k] = v
    const ac = new AbortController()
    res.on('close', () => ac.abort())
    let upstream: Response
    try {
      upstream = await fetch(`${daemonUrl}${url.pathname}${url.search}`, {
        method: req.method,
        headers,
        body: raw.length ? raw : undefined,
        signal: ac.signal,
      })
    } catch {
      if (!res.headersSent) res.writeHead(502).end()
      return
    }
    const mine = own(req.method ?? 'GET', url.pathname)
    if (mine && upstream.status === 501) {
      await upstream.body?.cancel()
      return answer(mine.name, mine.params, raw.length ? JSON.parse(raw.toString('utf8')) : {}, res)
    }
    const out: Record<string, string> = {}
    upstream.headers.forEach((v, k) => {
      if (!['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(k)) out[k] = v
    })
    res.writeHead(upstream.status, out)
    if (!upstream.body) return res.end()
    const isEvents = url.pathname === '/events'
    const s = { res, pending: [] as string[], midMessage: false }
    if (isEvents) streams.add(s)
    const dec = new TextDecoder()
    try {
      for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
        if (!isEvents) {
          res.write(chunk)
          continue
        }
        const text = dec.decode(chunk, { stream: true })
        res.write(text)
        s.midMessage = !text.endsWith('\n\n')
        if (!s.midMessage) for (const p of s.pending.splice(0)) res.write(p)
      }
    } catch {
      // the window went away, or the daemon stopped
    } finally {
      streams.delete(s)
      res.end()
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    url,
    leases,
    access,
    answered,
    presence(sessionId, p) {
      const msg = encodeSse({
        data: JSON.stringify({
          seq: null,
          at: new Date().toISOString(),
          sessionId,
          data: { type: 'agent.presence', ...p },
        }),
      })
      const l = leases.find((x) => x.id === p.leaseId)
      if (l) Object.assign(l, { state: p.state, mode: p.mode, heartbeatAt: new Date().toISOString() })
      for (const s of streams) {
        if (s.midMessage) s.pending.push(msg)
        else s.res.write(msg)
      }
    },
    close: () =>
      new Promise<void>((r) => {
        for (const s of streams) s.res.destroy()
        server.close(() => r())
      }),
  }
}

const accessOf = (sessionId: string, priv: boolean, allowAgents: boolean): AgentAccess => ({
  sessionId,
  private: priv,
  allowAgents,
  attachable: !priv || allowAgents,
})

function send404(res: ServerResponse) {
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { code: 'not_found', message: 'no such lease' } }))
}
