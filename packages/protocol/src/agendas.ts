import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { Meeting } from './calendar.ts'
import { Iso } from './schemas.ts'

export * from './agendas-links.ts'
export * from './agendas-markdown.ts'

// Agendas (kacola phases 1–2) — the plan for a meeting, and what became of it.
//
// One agenda per calendar OCCURRENCE: a recurring series has one agenda per instance, and a new instance
// is seeded with the previous instance's unresolved items (carry-over). An agenda is linked to its
// meeting by the iCalendar UID and the occurrence (never by our own meeting id alone: the UID is what a
// `kacola://meeting/<uid>` deep link and an invitation carry), and to the recorded session once
// recording starts. Everything is event-sourced like the rest of the store; the rules:
//
//   - items move forward only: open → in-progress → covered | skipped | parked. The user (the owner)
//     may move an item anywhere — that is recorded as an override — and an automated changer (the live
//     tracker, a connected agent, an invitee) may then not undo the user's override ("manual wins").
//   - every status change carries who made it (`changedBy`) and lands in the item's history.
//   - an agenda linked to a PRIVATE session, or marked private itself, is invisible to the CLI, the
//     skill and MCP unless includePrivate (the window passes it), exactly like the session.
//   - context cards are private by default; sharing one is an explicit choice (`visibility: shared`).
//   - suggestions (from the tracker or an agent) never change an item by themselves: accepting one does.

// ------------------------------------------------------------------------------------------ ids

export type AgendaIdKind = 'agd' | 'itm' | 'ctx' | 'sug' | 'lse'

/** Same shape as newId (./ids.ts): time-prefixed, so lexicographic order == creation order. */
export function newAgendaId(kind: AgendaIdKind, now: number = Date.now()): string {
  return `${kind}_${now.toString(36).padStart(9, '0')}${randomBytes(6).toString('hex')}`
}

// ------------------------------------------------------------------------------------ primitives

export const AgendaItemKind = z.enum([
  /** Something to talk about. The default. */
  'topic',
  /** A question the user wants to ask. */
  'question',
  /** Must be covered before the meeting ends (the T-5 min nudge lists these first). */
  'must-cover',
  /** A decision to reach. */
  'decision',
  /** Information to GET from the other side (interviews: the answer heard is the outcome). */
  'info-to-get',
  /** A competency to assess (the interviewer's side). */
  'competency',
])
export type AgendaItemKind = z.infer<typeof AgendaItemKind>

export const AgendaItemStatus = z.enum(['open', 'in-progress', 'covered', 'skipped', 'parked'])
export type AgendaItemStatus = z.infer<typeof AgendaItemStatus>

/** Terminal statuses: an item in one is resolved (and is not carried over to the next occurrence). */
export const RESOLVED_STATUSES: readonly AgendaItemStatus[] = ['covered', 'skipped']
/** `parked` is terminal for THIS meeting but deliberately unresolved: it rolls to the next occurrence. */
export const TERMINAL_STATUSES: readonly AgendaItemStatus[] = ['covered', 'skipped', 'parked']

export const statusRank = (s: AgendaItemStatus): number => (s === 'open' ? 0 : s === 'in-progress' ? 1 : 2)

/** A move that follows the forward-only rule (anything else is an override, which only the user may make). */
export const isForwardMove = (from: AgendaItemStatus, to: AgendaItemStatus): boolean =>
  statusRank(to) > statusRank(from)

/**
 * Who changed something. `user` is the owner (the window, the CLI, their own Claude acting through the
 * CLI); `tracker` is the daemon's live tracker; `agent:<name>` a connected agent holding a lease;
 * `invitee:<email>` someone without kacola, through the shared web page.
 */
export const ChangedBy = z
  .string()
  .regex(/^(user|tracker|agent:[A-Za-z0-9._-]{1,64}|invitee:[^\s@]{1,64}@[^\s@]{1,190})$/, {
    message: 'changedBy must be user, tracker, agent:<name> or invitee:<email>',
  })
export type ChangedBy = z.infer<typeof ChangedBy>
export const isAutomated = (by: string): boolean => by === 'tracker' || by.startsWith('agent:')

