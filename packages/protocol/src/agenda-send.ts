import { z } from 'zod'
import { ErrorReason } from './ai.ts'
import { ShareAgendaBody, ShareStatus } from './sharing.ts'

// "Send Ana the agenda" as ONE operation: share the agenda (or reuse its share) so it has an https page
// anyone can open, and hand back the invitation text with that web link first and the kacola link
// second — written into the calendar event when the calendar allows it, otherwise to paste. Replaces the
// two-step "Add link to invite" then "Share…", whose order produced a `kacola://`-only invite an attendee
// without kacola cannot open.

export const SendAgendaBody = ShareAgendaBody.extend({
  /** Also write the invitation text into the calendar event (when the calendar allows). Default true. */
  writeInvite: z.boolean().optional(),
})
export type SendAgendaBody = z.infer<typeof SendAgendaBody>

export const SendAgendaState = z.enum([
  /** Shared: `inviteText` carries the https link. */
  'ready',
  /** No hosted sharing configured: there is no link an attendee can open. `inviteText` is null. */
  'no-share-host',
  /** Private, part of a private recording, or someone else's agenda: it cannot be sent from here. */
  'not-shareable',
])
export type SendAgendaState = z.infer<typeof SendAgendaState>

export const SendAgendaResult = z.object({
  state: SendAgendaState,
  /** One plain sentence for the state ("Ana can open this link…" / "kacola can't make a link…"). */
  message: z.string(),
  /** The stable reason when not ready (`no-share-host`, `private-meeting`). */
  reason: ErrorReason.nullable(),
  /** The text for the invitation (web link first). Null unless `ready`: never a link attendees can't open. */
  inviteText: z.string().nullable(),
  /** The page anyone can open (`https://<host>/a/<token>`). */
  webLink: z.string().nullable(),
  /** The `kacola://` link (opens the agenda for attendees who use kacola). */
  appLink: z.string(),
  /** The share after this call (null when nothing was shared). */
  share: ShareStatus.nullable(),
  /** The invitation text is now in the calendar event. */
  written: z.boolean(),
  /** Why it was not written (a read-only calendar, no linked event, …): paste `inviteText` instead. */
  writeReason: z.string().nullable(),
})
export type SendAgendaResult = z.infer<typeof SendAgendaResult>

export const agendaSendRoutes = {
  /** Owner: share (or reuse the share) and return the invitation text with the web link. */
  sendAgenda: { method: 'POST', path: '/agendas/:id/send', body: SendAgendaBody, response: SendAgendaResult },
} as const
