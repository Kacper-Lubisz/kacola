import type { IncomingMessage } from 'node:http'
import type { AgentChannel } from '../agents/channel.ts'
import type { Handlers } from '../daemon.ts'
import { DaemonError } from '../errors.ts'
import type { SharingService } from './sharing.ts'

// Team sharing routes of the local daemon (the window's): share / unshare / recap / sync / history of an
// agenda, and following someone else's. All owner-only (an agent's lease token is refused). The hosted
// server's own share routes (createShare, pushShare, the link) answer 501 here: a daemon is the thing
// that pushes, not a target.

type Local =
  | 'getAgendaShare'
  | 'shareAgenda'
  | 'unshareAgenda'
  | 'shareAgendaRecap'
  | 'syncAgendaShare'
  | 'getAgendaShareHistory'
  | 'followAgenda'
  | 'confirmFollowAgenda'
type Hosted =
  | 'createShare'
  | 'updateShare'
  | 'revokeShare'
  | 'pushShare'
  | 'getShareState'
  | 'listShareChanges'
  | 'revokeShareParticipant'
  | 'hideShareComment'
  | 'getSharedPage'
  | 'shareVerify'
  | 'shareConfirm'
  | 'shareAddItem'
  | 'shareAddComment'

const hostedOnly = () => {
  throw new DaemonError(
    'unavailable',
    'shared agendas are served by a hosted kacola server, not the local daemon',
    501,
  )
}

export function sharingHandlers(
  svc: SharingService,
  channel: AgentChannel,
  exists: (id: string) => void,
): Pick<Handlers, Local | Hosted> {
  const owner = (req: IncomingMessage, what: string) => channel.requireOwner(req, what)
  return {
    getAgendaShare: ({ params }) => {
      exists(params.id)
      return svc.status(params.id)
    },
    shareAgenda: ({ params, body, req }) => {
      owner(req, 'sharing an agenda')
      return svc.share(params.id, body)
    },
    unshareAgenda: ({ params, req }) => {
      owner(req, 'unsharing an agenda')
      exists(params.id)
      return svc.unshare(params.id)
    },
    shareAgendaRecap: ({ params, body, req }) => {
      owner(req, 'sharing a recap')
      exists(params.id)
      return svc.setRecap(params.id, body.shared)
    },
    syncAgendaShare: ({ params, req }) => {
      owner(req, 'syncing a shared agenda')
      exists(params.id)
      return svc.syncNow(params.id)
    },
    getAgendaShareHistory: async ({ params, req }) => {
      owner(req, 'the merge history')
      exists(params.id)
      return { changes: await svc.history(params.id) }
    },
    followAgenda: ({ body, req }) => {
      owner(req, 'following a shared agenda')
      return svc.follow(body)
    },
    confirmFollowAgenda: ({ body, req }) => {
      owner(req, 'following a shared agenda')
      return svc.confirmFollow(body)
    },
    createShare: hostedOnly,
    updateShare: hostedOnly,
    revokeShare: hostedOnly,
    pushShare: hostedOnly,
    getShareState: hostedOnly,
    listShareChanges: hostedOnly,
    revokeShareParticipant: hostedOnly,
    hideShareComment: hostedOnly,
    getSharedPage: hostedOnly,
    shareVerify: hostedOnly,
    shareConfirm: hostedOnly,
    shareAddItem: hostedOnly,
    shareAddComment: hostedOnly,
  }
}