/** An item owner: `me`, `them`, or a name. Kept free of the characters the markdown form uses. */
export const ItemOwner = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\n",()[\]]+$/, { message: 'an owner cannot contain newlines, quotes, commas, () or []' })

/** Item text: one line (whitespace runs collapse), 1–500 chars. */
export const ItemText = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(500))

export const MAX_TIMEBOX_MIN = 480

/** Why an item's status is what it is: a transcript segment and the words that settled it. */
export const Evidence = z.object({
  /** null for evidence typed by a person ("--evidence 'agreed on the call'"). */
  segmentId: z.string().nullable(),
  quote: z.string().max(500),
  confidence: z.number().min(0).max(1).nullable(),
})
export type Evidence = z.infer<typeof Evidence>

export const StatusChange = z.object({
  itemId: z.string(),
  from: AgendaItemStatus,
  to: AgendaItemStatus,
  by: ChangedBy,
  at: Iso,
  note: z.string().max(2000).nullable(),
  evidence: z.array(Evidence).max(20),
  /** A move against the forward-only rule — only the user makes these. */
  override: z.boolean(),
  /** Made automatically (the tracker's auto check-off at high confidence): shown as such, one-click undo. */
  auto: z.boolean(),
  confidence: z.number().min(0).max(1).nullable(),
})
export type StatusChange = z.infer<typeof StatusChange>

// ------------------------------------------------------------------------------------ entities

/** Which calendar occurrence an agenda is for. Durable: survives the calendar changing or vanishing. */
export const AgendaMeeting = z.object({
  /** iCalendar UID (shared by every occurrence of a series). */
  eventUid: z.string().min(1),
  /** The occurrence's start when the agenda was linked (updated when the calendar moves it). */
  start: Iso,
  end: Iso.nullable(),
  /** RECURRENCE-ID of the occurrence (stable when a single instance is moved), null for one-offs. */
  recurrenceId: Iso.nullable(),
  /** The daemon's per-occurrence meeting id (`mtg_…`), when the calendar knew it. */
  meetingId: z.string().nullable(),
  title: z.string(),
  calendar: z.string().nullable(),
  recurring: z.boolean(),
})
export type AgendaMeeting = z.infer<typeof AgendaMeeting>

export const Agenda = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  meeting: AgendaMeeting.nullable(),
  /** The recorded session, once recording starts for this meeting. */
  sessionId: z.string().nullable(),
  /** Who owns it: `me` locally; a shared agenda's owner is still the person who made it. */
  owner: z.string().min(1).max(200),
  goals: z.array(z.string().min(1).max(500)).max(20),
  /** Hidden from the agent surfaces unless includePrivate (also hidden when the linked session is private). */
  private: z.boolean(),
  /** The agenda of the previous occurrence this one was seeded from (carry-over), if any. */
  carriedFrom: z.string().nullable(),
  /** Bumped by every change to the agenda, its items or its context cards: optimistic concurrency. */
  version: z.int().positive(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type Agenda = z.infer<typeof Agenda>

export const AgendaItem = z.object({
  id: z.string(),
  agendaId: z.string(),
  text: ItemText,
  kind: AgendaItemKind,
  owner: ItemOwner.nullable(),
  timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable(),
  /** 0-based position in the agenda. */
  order: z.int().nonnegative(),
  status: AgendaItemStatus,
  /** Evidence behind the current status (the latest change's, accumulated while in progress). */
  evidence: z.array(Evidence).max(20),
  /** What came of it; for `info-to-get`, the answer heard. */
  outcome: z.string().max(4000).nullable(),
  /** Who made the latest change to it (text or status). */
  changedBy: ChangedBy,
  createdBy: ChangedBy,
  /** The item of the previous occurrence this one was carried over from. */
  carriedFrom: z.object({ agendaId: z.string(), itemId: z.string() }).nullable(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type AgendaItem = z.infer<typeof AgendaItem>

export const ContextSource = z.object({
  kind: z.enum(['user', 'path', 'url', 'session', 'agent']),
  /** The path, URL, session id or agent name; null for `user`. */
  ref: z.string().max(2000).nullable(),
})
export type ContextSource = z.infer<typeof ContextSource>

export const MAX_CONTEXT_CHARS = 20_000

export const ContextCard = z.object({
  id: z.string(),
  agendaId: z.string(),
  title: z.string().trim().min(1).max(200),
  /** Markdown. */
  body: z.string().max(MAX_CONTEXT_CHARS),
  source: ContextSource,
  /** Private by default: never shown to invitees or other people's agents unless shared on purpose. */
  visibility: z.enum(['private', 'shared']),
  pinned: z.boolean(),
  createdBy: ChangedBy,
  createdAt: Iso,
  updatedAt: Iso,
})
export type ContextCard = z.infer<typeof ContextCard>

export const SuggestionKind = z.enum([
  'next-point',
  'question',
  'missed',
  'fact-check',
  'looks-covered',
  // ---- agent channel: what a `suggest`-mode agent's writes become (they carry a `proposal`)
  /** A status change the agent proposes; accepting applies it as the user. */
  'set-status',
  /** A new item the agent proposes; accepting adds it as the user. */
  'add-item',
])
export type SuggestionKind = z.infer<typeof SuggestionKind>

/** Suggestions come from the tracker or an agent — never from the user, who simply acts. */
export const SuggestionSource = ChangedBy.refine((s) => isAutomated(s), {
  message: 'a suggestion comes from tracker or agent:<name>',
})

/**
 * What accepting a suggestion does beyond resolving it (agent channel): a `suggest`-mode agent's status
 * change or new item is held here until the user accepts it. Applied as the acceptor.
 */
export const SuggestionProposal = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('status'),
    status: AgendaItemStatus,
    evidence: z.array(Evidence).max(20),
    note: z.string().max(2000).nullable(),
    outcome: z.string().max(4000).nullable(),
  }),
  z.object({
    kind: z.literal('add-item'),
    item: z.object({
      text: ItemText,
      kind: AgendaItemKind,
      owner: ItemOwner.nullable(),
      timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable(),
    }),
  }),
])
export type SuggestionProposal = z.infer<typeof SuggestionProposal>

