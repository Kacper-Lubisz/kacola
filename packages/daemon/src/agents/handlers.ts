import type { Store } from '@kacola/store'
import type { EventBus } from '../bus.ts'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import type { AgentChannel } from './channel.ts'
import { streamLive } from './live.ts'

// The live channel's routes: leases (owner grants, lists, changes the mode, revokes; the agent heartbeats
// and releases), agent access to private sessions, the recordings an agent could attach to, and the
// live stream itself. The agent-side rules are in channel.ts.

type Names =
  | 'createAgentLease'
  | 'listAgentLeases'
  | 'heartbeatAgentLease'
  | 'updateAgentLease'
  | 'releaseAgentLease'
  | 'liveAttach'
  | 'listLiveSessions'
  | 'getAgentAccess'
  | 'setAgentAccess'

export type LiveHandlerOptions = {
  store: Store
  bus: EventBus
  channel: AgentChannel
  heartbeatMs: number
  pageSize: number
  /** At most one partial per track per this many ms reaches an agent. */
  partialEveryMs: number
}

export function liveHandlers(o: LiveHandlerOptions): Pick<Handlers, Names> {
  const { channel, store } = o
  return {
    createAgentLease: ({ params, body, req }) => {
      channel.requireOwner(req, 'grant leases')
      return channel.create(params.id, body)
    },
    listAgentLeases: ({ params, query, req }) => {
      channel.requireOwner(req, 'list leases')
      if (!store.getSession(params.id)) throw new DaemonError('not_found', `no session ${params.id}`)
      return { leases: channel.list(params.id, query.includeEnded) }
    },
    heartbeatAgentLease: ({ params, body, req }) => channel.heartbeat(params.leaseId, req, body.state),
    updateAgentLease: ({ params, body, req }) => {
      channel.requireOwner(req, 'change its own mode')
      return channel.setMode(params.leaseId, body.mode)
    },
    releaseAgentLease: ({ params, req }) => {
      channel.release(params.leaseId, req)
      return { released: true as const }
    },
    listLiveSessions: async ({ query, signal }) => ({
      sessions: await channel.liveSessions({ wait: query.wait, meeting: query.meeting, signal }),
    }),
    getAgentAccess: ({ params }) => channel.access(params.id),
    setAgentAccess: ({ params, body, req }) => {
      channel.requireOwner(req, 'change agent access')
      return channel.setAccess(params.id, body.allowAgents)
    },
    liveAttach: async ({ params, query, req }, open) => {
      const rec = channel.fromRequest(req)
      if (!rec)
        throw new DaemonError('unauthorized', 'live attach needs a lease token (kacola live attach)', 401)
      if (rec.lease.sessionId !== params.id)
        throw new DaemonError('unauthorized', `this lease is for session ${rec.lease.sessionId}`)
      let since = query.since
      const header = req.headers['last-event-id']
      if (typeof header === 'string' && header.trim() !== '') {
        const n = Number(header)
        if (!Number.isInteger(n) || n < 0) throw new DaemonError('bad_request', 'Last-Event-ID must be a seq')
        since = n
      }
      if (since !== undefined && since > store.lastSeq())
        throw new DaemonError(
          'conflict',
          `cursor ${since} is ahead of the event log (lastSeq ${store.lastSeq()})`,
        )
      await streamLive({
        store,
        bus: o.bus,
        channel,
        rec,
        sse: open(),
        sessionId: params.id,
        since,
        partials: query.partials ?? true,
        partialEveryMs: o.partialEveryMs,
        heartbeatMs: o.heartbeatMs,
        pageSize: o.pageSize,
      })
    },
  }
}
