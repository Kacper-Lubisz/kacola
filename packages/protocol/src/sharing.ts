import { z } from 'zod'
import { agentDisplayName, possessive } from './actors.ts'
import {
  AgendaItemKind,
  AgendaItemStatus,
  type ChangedBy,
  ChangedBy as ChangedBySchema,
  ItemOwner,
  ItemText,
  MAX_CONTEXT_CHARS,
  MAX_TIMEBOX_MIN,
} from './agendas.ts'
import { Iso } from './schemas.ts'

// Team sharing (kacola phase 5): an agenda shared through the owner's hosted server.
//
// What leaves the owner's device is a PROJECTION of the agenda, never its log:
//
//   shared      the title, the meeting (event UID + times), goals only when the owner opts in, the items
//               (text, kind, owner, timebox, order) and their statuses with attribution, the context
//               cards the owner marked `shared`, and — only for an occurrence whose recap the owner chose
//               to share — the outcomes.
//   never       transcripts, segments, evidence (no quotes AND no segment ids: a status says who and
//               when, not what was heard), status notes, private cards, suggestions, the session id,
//               notes, voiceprints.
//
// The push schemas below are strict objects: a key that is not part of the projection (`evidence`,
// `quote`, `note`, …) is a 400, so nothing extra can ride along by accident.
//
// Who is who on a share:
//
//   owner     the person who shared it, writing from their own paired device(s) (pairing token);
//   member    an attendee running kacola whose email the owner listed: their daemon follows the agenda
//             (a mirror of it, linked to the same calendar occurrence) and pushes its own status
//             changes — their person, their tracker, their agent — each attributed;
//   invitee   anyone with the link who verified an email (magic link): may add an item or a comment.
//
// Every status change any device submits is kept in the share's history with what became of it
// (applied, agreed, refused, superseded) — nothing is silently lost. The merge rules (decideSharedStatus
// in @kacola/store) per item: the owner's manual override wins over everyone, a member's manual
// override over automated changers, automated changers only move forward; between people of the same
// standing the latest change wins.

// ------------------------------------------------------------------------------------- identities

export const ShareRole = z.enum(['owner', 'member', 'invitee'])
export type ShareRole = z.infer<typeof ShareRole>

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254))

/** Usable inside a `peer:<label>` attribution: an email, or a handle without spaces or slashes. */
export const PeerLabel = z.string().regex(/^[^\s/]{1,190}$/, { message: 'no spaces or slashes' })

/** Who did something on a share. `by` is the attribution on the actor's own device. */
export const SharedActor = z.object({
  /** `owner` for the owner; a participant id (`spt_…`) otherwise. */
  participantId: z.string(),
  role: ShareRole,
  /** The owner's label, or the participant's email. */
  label: z.string().min(1).max(254),
  /** A display name, when the person gave one. */
  name: z.string().max(100).nullable(),
  by: ChangedBySchema,
})
export type SharedActor = z.infer<typeof SharedActor>

/** How a local daemon attributes something another device did on a shared agenda. */
export function peerAttribution(a: SharedActor): ChangedBy {
  if (a.role === 'invitee') return `invitee:${a.label}`
  const label = a.label.replace(/[\s/]+/g, '_').slice(0, 190) || 'peer'
  if (a.by === 'tracker' || a.by.startsWith('agent:')) return `peer:${label}/${a.by}`
  return `peer:${label}`
}

/**
 * What a public page shows for an actor, in the five-actor words (actors.ts): a person's name (or a
 * masked email: invitees see each other), "kacola" for anyone's on-device tracker, "Ben's Claude" for
 * someone's agent. Never "Kacper (tracker)", which makes a person read as a robot.
 */
export function publicActorLabel(a: SharedActor, ownerName: string): string {
  const who = a.role === 'owner' ? ownerName : (a.name ?? maskEmail(a.label))
  if (a.by === 'tracker') return 'kacola'
  if (a.by.startsWith('agent:')) return `${possessive(who)} ${agentDisplayName(a.by.slice('agent:'.length))}`
  return who
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  return domain ? `${local.slice(0, 1)}…@${domain}` : `${email.slice(0, 1)}…`
}

// ---------------------------------------------------------------------------------------- entities

export const ShareMeeting = z.object({
  eventUid: z.string().min(1),
  start: Iso,
  end: Iso.nullable(),
  recurring: z.boolean(),
})
export type ShareMeeting = z.infer<typeof ShareMeeting>