export const Suggestion = z.object({
  id: z.string(),
  agendaId: z.string(),
  kind: SuggestionKind,
  text: z.string().trim().min(1).max(1000),
  itemId: z.string().nullable(),
  source: SuggestionSource,
  createdAt: Iso,
  /** After this a still-open suggestion is stale: clients hide it. */
  expiresAt: Iso.nullable(),
  state: z.enum(['open', 'accepted', 'dismissed']),
  resolvedAt: Iso.nullable(),
  resolvedBy: ChangedBy.nullable(),
  /** Agent channel: the change accepting this applies. Absent on suggestions from before it existed. */
  proposal: SuggestionProposal.nullable().optional(),
})
export type Suggestion = z.infer<typeof Suggestion>

/** Everything about one agenda a client shows. `history` is fetched separately (getAgendaHistory). */
export const AgendaView = z.object({
  agenda: Agenda,
  items: z.array(AgendaItem),
  context: z.array(ContextCard),
  suggestions: z.array(Suggestion),
})
export type AgendaView = z.infer<typeof AgendaView>

export const AgendaCounts = z.object({
  items: z.int().nonnegative(),
  open: z.int().nonnegative(),
  inProgress: z.int().nonnegative(),
  covered: z.int().nonnegative(),
  skipped: z.int().nonnegative(),
  parked: z.int().nonnegative(),
})
export type AgendaCounts = z.infer<typeof AgendaCounts>

export const AgendaSummary = Agenda.extend({ counts: AgendaCounts })
export type AgendaSummary = z.infer<typeof AgendaSummary>

// ------------------------------------------------------------------------ agents (live channel)
//
// Defined here so the whole contract is in one place; the daemon's handlers for the lease and
// live-attach routes belong to the agent-channel wave (they answer 501 until then).

export const AgentMode = z.enum([
  /** Read the live meeting only. */
  'observe',
  /** …and post suggestions and context cards. */
  'suggest',
  /** …and change item statuses (as `agent:<name>`, forward-only, never over the user's override). */
  'act',
])
export type AgentMode = z.infer<typeof AgentMode>

export const AgentName = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/)

