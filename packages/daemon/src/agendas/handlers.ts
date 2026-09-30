import type { IncomingMessage } from 'node:http'
import {
  type Agenda,
  type agendaRoutes,
  formatAgendaMarkdown,
  isAutomated,
  parseSince,
} from '@gnomeola/protocol'
import type { AgentChannel } from '../agents/channel.ts'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import type { AgendaService } from './service.ts'

// The agenda routes. Reads of a private agenda — marked private, or linked to a private session — are
// 404 without includePrivate, like a private session's transcript (the CLI and the skill never pass it);
// edits are not gated, like renames. Status rules are the store's (AgendaStore.setStatus).
//
// Agent channel: a request carrying a lease token (LEASE_HEADER) is a connected agent. Its writes go
// through the channel (scope, mode, rate limits, attribution bound to the lease: agents/channel.ts); the
// owner-only routes refuse it. Without a token the caller is the user (loopback trust, as before), and
// a body claiming an automated author (`agent:*`, `tracker`) is refused: those attributions come only
// from a lease, or from the daemon's own tracker writing to the store directly.
// The lease/live routes themselves are in agents/handlers.ts.

type AgendaRouteName = Exclude<
  keyof typeof agendaRoutes,
  | 'createAgentLease'
  | 'listAgentLeases'
  | 'heartbeatAgentLease'
  | 'updateAgentLease'
  | 'releaseAgentLease'
  | 'liveAttach'
  | 'listLiveSessions'
  | 'getAgentAccess'
  | 'setAgentAccess'
>