/** One occurrence (one owner agenda) on a share. A recurring series keeps one link for every occurrence. */
export const ShareOccurrence = z.object({
  /** The owner's agenda id for this occurrence. */
  agendaId: z.string(),
  title: z.string().min(1).max(200),
  meeting: ShareMeeting.nullable(),
  /** Only when the owner opted in (`shareGoals`); empty otherwise. */
  goals: z.array(z.string().min(1).max(500)).max(20),
  /** The owner chose to share this occurrence's recap: outcomes are visible. */
  recapShared: z.boolean(),
  addedAt: Iso,
})
export type ShareOccurrence = z.infer<typeof ShareOccurrence>

export const ShareOptions = z.object({
  /** Let people with the link (after verifying an email) add items and comments. */
  allowInvitees: z.boolean(),
  /** Emails of attendees whose own kacola may follow the agenda and write statuses (members). */
  members: z.array(Email).max(100),
})
export type ShareOptions = z.infer<typeof ShareOptions>

export const Share = z.object({
  id: z.string(),
  ownerName: z.string().min(1).max(100),
  ownerLabel: PeerLabel,
  occurrences: z.array(ShareOccurrence).max(500),
  /** The occurrence the link opens (the latest one shared). */
  current: z.string(),
  options: ShareOptions,
  createdAt: Iso,
  updatedAt: Iso,
  /** Unshared: everything but this tombstone is gone, and the link answers 410. */
  revokedAt: Iso.nullable(),
})
export type Share = z.infer<typeof Share>

export const ShareLock = z.enum(['owner', 'member'])