/** A connected agent's right to one session's live channel. The token is shown once, at creation. */
export const AgentLease = z.object({
  id: z.string(),
  sessionId: z.string(),
  agendaId: z.string().nullable(),
  name: AgentName,
  mode: AgentMode,
  createdAt: Iso,
  /** The meeting's end (or a default window when there is no meeting); renewed by heartbeats until then. */
  expiresAt: Iso,
  heartbeatAt: Iso,
})
export type AgentLease = z.infer<typeof AgentLease>

export const CreateLeaseBody = z.object({ name: AgentName, mode: AgentMode.default('suggest') })
export const LeaseGrant = z.object({
  lease: AgentLease,
  /** Bearer token scoped to this session's live routes; expires with the lease. */
  token: z.string(),
})
export type LeaseGrant = z.infer<typeof LeaseGrant>

/** Presence of a connected agent, as the window shows it (ephemeral; derived by the daemon). */
export const AgentPresenceState = z.enum(['connected', 'reading', 'idle', 'disconnected'])
export type AgentPresenceState = z.infer<typeof AgentPresenceState>

/** The header an agent presents its lease token in (not `authorization`: that is pairing's). */
export const LEASE_HEADER = 'x-gnomeola-lease'

/** Why a lease stopped. */
export const LeaseEndReason = z.enum([
  /** The agent let go (DELETE with its own token). */
  'released',
  /** The user disconnected it (DELETE without a token: the window's Disconnect). */
  'revoked',
  /** No heartbeat in time, or past the meeting's end. */
  'expired',
  /** A new lease with the same name on the same session replaced it (an agent reconnecting). */
  'superseded',
  /** The recording stopped. */
  'meeting-ended',
  /** The session became private, or the user withdrew agent access to a private session. */
  'access-withdrawn',
])
export type LeaseEndReason = z.infer<typeof LeaseEndReason>

/** One thing a connected agent did (or tried): the window's per-lease activity list. In memory, per run;
 *  the durable record is the agenda events themselves, attributed `agent:<name>`. */
export const AgentAction = z.object({
  at: Iso,
  kind: z.enum(['status', 'suggestion', 'add-item', 'context', 'edit-item']),
  outcome: z.enum(['applied', 'suggested', 'refused']),
  summary: z.string().max(300),
  /** The item, suggestion or card id it touched (null when refused before there was one). */
  ref: z.string().nullable(),
})
export type AgentAction = z.infer<typeof AgentAction>

export const LeaseInfo = AgentLease.extend({
  state: AgentPresenceState,
  endedAt: Iso.nullable(),
  endReason: LeaseEndReason.nullable(),
  counts: z.object({
    statusChanges: z.int().nonnegative(),
    suggestions: z.int().nonnegative(),
    items: z.int().nonnegative(),
    context: z.int().nonnegative(),
    refused: z.int().nonnegative(),
  }),
  /** Oldest first, the latest 50. */
  actions: z.array(AgentAction),
})
export type LeaseInfo = z.infer<typeof LeaseInfo>

export const HeartbeatBody = z.object({
  /** Optional hint from the agent; the daemon otherwise derives reading/idle from what it streams. */
  state: z.enum(['reading', 'idle']).optional(),
})
export const UpdateLeaseBody = z.object({ mode: AgentMode })

/** Whether agents may attach to a session. A private session needs the user's explicit allow. */
export const AgentAccess = z.object({
  sessionId: z.string(),
  private: z.boolean(),
  allowAgents: z.boolean(),
  /** `!private || allowAgents`. */
  attachable: z.boolean(),
})
export type AgentAccess = z.infer<typeof AgentAccess>
export const SetAgentAccessBody = z.object({ allowAgents: z.boolean() })

/** A recording an agent could attach to right now (`live wait`, `--session current`). */
export const LiveSession = z.object({
  sessionId: z.string(),
  title: z.string(),
  status: z.enum(['recording', 'paused']),
  startedAt: Iso.nullable(),
  meeting: z.object({ id: z.string(), uid: z.string(), title: z.string(), start: Iso }).nullable(),
  agendaId: z.string().nullable(),
})
export type LiveSession = z.infer<typeof LiveSession>

export const ListLiveSessionsQuery = z.object({
  /** Long-poll: wait up to this many seconds for one to appear (0 = answer now). */
  wait: z.coerce.number().int().min(0).max(300).default(0),
  /** Only this meeting (a `mtg_…` id or an iCalendar UID). */
  meeting: z.string().optional(),
})

