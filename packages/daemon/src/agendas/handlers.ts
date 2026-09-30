import { type Agenda, type agendaRoutes, formatAgendaMarkdown, parseSince } from '@gnomeola/protocol'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import type { AgendaService } from './service.ts'

// The agenda routes. Reads of a private agenda — marked private, or linked to a private session — are
// 404 without includePrivate, like a private session's transcript (the CLI and the skill never pass it);
// edits are not gated, like renames. Status rules are the store's (AgendaStore.setStatus).
//
// The live channel (leases, live attach) is contract-only here: its handlers are the agent-channel
// wave's, and answer 501 until then.

type AgendaRouteName = keyof typeof agendaRoutes

const notYet = (what: string) => () => {
  throw new DaemonError('unavailable', `${what} is not available yet (the agent channel is not built)`, 501)
}

export function agendaHandlers(svc: AgendaService): Pick<Handlers, AgendaRouteName> {
  const store = svc.agendas
  const visible = (id: string, includePrivate: boolean | undefined): Agenda => {
    const a = store.get(id)
    if (!a || !store.isVisible(a, includePrivate)) throw new DaemonError('not_found', `no agenda ${id}`)
    return a
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
    createAgenda: ({ body }) => svc.create(body).view,
    resolveAgendaLink: ({ body }) => svc.resolveLink(body),
    getAgenda: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      return store.view(params.id)!
    },
    updateAgenda: ({ params, body }) => {
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
    deleteAgenda: ({ params }) => {
      exists(params.id)
      store.delete(params.id)
      return { deleted: true as const }
    },
    getAgendaHistory: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      return { changes: store.history(params.id) }
    },
    addAgendaItems: ({ params, body }) => {
      exists(params.id)
      const items = store.addItems(params.id, body.items, { before: body.before, by: body.by })
      return { items, version: store.get(params.id)!.version }
    },
    updateAgendaItem: ({ params, body }) => {
      exists(params.id)
      const { by, ...patch } = body
      return store.updateItem(params.id, params.itemId, patch, svc.by(by))
    },
    deleteAgendaItem: ({ params }) => {
      exists(params.id)
      store.deleteItem(params.id, params.itemId)
      return { deleted: true as const }
    },
    setAgendaItemStatus: ({ params, body }) => {
      exists(params.id)
      return store.setStatus(params.id, params.itemId, body)
    },
    reorderAgendaItems: ({ params, body }) => {
      exists(params.id)
      return { version: store.reorder(params.id, body.itemIds) }
    },
    exportAgendaMarkdown: ({ params, query }) => {
      const a = visible(params.id, query.includePrivate)
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
    importAgendaMarkdown: ({ params, body }) => {
      exists(params.id)
      return store.importMarkdown(params.id, body.markdown, body.baseVersion, body.mode)
    },
    addContextCard: ({ params, body }) => {
      exists(params.id)
      return store.addContext(params.id, body)
    },
    updateContextCard: ({ params, body }) => {
      exists(params.id)
      const { by: _by, ...patch } = body
      return store.updateContext(params.id, params.cardId, patch)
    },
    deleteContextCard: ({ params }) => {
      exists(params.id)
      store.deleteContext(params.id, params.cardId)
      return { deleted: true as const }
    },
    addSuggestion: ({ params, body }) => {
      exists(params.id)
      return store.addSuggestion(params.id, body)
    },
    acceptSuggestion: ({ params, body }) => {
      exists(params.id)
      return store.resolveSuggestion(params.id, params.suggestionId, 'accept', svc.by(body.by))
    },
    dismissSuggestion: ({ params, body }) => {
      exists(params.id)
      return store.resolveSuggestion(params.id, params.suggestionId, 'dismiss', svc.by(body.by))
    },
    agendaInviteBlock: ({ params, body }) => svc.inviteBlock(params.id, body),
    createAgentLease: notYet('agent leases'),
    heartbeatAgentLease: notYet('agent leases'),
    releaseAgentLease: notYet('agent leases'),
    liveAttach: async () => notYet('live attach')(),
  }
}
