import type { AgendaView } from '@kacola/protocol'
import type { AgentChannel } from '../agents/channel.ts'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import { actorsOf, itemVersions, participantNames } from './history.ts'
import { sendAgenda } from './send.ts'
import type { AgendaService } from './service.ts'
import type { SharingService } from './sharing.ts'

// UX trust fixes on agendas: "send the agenda" (one operation, a link attendees can open), item history
// that restores, and actor names in words on the agenda view.

type Routes = 'sendAgenda' | 'getAgendaItemHistory' | 'restoreAgendaItem' | 'getAgenda'

export function agendaTrustHandlers(
  svc: AgendaService,
  sharing: SharingService,
  channel: AgentChannel,
  base: Pick<Handlers, 'getAgenda'>,
): Pick<Handlers, Routes> {
  const store = svc.agendas
  const names = (id: string) => participantNames(sharing.status(id))
  const exists = (id: string) => {
    if (!store.get(id)) throw new DaemonError('not_found', `no agenda ${id}`)
  }
  return {
    // the agenda view, plus every actor in it in words
    getAgenda: async (ctx) => {
      const v: AgendaView = await base.getAgenda(ctx)
      const bys = [
        ...v.items.flatMap((i) => [i.changedBy, i.createdBy]),
        ...v.context.map((c) => c.createdBy),
        ...v.suggestions.flatMap((s) => [s.source, s.resolvedBy]),
      ]
      return { ...v, actors: actorsOf(bys, names(v.agenda.id)) }
    },
    sendAgenda: ({ params, body, req }) => {
      channel.requireOwner(req, 'sending the agenda')
      return sendAgenda(svc, sharing, params.id, body)
    },
    getAgendaItemHistory: ({ params, query, req }) => {
      const a = store.get(params.id)
      const lease = channel.fromRequest(req)
      const leased = a && lease && a.sessionId === lease.lease.sessionId
      if (!a || (!leased && !store.isVisible(a, query.includePrivate)))
        throw new DaemonError('not_found', `no agenda ${params.id}`)
      return {
        versions: itemVersions(store, params.id, {
          ...(query.itemId !== undefined ? { itemId: query.itemId } : {}),
          names: names(params.id),
        }),
      }
    },
    restoreAgendaItem: ({ params, body, req }) => {
      channel.requireOwner(req, 'restoring an agenda item')
      exists(params.id)
      const item = store.restoreItem(params.id, params.itemId, body.seq, 'user')
      return { item, version: store.get(params.id)!.version }
    },
  }
}