export function agendaHandlers(svc: AgendaService, channel: AgentChannel): Pick<Handlers, AgendaRouteName> {
  const store = svc.agendas
  /** A read: a lease may read its own recording's agenda (its session may be a private one it was let into). */
  const visible = (id: string, includePrivate: boolean | undefined, req?: IncomingMessage): Agenda => {
    const a = store.get(id)
    const lease = req ? channel.fromRequest(req) : null
    if (a && lease && a.sessionId === lease.lease.sessionId) return a
    if (!a || !store.isVisible(a, includePrivate)) throw new DaemonError('not_found', `no agenda ${id}`)
    return a
  }
  const owner = (req: IncomingMessage, what: string) => channel.requireOwner(req, what)
  /** The user path: an automated attribution in the body needs a lease. */
  const userBy = (by: string | undefined) => {
    if (by !== undefined && isAutomated(by))
      throw new DaemonError(
        'unauthorized',
        `"${by}" is set by a lease, not the request body (gnomeola live attach)`,
      )
  }
  const exists = (id: string): Agenda => {
    const a = store.get(id)
    if (!a) throw new DaemonError('not_found', `no agenda ${id}`)
    return a
  }
  const since = (v: string | undefined) => {
    if (v === undefined) return undefined
    try {
      return parseSince(v)
    } catch (err) {
      throw new DaemonError('bad_request', (err as Error).message)
    }
  }

  return {
    listAgendas: ({ query }) => ({
      agendas: store.list({
        eventUid: query.eventUid,
        sessionId: query.sessionId,
        since: since(query.since),
        limit: query.limit,
        includePrivate: query.includePrivate,
      }),
    }),
    createAgenda: ({ body, req }) => {
      owner(req, 'create agendas')
      userBy(body.by)
      return svc.create(body).view
    },
    resolveAgendaLink: ({ body, req }) => {
      if (body.create) owner(req, 'create agendas')
      return svc.resolveLink(body)
    },
    getAgenda: ({ params, query, req }) => {
      visible(params.id, query.includePrivate, req)
      return store.view(params.id)!
    },
    updateAgenda: ({ params, body, req }) => {
      owner(req, 'change the agenda header')
      exists(params.id)
      const meeting = svc.relink(body)
      return store.update(
        params.id,
        () => ({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.goals !== undefined ? { goals: body.goals } : {}),
          ...(body.private !== undefined ? { private: body.private } : {}),
          ...(meeting !== undefined ? { meeting } : {}),
        }),
        body.baseVersion,
      )
    },
    deleteAgenda: ({ params, req }) => {
      owner(req, 'delete agendas')
      exists(params.id)
      store.delete(params.id)
      return { deleted: true as const }
    },
    getAgendaHistory: ({ params, query, req }) => {
      visible(params.id, query.includePrivate, req)
      return { changes: store.history(params.id) }
    },
    addAgendaItems: ({ params, body, req }) => {
      exists(params.id)
      const lease = channel.fromRequest(req)
      if (lease) return channel.addItems(lease, params.id, body.items, body.before)
      userBy(body.by)
      const items = store.addItems(params.id, body.items, { before: body.before, by: body.by })
      return { items, version: store.get(params.id)!.version }
    },
    updateAgendaItem: ({ params, body, req }) => {
      exists(params.id)
      const { by, ...patch } = body
      const lease = channel.fromRequest(req)
      if (lease) return channel.editItem(lease, params.id, params.itemId, patch)
      userBy(by)
      return store.updateItem(params.id, params.itemId, patch, svc.by(by))
    },
    deleteAgendaItem: ({ params, req }) => {
      owner(req, 'remove items')
      exists(params.id)
      store.deleteItem(params.id, params.itemId)
      return { deleted: true as const }
    },
    setAgendaItemStatus: ({ params, body, req }) => {
      exists(params.id)
      const lease = channel.fromRequest(req)
      if (lease) return channel.setStatus(lease, params.id, params.itemId, body)
      userBy(body.by)
      return store.setStatus(params.id, params.itemId, body)
    },
    reorderAgendaItems: ({ params, body, req }) => {
      owner(req, 'reorder the agenda')
      exists(params.id)
      return { version: store.reorder(params.id, body.itemIds) }
    },
    exportAgendaMarkdown: ({ params, query, req }) => {
      const a = visible(params.id, query.includePrivate, req)
      const items = store.items(a.id)
      return {
        markdown: formatAgendaMarkdown({
          title: a.title,
          goals: a.goals,
          items: items.map((i) => ({
            text: i.text,
            kind: i.kind,
            owner: i.owner,
            timeboxMin: i.timeboxMin,
            status: i.status,
            outcome: i.outcome,
          })),
        }),
        version: a.version,
      }
    },
    importAgendaMarkdown: ({ params, body, req }) => {
      owner(req, 'import markdown over the agenda')
      exists(params.id)
      return store.importMarkdown(params.id, body.markdown, body.baseVersion, body.mode)
    },
    addContextCard: ({ params, body, req }) => {
      exists(params.id)
      const lease = channel.fromRequest(req)
      if (lease) return channel.addContext(lease, params.id, body)
      userBy(body.by)
      return store.addContext(params.id, body)
    },
    updateContextCard: ({ params, body, req }) => {
      owner(req, 'change context cards')
      exists(params.id)
      const { by: _by, ...patch } = body
      return store.updateContext(params.id, params.cardId, patch)
    },
    deleteContextCard: ({ params, req }) => {
      owner(req, 'delete context cards')
      exists(params.id)
      store.deleteContext(params.id, params.cardId)
      return { deleted: true as const }
    },
    addSuggestion: ({ params, body, req }) => {
      exists(params.id)
      const lease = channel.fromRequest(req)
      if (!lease)
        throw new DaemonError(
          'unauthorized',
          'suggestions come from the tracker or a connected agent: attach first (gnomeola live attach)',
        )
      return channel.suggest(lease, params.id, body)
    },
    acceptSuggestion: ({ params, body, req }) => {
      owner(req, 'accept suggestions')
      userBy(body.by)
      exists(params.id)
      return store.resolveSuggestion(params.id, params.suggestionId, 'accept', svc.by(body.by))
    },
    dismissSuggestion: ({ params, body, req }) => {
      owner(req, 'dismiss suggestions')
      userBy(body.by)
      exists(params.id)
      return store.resolveSuggestion(params.id, params.suggestionId, 'dismiss', svc.by(body.by))
    },
    agendaInviteBlock: ({ params, body, req }) => {
      if (body.write || body.remove) owner(req, 'write to the calendar')
      return svc.inviteBlock(params.id, body)
    },
  }
}