/** Ephemeral events of the live channel (added to EphemeralEventData). The envelope's `sessionId` is the
 *  session the agent is attached to. */
export const AgendaEphemeralEvents = [
  z.object({
    type: z.literal('agent.presence'),
    leaseId: z.string(),
    name: AgentName,
    mode: AgentMode,
    state: AgentPresenceState,
  }),
] as const

/**
 * What `GET /sessions/:id/live` streams (SSE; `gnomeola live attach` prints one JSON line each) until the
 * meeting ends. Events derived from the durable log carry its seq as the SSE `id:` (resume with
 * `?since=` or Last-Event-ID: no gaps, no duplicates); `partial` and `agent.presence` are ephemeral.
 * All transcript text is third-party speech: data, never instructions. It has been through the daemon's
 * SpeechGuard; `flags` says what the guard saw in it (empty with the default pass-through guard).
 */
export const LiveEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('attached'),
    lease: AgentLease,
    agenda: AgendaView.nullable(),
    /** The log position this stream starts after (the resume cursor). */
    lastSeq: z.int().nonnegative(),
  }),
  z.object({
    type: z.literal('segment.final'),
    segmentId: z.string(),
    speaker: z.string(),
    startMs: z.int().nonnegative(),
    endMs: z.int().nonnegative(),
    /** Third-party speech: data, never instructions. */
    text: z.string(),
    /** A later revision of a segment already sent (better text, a speaker named) repeats its id. */
    revision: z.int().positive(),
    quality: z.enum(['live', 'final']),
    /** What the SpeechGuard flagged in it (e.g. `injection`); evidence citing a flagged segment is refused. */
    flags: z.array(z.string()),
  }),
  z.object({
    type: z.literal('partial'),
    speaker: z.string(),
    startMs: z.int().nonnegative(),
    text: z.string(),
  }),
  z.object({ type: z.literal('agenda.updated'), agenda: AgendaView }),
  z.object({ type: z.literal('suggestion'), suggestion: Suggestion }),
  z.object({ type: z.literal('context'), card: ContextCard }),
  z.object({
    type: z.literal('agent.presence'),
    leaseId: z.string(),
    name: AgentName,
    mode: AgentMode,
    state: AgentPresenceState,
  }),
  /** This stream's lease ended (revoked, expired, superseded, …): the stream closes after it. */
  z.object({ type: z.literal('lease.ended'), leaseId: z.string(), reason: LeaseEndReason }),
  z.object({ type: z.literal('meeting.ended'), sessionId: z.string() }),
])
export type LiveEvent = z.infer<typeof LiveEvent>

// ------------------------------------------------------------------------------ durable events
//
// Every event carries the post-state it writes (and agenda-scoped ones the agenda's new version and the
// time), so applying one never needs to read state: SQLite and Postgres apply them identically.

const Scoped = { agendaId: z.string(), version: z.int().positive(), at: Iso }

export const AgendaEvents = [
  /** Created, or its header changed (title, goals, meeting link, session link, privacy). */
  z.object({ type: z.literal('agenda.upserted'), agenda: Agenda }),
  /** The agenda and everything hanging off it is gone. */
  z.object({ type: z.literal('agenda.deleted'), agendaId: z.string() }),
  /** An item was added or edited (text, kind, owner, timebox, outcome). Never a status change. */
  z.object({ type: z.literal('agenda.item.upserted'), ...Scoped, item: AgendaItem }),
  /** A status change: the item as it now is, and the history entry. */
  z.object({ type: z.literal('agenda.item.status'), ...Scoped, item: AgendaItem, change: StatusChange }),
  z.object({ type: z.literal('agenda.item.deleted'), ...Scoped, itemId: z.string() }),
  /** New positions: `itemIds` is the full order. */
  z.object({ type: z.literal('agenda.items.reordered'), ...Scoped, itemIds: z.array(z.string()) }),
  z.object({ type: z.literal('agenda.context.upserted'), ...Scoped, card: ContextCard }),
  z.object({ type: z.literal('agenda.context.deleted'), ...Scoped, cardId: z.string() }),
  /** Created or resolved. Suggestions do not bump the agenda's version (they are not part of the plan). */
  z.object({ type: z.literal('agenda.suggestion.upserted'), agendaId: z.string(), suggestion: Suggestion }),
] as const