export const SharedItem = z.object({
  id: z.string(),
  /** The owner agenda (occurrence) it belongs to. */
  occurrence: z.string(),
  text: ItemText,
  kind: AgendaItemKind,
  owner: ItemOwner.nullable(),
  timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable(),
  order: z.int().nonnegative(),
  status: AgendaItemStatus,
  /** Only while the occurrence's recap is shared; null otherwise. */
  outcome: z.string().max(4000).nullable(),
  /** The applied change was automatic (a tracker's high-confidence check-off). */
  auto: z.boolean(),
  confidence: z.number().min(0).max(1).nullable(),
  createdBy: SharedActor,
  /** Who made the status what it is (the latest applied change), or created it. */
  changedBy: SharedActor,
  /** A person's manual override that automated changers (and lower-standing people) may not undo. */
  lock: ShareLock.nullable(),
  /** The device time of the latest applied status change (latest-wins between equals). */
  statusAt: Iso.nullable(),
  carriedFrom: z.object({ occurrence: z.string(), itemId: z.string() }).nullable(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type SharedItem = z.infer<typeof SharedItem>

export const ChangeOutcome = z.enum([
  /** It moved the item. */
  'applied',
  /** The item already had that status (two devices saw the same thing). */
  'agreed',
  /** Against the rules: backwards for an automated changer, or over a higher-standing override. */
  'refused',
  /** A person's change older than the one already applied (latest wins). */
  'superseded',
])
export type ChangeOutcome = z.infer<typeof ChangeOutcome>

/** Every status change any device submitted, with what became of it. */
export const SharedChange = z.object({
  id: z.string(),
  /** The submitting device's idempotency key (a re-push of the same change is a no-op). */
  key: z.string().min(1).max(200),
  itemId: z.string(),
  occurrence: z.string(),
  /** The status the submitting device moved from (its view), and to. */
  from: AgendaItemStatus,
  to: AgendaItemStatus,
  actor: SharedActor,
  /** Device time of the change. */
  at: Iso,
  receivedAt: Iso,
  auto: z.boolean(),
  confidence: z.number().min(0).max(1).nullable(),
  outcome: ChangeOutcome,
  reason: z.string().max(300).nullable(),
  /** The item's status on the server before and after this change. */
  before: AgendaItemStatus,
  after: AgendaItemStatus,
})
export type SharedChange = z.infer<typeof SharedChange>

export const SharedCard = z.object({
  id: z.string(),
  occurrence: z.string(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_CONTEXT_CHARS),
  pinned: z.boolean(),
  /** A web link the card came from (local paths and session ids never leave the device). */
  sourceUrl: z.string().max(2000).nullable(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type SharedCard = z.infer<typeof SharedCard>

export const MAX_COMMENT_CHARS = 1000

export const SharedComment = z.object({
  id: z.string(),
  occurrence: z.string(),
  /** null: about the agenda as a whole. */
  itemId: z.string().nullable(),
  author: SharedActor,
  text: z.string().trim().min(1).max(MAX_COMMENT_CHARS),
  at: Iso,
  /** Hidden by the owner (moderation): not shown on the page. */
  hidden: z.boolean(),
})
export type SharedComment = z.infer<typeof SharedComment>

export const ShareParticipant = z.object({
  id: z.string(),
  shareId: z.string(),
  email: Email,
  name: z.string().max(100).nullable(),
  role: z.enum(['member', 'invitee']),
  createdAt: Iso,
  revokedAt: Iso.nullable(),
})
export type ShareParticipant = z.infer<typeof ShareParticipant>

// ------------------------------------------------------------------------------- durable events
//
// Written only by the hosted server (a device can never push them: decideIngest rejects them). Each
// carries the post-state it writes. Secrets — the link token, magic-link codes, participant tokens —
// are never in an event: they live hashed in the server's bookkeeping tables.

export const ShareEvents = [
  /** Created, or its header/options/occurrences changed. */
  z.object({ type: z.literal('share.upserted'), share: Share }),
  /** Unshared: every item, card, comment, change and participant of it is gone; the share is a tombstone. */
  z.object({ type: z.literal('share.revoked'), shareId: z.string(), at: Iso }),
  z.object({ type: z.literal('share.participant.upserted'), participant: ShareParticipant }),
  z.object({ type: z.literal('share.item.upserted'), shareId: z.string(), item: SharedItem }),
  z.object({ type: z.literal('share.item.deleted'), shareId: z.string(), itemId: z.string() }),
  /** A submitted status change and, when it was applied, the item as it now is. */
  z.object({
    type: z.literal('share.change'),
    shareId: z.string(),
    change: SharedChange,
    item: SharedItem.nullable(),
  }),
  z.object({ type: z.literal('share.card.upserted'), shareId: z.string(), card: SharedCard }),
  z.object({ type: z.literal('share.card.deleted'), shareId: z.string(), cardId: z.string() }),
  z.object({ type: z.literal('share.comment.upserted'), shareId: z.string(), comment: SharedComment }),
] as const

// ------------------------------------------------------------------------------------ push (sync)

const OccurrenceInput = z.strictObject({
  agendaId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  meeting: z
    .strictObject({
      eventUid: z.string().min(1).max(500),
      start: Iso,
      end: Iso.nullable(),
      recurring: z.boolean(),
    })
    .nullable(),
  goals: z.array(z.string().trim().min(1).max(500)).max(20),
})

/** One thing a device tells the server. Strict: nothing outside the projection is accepted. */
export const ShareOp = z.discriminatedUnion('op', [
  /** Owner: add or update an occurrence; `current` makes it the one the link opens. */
  z.strictObject({ op: z.literal('occurrence'), occurrence: OccurrenceInput, current: z.boolean() }),
  /** Owner: any item. Member: a new item, or one they created. */
  z.strictObject({
    op: z.literal('item'),
    item: z.strictObject({
      id: z.string().min(1).max(100),
      occurrence: z.string().min(1).max(100),
      text: ItemText,
      kind: AgendaItemKind,
      owner: ItemOwner.nullable(),
      timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable(),
      order: z.int().nonnegative().max(10_000),
      carriedFrom: z.strictObject({ occurrence: z.string(), itemId: z.string() }).nullable(),
    }),
  }),
  z.strictObject({ op: z.literal('item.delete'), itemId: z.string().min(1).max(100) }),
  /** A status change made on the device (owner or member): judged by the merge rules. */
  z.strictObject({
    op: z.literal('status'),
    key: z.string().min(1).max(200),
    itemId: z.string().min(1).max(100),
    from: AgendaItemStatus,
    to: AgendaItemStatus,
    by: ChangedBySchema.refine((b) => b === 'user' || b === 'tracker' || b.startsWith('agent:'), {
      message: 'a device pushes its own changes only (user, tracker, agent:<name>)',
    }),
    at: Iso,
    auto: z.boolean(),
    confidence: z.number().min(0).max(1).nullable(),
  }),
  /** Owner: an item's outcome (the recap). Kept only while that occurrence's recap is shared. */
  z.strictObject({
    op: z.literal('outcome'),
    itemId: z.string().min(1).max(100),
    outcome: z.string().max(4000).nullable(),
  }),
  /** Owner: a context card the owner marked shared. */
  z.strictObject({
    op: z.literal('card'),
    card: z.strictObject({
      id: z.string().min(1).max(100),
      occurrence: z.string().min(1).max(100),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(MAX_CONTEXT_CHARS),
      pinned: z.boolean(),
      sourceUrl: z.string().max(2000).nullable(),
    }),
  }),
  z.strictObject({ op: z.literal('card.delete'), cardId: z.string().min(1).max(100) }),
  /** Owner: share (or stop sharing) an occurrence's recap. Stopping clears its outcomes on the server. */
  z.strictObject({ op: z.literal('recap'), occurrence: z.string().min(1).max(100), shared: z.boolean() }),
])
export type ShareOp = z.infer<typeof ShareOp>

export const SHARE_MAX_OPS = 500

export const SharePushBody = z.strictObject({ ops: z.array(ShareOp).max(SHARE_MAX_OPS) })
export type SharePushBody = z.infer<typeof SharePushBody>

export const ShareOpRefusal = z.object({ index: z.int().nonnegative(), op: z.string(), reason: z.string() })

// ------------------------------------------------------------------------------------ views

export const ShareYou = z.object({ participantId: z.string(), role: ShareRole, label: z.string() })

/** Everything about a share its owner or a member's device needs (the full merge state). */
export const SharedAgendaState = z.object({
  share: Share,
  items: z.array(SharedItem),
  cards: z.array(SharedCard),
  comments: z.array(SharedComment),
  /** The owner sees every participant; a member sees none. */
  participants: z.array(ShareParticipant),
  you: ShareYou,
})
export type SharedAgendaState = z.infer<typeof SharedAgendaState>

export const SharePushResult = z.object({
  applied: z.int().nonnegative(),
  unchanged: z.int().nonnegative(),
  refused: z.array(ShareOpRefusal),
  /** The status changes this push recorded, with their outcome. */
  changes: z.array(SharedChange),
  state: SharedAgendaState,
})
export type SharePushResult = z.infer<typeof SharePushResult>

/** An item as the public page shows it: no lock, no ids of people, outcomes only with a shared recap. */
export const PublicItem = z.object({
  id: z.string(),
  text: z.string(),
  kind: AgendaItemKind,
  owner: z.string().nullable(),
  timeboxMin: z.int().nullable(),
  status: AgendaItemStatus,
  outcome: z.string().nullable(),
  auto: z.boolean(),
  /** Display label of who set the status (a name or a masked email). */
  changedBy: z.string(),
  addedBy: z.string(),
  /** Added through the page (an invitee) or by another attendee's device. */
  contributed: z.boolean(),
  carriedOver: z.boolean(),
})
export type PublicItem = z.infer<typeof PublicItem>

export const PublicComment = z.object({
  id: z.string(),
  itemId: z.string().nullable(),
  author: z.string(),
  text: z.string(),
  at: Iso,
  mine: z.boolean(),
})
export type PublicComment = z.infer<typeof PublicComment>

/** What `https://<host>/a/<token>` shows. */
export const SharedAgendaPage = z.object({
  title: z.string(),
  ownerName: z.string(),
  occurrence: ShareOccurrence,
  occurrences: z.array(
    ShareOccurrence.pick({ agendaId: true, title: true, meeting: true, recapShared: true }),
  ),
  current: z.string(),
  items: z.array(PublicItem),
  cards: z.array(SharedCard.pick({ id: true, title: true, body: true, pinned: true, sourceUrl: true })),
  comments: z.array(PublicComment),
  /** Invitees may add items and comments (the owner allows it and the server can send email). */
  contributions: z.boolean(),
  you: z
    .object({ email: z.string(), name: z.string().nullable(), role: z.enum(['member', 'invitee']) })
    .nullable(),
})
export type SharedAgendaPage = z.infer<typeof SharedAgendaPage>

// ------------------------------------------------------------------------------- route bodies

/** The header a participant's token travels in (not `authorization`: that is pairing's). */
export const PARTICIPANT_HEADER = 'x-kacola-participant'

export const CreateShareBody = z.strictObject({
  ownerName: z.string().trim().min(1).max(100),
  ownerLabel: PeerLabel,
  options: ShareOptions,
  occurrence: OccurrenceInput,
})
export const CreateShareResult = z.object({
  share: Share,
  /** The link secret (`https://<host>/a/<token>`). Shown once; the server keeps only its hash. */
  token: z.string(),
})
export type CreateShareResult = z.infer<typeof CreateShareResult>

export const UpdateShareBody = z.strictObject({
  ownerName: z.string().trim().min(1).max(100).optional(),
  ownerLabel: PeerLabel.optional(),
  options: ShareOptions.optional(),
})

export const ShareVerifyBody = z.strictObject({
  email: Email,
  name: z.string().trim().min(1).max(100).optional(),
})
export const ShareVerifyResult = z.object({
  /** Always true (whether or not the address could join), so the endpoint reveals nothing. */
  sent: z.literal(true),
  expiresAt: Iso,
})

export const ShareConfirmBody = z.strictObject({
  email: Email,
  code: z.string().trim().min(4).max(64),
})
export const ShareConfirmResult = z.object({
  shareId: z.string(),
  participant: ShareParticipant,
  /** Present it in PARTICIPANT_HEADER. Shown once. */
  token: z.string(),
})
export type ShareConfirmResult = z.infer<typeof ShareConfirmResult>

export const ShareAddItemBody = z.strictObject({
  text: ItemText,
  kind: z.enum(['topic', 'question']).default('topic'),
})
export const ShareAddCommentBody = z.strictObject({
  itemId: z.string().min(1).max(100).nullable().optional(),
  text: z.string().trim().min(1).max(MAX_COMMENT_CHARS),
})

const linkParams = { query: z.object({ occurrence: z.string().max(100).optional() }) }

// ---------------------------------------------------------------- the daemon side (the window)

export const ShareSyncState = z.enum([
  /** Not shared / not following. */
  'off',
  'ok',
  /** A sync is under way, or changes are waiting to be pushed. */
  'syncing',
  /** The last sync failed (the host is unreachable, the token was refused, …): `error` says why. */
  'error',
  /** The owner unshared it (a member's view) or the share was revoked: the local copy is kept, detached. */
  'revoked',
])
export type ShareSyncState = z.infer<typeof ShareSyncState>

/** What the window shows for an agenda's sharing (GET /agendas/:id/share). */
export const ShareStatus = z.object({
  agendaId: z.string(),
  shared: z.boolean(),
  role: z.enum(['owner', 'member']).nullable(),
  shareId: z.string().nullable(),
  /** `https://<host>/a/<token>`: what the invitation and the copy button carry. */
  link: z.string().nullable(),
  host: z.string().nullable(),
  ownerName: z.string().nullable(),
  /** Owner: goals are shared too (off by default). */
  shareGoals: z.boolean(),
  allowInvitees: z.boolean(),
  members: z.array(z.string()),
  /** This occurrence's recap (outcomes) is shared. */
  recapShared: z.boolean(),
  state: ShareSyncState,
  error: z.string().nullable(),
  lastSyncAt: Iso.nullable(),
  /** Local status changes not yet pushed. */
  pending: z.int().nonnegative(),
  /** Changes of this occurrence the merge refused or superseded (see the history). */
  refused: z.int().nonnegative(),
  /** Invitee and member contributions visible in the app. */
  comments: z.array(SharedComment),
  participants: z.array(ShareParticipant),
})
export type ShareStatus = z.infer<typeof ShareStatus>

export const ShareAgendaBody = z.strictObject({
  /** How the owner appears to invitees. Default: the configured name, else "Organizer". */
  ownerName: z.string().trim().min(1).max(100).optional(),
  /** Share the goals as well (off by default: goals are often personal). */
  shareGoals: z.boolean().optional(),
  /** Let invitees add items and comments (default true). */
  allowInvitees: z.boolean().optional(),
  /** Attendee emails whose kacola may follow and write statuses. Default: the calendar attendees, if known. */
  members: z.array(Email).max(100).optional(),
})

export const FollowAgendaBody = z.strictObject({
  /** `https://<host>/a/<token>`. */
  link: z.string().url().max(2000),
  email: Email,
  name: z.string().trim().min(1).max(100).optional(),
})
export const ConfirmFollowBody = z.strictObject({
  link: z.string().url().max(2000),
  email: Email,
  code: z.string().trim().min(4).max(64),
})

/** Parse `https://<host>/a/<token>` into the host's base URL and the token. */
export function parseShareLink(link: string): { base: string; token: string } | null {
  let u: URL
  try {
    u = new URL(link)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const m = /^(.*)\/a\/([A-Za-z0-9_-]{16,128})\/?$/.exec(u.pathname)
  if (!m) return null
  return { base: `${u.origin}${m[1]}`, token: m[2]! }
}

export const formatShareLink = (base: string, token: string): string =>
  `${base.replace(/\/+$/, '')}/a/${token}`

// ------------------------------------------------------------------------------------- routes

export const sharingRoutes = {
  // ---- hosted server: the owner's device (pairing token) or a member's daemon (participant token)
  createShare: { method: 'POST', path: '/shared', body: CreateShareBody, response: CreateShareResult },
  updateShare: { method: 'PATCH', path: '/shared/:shareId', body: UpdateShareBody, response: Share },
  /** Owner: unshare. Everything but a tombstone is deleted; the link answers 410. */
  revokeShare: {
    method: 'DELETE',
    path: '/shared/:shareId',
    response: z.object({ revoked: z.literal(true) }),
  },
  pushShare: {
    method: 'POST',
    path: '/shared/:shareId/push',
    body: SharePushBody,
    response: SharePushResult,
  },
  getShareState: { method: 'GET', path: '/shared/:shareId/state', response: SharedAgendaState },
  /** The merge history: every submitted status change with its outcome, oldest first. */
  listShareChanges: {
    method: 'GET',
    path: '/shared/:shareId/changes',
    query: z.object({ occurrence: z.string().max(100).optional() }),
    response: z.object({ changes: z.array(SharedChange) }),
  },
  revokeShareParticipant: {
    method: 'POST',
    path: '/shared/:shareId/participants/:participantId/revoke',
    response: ShareParticipant,
  },
  hideShareComment: {
    method: 'POST',
    path: '/shared/:shareId/comments/:commentId/hide',
    response: SharedComment,
  },
  // ---- hosted server: anyone with the link (the web page). Rate-limited; contributions need a
  // verified email (PARTICIPANT_HEADER).
  getSharedPage: { method: 'GET', path: '/shared/link/:token', ...linkParams, response: SharedAgendaPage },
  shareVerify: {
    method: 'POST',
    path: '/shared/link/:token/verify',
    body: ShareVerifyBody,
    response: ShareVerifyResult,
  },
  shareConfirm: {
    method: 'POST',
    path: '/shared/link/:token/confirm',
    body: ShareConfirmBody,
    response: ShareConfirmResult,
  },
  shareAddItem: {
    method: 'POST',
    path: '/shared/link/:token/items',
    body: ShareAddItemBody,
    response: PublicItem,
  },
  shareAddComment: {
    method: 'POST',
    path: '/shared/link/:token/comments',
    body: ShareAddCommentBody,
    response: PublicComment,
  },
  // ---- the local daemon (the window): share, follow, status, history
  getAgendaShare: { method: 'GET', path: '/agendas/:id/share', response: ShareStatus },
  /** Owner: share (or update the sharing of) an agenda on the configured host. */
  shareAgenda: { method: 'PUT', path: '/agendas/:id/share', body: ShareAgendaBody, response: ShareStatus },
  /** Owner: unshare (revoke the link). Member: stop following (the local copy stays). */
  unshareAgenda: { method: 'DELETE', path: '/agendas/:id/share', response: ShareStatus },
  /** Owner: share this occurrence's recap (outcomes), or stop sharing it. */
  shareAgendaRecap: {
    method: 'PUT',
    path: '/agendas/:id/share/recap',
    body: z.strictObject({ shared: z.boolean() }),
    response: ShareStatus,
  },
  /** Push and pull now. */
  syncAgendaShare: { method: 'POST', path: '/agendas/:id/share/sync', response: ShareStatus },
  getAgendaShareHistory: {
    method: 'GET',
    path: '/agendas/:id/share/history',
    response: z.object({ changes: z.array(SharedChange) }),
  },
  /** Member: ask to follow a shared agenda (the host emails a code to `email`). */
  followAgenda: {
    method: 'POST',
    path: '/agendas/follow',
    body: FollowAgendaBody,
    response: z.object({ pending: z.literal(true), expiresAt: Iso }),
  },
  /** Member: the emailed code → the local copy of the agenda, following the share. */
  confirmFollowAgenda: {
    method: 'POST',
    path: '/agendas/follow/confirm',
    body: ConfirmFollowBody,
    response: ShareStatus,
  },
} as const

/** Ephemeral: an agenda's sharing changed (synced, failed, revoked): refetch GET /agendas/:id/share. */
export const SharingEphemeralEvents = [
  z.object({ type: z.literal('agenda.share'), agendaId: z.string(), status: ShareStatus }),
] as const
