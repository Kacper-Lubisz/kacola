import { aiErrorCopy, type SendAgendaBody, type SendAgendaResult } from '@kacola/protocol'
import { DaemonError } from '../errors.ts'
import type { AgendaService } from './service.ts'
import type { SharingService } from './sharing.ts'

// "Send the agenda" (UX trust fixes): one operation that makes a link an attendee can open and puts it in
// the invitation. Share the agenda (or reuse its share), then build the invitation text — the https page
// first, the kacola link second — and write it into the calendar event when the calendar allows it.
// Without hosted sharing there is no link a person without kacola can open, and the answer says so
// (`no-share-host`) instead of handing back a `kacola://`-only block.

export async function sendAgenda(
  svc: AgendaService,
  sharing: SharingService,
  agendaId: string,
  body: SendAgendaBody,
): Promise<SendAgendaResult> {
  const a = svc.agendas.get(agendaId)
  if (!a) throw new DaemonError('not_found', `no agenda ${agendaId}`)
  const { appLink } = svc.links(a)
  const refuse = (
    state: SendAgendaResult['state'],
    message: string,
    reason: SendAgendaResult['reason'],
  ): SendAgendaResult => ({
    state,
    message,
    reason,
    inviteText: null,
    webLink: null,
    appLink,
    share: null,
    written: false,
    writeReason: null,
  })

  // private (or part of a private recording): never on a hosted page
  if (!svc.agendas.isVisible(a, false))
    return refuse(
      'not-shareable',
      "This agenda is private, so kacola won't put it on a link. Make it not private first.",
      'private-meeting',
    )
  const before = sharing.status(agendaId)
  if (before.role === 'member')
    return refuse(
      'not-shareable',
      `This is ${before.ownerName}'s agenda. Only they can send it; their invitation has the link.`,
      null,
    )
  const reusable = before.shared && before.link !== null
  if (!reusable && !sharing.hostConfigured())
    return refuse('no-share-host', aiErrorCopy('no-share-host').message, 'no-share-host')

  const { writeInvite, ...options } = body
  const changesOptions = Object.values(options).some((v) => v !== undefined)
  const share = reusable && !changesOptions ? before : await sharing.share(agendaId, options)
  const invite = await svc.inviteBlock(agendaId, { write: writeInvite ?? true })
  if (!invite.webLink)
    // shared, yet no page: the host answered without a link (should not happen); never hand out kacola-only
    return refuse('no-share-host', aiErrorCopy('no-share-host').message, 'no-share-host')
  return {
    state: 'ready',
    message: invite.written
      ? 'The invitation now has a link anyone can open.'
      : 'Paste this into the invitation: anyone with the link can open the agenda.',
    reason: null,
    inviteText: invite.block,
    webLink: invite.webLink,
    appLink: invite.appLink,
    share: sharing.status(agendaId) ?? share,
    written: invite.written,
    writeReason: invite.written ? null : invite.reason,
  }
}