// ------------------------------------------------------------------------------------- routes

const qbool = z.union([z.boolean(), z.stringbool()])
const includePrivate = qbool.optional()

/** A new item as a client describes it. */
export const NewAgendaItem = z.object({
  text: ItemText,
  kind: AgendaItemKind.default('topic'),
  owner: ItemOwner.nullable().optional(),
  timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable().optional(),
  status: AgendaItemStatus.optional(),
  outcome: z.string().max(4000).nullable().optional(),
})
export type NewAgendaItem = z.input<typeof NewAgendaItem>

export const CreateAgendaBody = z
  .object({
    /** A calendar occurrence by the daemon's meeting id (`mtg_…`, from /meetings)… */
    meetingId: z.string().optional(),
    /** …or by iCalendar UID (+ occurrence start; without it: the current/next occurrence). */
    eventUid: z.string().optional(),
    start: Iso.optional(),
    /** Default: the meeting's title. Required when there is no meeting. */
    title: z.string().trim().min(1).max(200).optional(),
    goals: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    items: z.array(NewAgendaItem).max(200).optional(),
    /** An agenda in the markdown form (see agendas-markdown.ts); its title/goals/items fill what is unset. */
    markdown: z.string().max(100_000).optional(),
    private: z.boolean().optional(),
    /** Seed with the previous occurrence's unresolved items (recurring meetings). Default true. */
    carryOver: z.boolean().optional(),
    /** What to do when the occurrence already has an agenda: 409 (default) or hand back that one. */
    ifExists: z.enum(['fail', 'reuse']).optional(),
    by: ChangedBy.optional(),
  })
  .refine((b) => !(b.meetingId && b.eventUid), { message: 'pass meetingId or eventUid, not both' })
export type CreateAgendaBody = z.input<typeof CreateAgendaBody>

export const ListAgendasQuery = z.object({
  /** Only agendas for this calendar event (every occurrence). */
  eventUid: z.string().optional(),
  sessionId: z.string().optional(),
  /** Updated since: ISO or a duration like `7d`. */
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  includePrivate,
})

export const UpdateAgendaBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  goals: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  private: z.boolean().optional(),
  /** Relink to a calendar occurrence (same forms as CreateAgendaBody). null unlinks. */
  meetingId: z.string().nullable().optional(),
  eventUid: z.string().optional(),
  start: Iso.optional(),
  baseVersion: z.int().positive().optional(),
})

export const AddItemsBody = z.object({
  items: z.array(NewAgendaItem).min(1).max(100),
  /** Insert before this item; default at the end. */
  before: z.string().optional(),
  by: ChangedBy.optional(),
})

export const UpdateItemBody = z.object({
  text: ItemText.optional(),
  kind: AgendaItemKind.optional(),
  owner: ItemOwner.nullable().optional(),
  timeboxMin: z.int().min(1).max(MAX_TIMEBOX_MIN).nullable().optional(),
  outcome: z.string().max(4000).nullable().optional(),
  by: ChangedBy.optional(),
})

export const SetItemStatusBody = z.object({
  status: AgendaItemStatus,
  by: ChangedBy.optional(),
  evidence: z.array(Evidence).max(20).optional(),
  note: z.string().max(2000).optional(),
  /** Set the outcome in the same change (e.g. the answer heard for an info-to-get item). */
  outcome: z.string().max(4000).optional(),
  auto: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export const ReorderItemsBody = z.object({ itemIds: z.array(z.string()).min(1).max(500) })

export const ImportMarkdownBody = z.object({
  markdown: z.string().max(100_000),
  /** The version the markdown was exported from: a different current version is a 409. */
  baseVersion: z.int().positive(),
  /** `replace` (default): the markdown is the whole agenda — items absent from it are deleted. `merge`:
   *  only add and update. */
  mode: z.enum(['replace', 'merge']).optional(),
})

export const AddContextBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_CONTEXT_CHARS),
  source: ContextSource.optional(),
  visibility: z.enum(['private', 'shared']).optional(),
  pinned: z.boolean().optional(),
  by: ChangedBy.optional(),
})
export const UpdateContextBody = AddContextBody.partial()

export const AddSuggestionBody = z.object({
  kind: SuggestionKind,
  text: z.string().trim().min(1).max(1000),
  itemId: z.string().optional(),
  source: SuggestionSource,
  /** Seconds until it goes stale. */
  ttlSec: z.int().min(10).max(86_400).optional(),
})
export const ResolveSuggestionBody = z.object({ by: ChangedBy.optional() })
export const ResolveSuggestionResult = z.object({ suggestion: Suggestion, item: AgendaItem.nullable() })

/** `kacola://agenda/<id>` or `kacola://meeting/<uid>?start=…`, or the parts. */
export const ResolveLinkBody = z.object({
  link: z.string().max(4000).optional(),
  eventUid: z.string().optional(),
  start: Iso.optional(),
  /** Create the agenda when the meeting is known but has none. */
  create: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
})
export const ResolvedLink = z.object({
  agenda: AgendaView.nullable(),
  meeting: Meeting.nullable(),
  /** The meeting is in progress right now (the app offers Join and record). */
  live: z.boolean(),
  created: z.boolean(),
})
export type ResolvedLink = z.infer<typeof ResolvedLink>

export const InviteBlockBody = z.object({
  /** Write the block into the calendar event's description (opt-in). Default: only return it. */
  write: z.boolean().optional(),
  /** Remove our block from the event instead. */
  remove: z.boolean().optional(),
})
export const InviteBlockResult = z.object({
  block: z.string(),
  appLink: z.string(),
  webLink: z.string().nullable(),
  written: z.boolean(),
  /** Why it was not written (read-only calendar, not the organiser, a provider that cannot write, …). */
  reason: z.string().nullable(),
})
export type InviteBlockResult = z.infer<typeof InviteBlockResult>

const view = { query: z.object({ includePrivate }) }

export const agendaRoutes = {
  listAgendas: {
    method: 'GET',
    path: '/agendas',
    query: ListAgendasQuery,
    response: z.object({ agendas: z.array(AgendaSummary) }),
  },
  createAgenda: { method: 'POST', path: '/agendas', body: CreateAgendaBody, response: AgendaView },
  /** Deep-link resolution (`resolveMeetingLink`): what a `kacola://` link opens. */
  resolveAgendaLink: {
    method: 'POST',
    path: '/agendas/resolve',
    body: ResolveLinkBody,
    response: ResolvedLink,
  },
  getAgenda: { method: 'GET', path: '/agendas/:id', ...view, response: AgendaView },
  updateAgenda: { method: 'PATCH', path: '/agendas/:id', body: UpdateAgendaBody, response: Agenda },
  deleteAgenda: { method: 'DELETE', path: '/agendas/:id', response: z.object({ deleted: z.literal(true) }) },
  getAgendaHistory: {
    method: 'GET',
    path: '/agendas/:id/history',
    ...view,
    response: z.object({ changes: z.array(StatusChange) }),
  },
  addAgendaItems: {
    method: 'POST',
    path: '/agendas/:id/items',
    body: AddItemsBody,
    response: z.object({
      items: z.array(AgendaItem),
      version: z.int().positive(),
      /** A `suggest`-mode agent's items become suggestions instead (then `items` is empty). */
      suggestions: z.array(Suggestion).optional(),
    }),
  },
  updateAgendaItem: {
    method: 'PATCH',
    path: '/agendas/:id/items/:itemId',
    body: UpdateItemBody,
    response: AgendaItem,
  },
  deleteAgendaItem: {
    method: 'DELETE',
    path: '/agendas/:id/items/:itemId',
    response: z.object({ deleted: z.literal(true) }),
  },
  setAgendaItemStatus: {
    method: 'POST',
    path: '/agendas/:id/items/:itemId/status',
    body: SetItemStatusBody,
    response: z.object({
      item: AgendaItem,
      change: StatusChange.nullable(),
      /** A `suggest`-mode agent's change becomes this suggestion instead (then `change` is null). */
      suggestion: Suggestion.nullable().optional(),
    }),
  },
  reorderAgendaItems: {
    method: 'PUT',
    path: '/agendas/:id/order',
    body: ReorderItemsBody,
    response: z.object({ version: z.int().positive() }),
  },
  exportAgendaMarkdown: {
    method: 'GET',
    path: '/agendas/:id/markdown',
    ...view,
    response: z.object({ markdown: z.string(), version: z.int().positive() }),
  },
  importAgendaMarkdown: {
    method: 'PUT',
    path: '/agendas/:id/markdown',
    body: ImportMarkdownBody,
    response: AgendaView,
  },
  addContextCard: {
    method: 'POST',
    path: '/agendas/:id/context',
    body: AddContextBody,
    response: ContextCard,
  },
  updateContextCard: {
    method: 'PATCH',
    path: '/agendas/:id/context/:cardId',
    body: UpdateContextBody,
    response: ContextCard,
  },
  deleteContextCard: {
    method: 'DELETE',
    path: '/agendas/:id/context/:cardId',
    response: z.object({ deleted: z.literal(true) }),
  },
  addSuggestion: {
    method: 'POST',
    path: '/agendas/:id/suggestions',
    body: AddSuggestionBody,
    response: Suggestion,
  },
  acceptSuggestion: {
    method: 'POST',
    path: '/agendas/:id/suggestions/:suggestionId/accept',
    body: ResolveSuggestionBody,
    response: ResolveSuggestionResult,
  },
  dismissSuggestion: {
    method: 'POST',
    path: '/agendas/:id/suggestions/:suggestionId/dismiss',
    body: ResolveSuggestionBody,
    response: ResolveSuggestionResult,
  },
  /** The "Agenda: kacola://… · web: …" block for the invitation; optionally written into the event. */
  agendaInviteBlock: {
    method: 'POST',
    path: '/agendas/:id/invite',
    body: InviteBlockBody,
    response: InviteBlockResult,
  },
  // ---- the live channel (agent leases, live attach). Agent requests carry the lease token in the
  // LEASE_HEADER; owner routes (create, list, mode change, access) refuse a request that carries one.
  /** Owner: grant an agent a lease on one recording. */
  createAgentLease: {
    method: 'POST',
    path: '/sessions/:id/leases',
    body: CreateLeaseBody,
    response: LeaseGrant,
  },
  /** Owner: the session's leases (active; `includeEnded` adds the ones that ended this run). */
  listAgentLeases: {
    method: 'GET',
    path: '/sessions/:id/leases',
    query: z.object({ includeEnded: qbool.optional() }),
    response: z.object({ leases: z.array(LeaseInfo) }),
  },
  /** Agent (its own token): keep the lease alive. */
  heartbeatAgentLease: {
    method: 'POST',
    path: '/leases/:leaseId/heartbeat',
    body: HeartbeatBody,
    response: AgentLease,
  },
  /** Owner: change a lease's mode (an agent cannot change its own). */
  updateAgentLease: {
    method: 'PATCH',
    path: '/leases/:leaseId',
    body: UpdateLeaseBody,
    response: AgentLease,
  },
  /** Owner (the window's Disconnect: `revoked`) or the agent with its own token (`released`). */
  releaseAgentLease: {
    method: 'DELETE',
    path: '/leases/:leaseId',
    response: z.object({ released: z.literal(true) }),
  },
  /** LiveEvent messages as SSE until the meeting ends; requires this session's lease token. */
  liveAttach: {
    method: 'GET',
    path: '/sessions/:id/live',
    query: z.object({
      /** Resume after this seq (Last-Event-ID wins). Omitted: from now on. `0`: the whole meeting so far. */
      since: z.coerce.number().int().nonnegative().optional(),
      /** Stream throttled partials (default true). */
      partials: qbool.optional(),
    }),
    response: 'sse',
  },
  /** Recordings an agent may attach to now (not private, or private with agents allowed). */
  listLiveSessions: {
    method: 'GET',
    path: '/live/sessions',
    query: ListLiveSessionsQuery,
    response: z.object({ sessions: z.array(LiveSession) }),
  },
  getAgentAccess: { method: 'GET', path: '/sessions/:id/agent-access', response: AgentAccess },
  /** Owner: allow (or stop allowing) agents on a private session. Withdrawing revokes its leases. */
  setAgentAccess: {
    method: 'PUT',
    path: '/sessions/:id/agent-access',
    body: SetAgentAccessBody,
    response: AgentAccess,
  },
} as const
