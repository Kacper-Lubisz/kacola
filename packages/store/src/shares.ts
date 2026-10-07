import {
  type AgendaItemStatus,
  type DurableEventData,
  isForwardMove,
  type PublicComment,
  type PublicItem,
  publicActorLabel,
  type Share,
  type SharedActor,
  type SharedAgendaPage,
  type SharedAgendaState,
  type SharedCard,
  type SharedChange,
  type SharedComment,
  type SharedItem,
  type ShareOp,
  type ShareOptions,
  type ShareParticipant,
  type SharePushResult,
} from '@kacola/protocol'
import type { Op } from './agendas-apply.ts'
import { StoreError } from './errors.ts'
import type { CodeRecord, ShareState } from './shares-apply.ts'

// Team sharing — the hosted server's domain rules, as pure functions over one share's state (loaded by
// ./shares-apply.ts inside the writer's transaction). Each `plan*` returns the durable events to commit,
// the bookkeeping statements to run (hashed secrets, rate-limit counters) and the answer; it never
// touches a database, so both dialects run exactly the same rules.
//
// The merge rules for status changes from several devices (decideSharedStatus):
//
//   standing      the owner in person 3 · a member in person 2 · anyone's tracker or agent 1
//   lock          a person's backwards move (an override) locks the item at their standing; a forward
//                 move by a person clears it — the local "manual wins" rule, across devices
//   refused       a change from below the lock's standing; a backwards move by a tracker or agent
//   superseded    a person's override older (device time) than the status already applied: latest wins
//   agreed        the item already has that status
//   applied       otherwise
//
// Every submitted change is recorded with its outcome (share.change), applied or not.

export type SharePlan<R> = { events: DurableEventData[]; bookkeeping: Op[]; result: R }

/** Limits that keep a public link abuse-safe. */
export const SHARE_LIMITS = {
  codeTtlMs: 15 * 60_000,
  /** Magic-link codes per email per share: per 15 minutes, per day. */
  codesPerEmailWindow: 3,
  codesPerEmailDay: 10,
  /** Codes per share per hour (bounds what a link can make the server send). */
  codesPerShareHour: 50,
  /** Wrong guesses per code. */
  attemptsPerCode: 5,
  /** Contributions (items + comments) per participant per hour. */
  contributionsPerHour: 20,
  /** Items added through the page, per share; comments per share. */
  inviteeItemsPerShare: 100,
  commentsPerShare: 500,
  itemsPerOccurrence: 300,
} as const

const op = (sql: string, ...params: (string | number | null)[]): Op => ({ sql, params })

// --------------------------------------------------------------------------------- the merge rule

export type StatusDecision = {
  outcome: SharedChange['outcome']
  reason: string | null
  /** The item after the change (unchanged unless applied). */
  status: AgendaItemStatus
  lock: SharedItem['lock']
}

export function standing(role: SharedActor['role'], by: string): number {
  if (by !== 'user') return 1
  return role === 'owner' ? 3 : role === 'member' ? 2 : 1
}

const lockStanding = (l: SharedItem['lock']) => (l === 'owner' ? 3 : l === 'member' ? 2 : 0)

/** One submitted status change against the item as the server has it. Pure. */
export function decideSharedStatus(
  item: Pick<SharedItem, 'status' | 'lock' | 'statusAt'>,
  c: { role: SharedActor['role']; by: string; to: AgendaItemStatus; at: string },
): StatusDecision {
  const keep = { status: item.status, lock: item.lock }
  if (c.role === 'invitee') return { outcome: 'refused', reason: 'invitees do not change statuses', ...keep }
  if (c.to === item.status) return { outcome: 'agreed', reason: null, ...keep }
  const p = standing(c.role, c.by)
  const lp = lockStanding(item.lock)
  if (p < lp)
    return {
      outcome: 'refused',
      reason: `the ${item.lock} set it to ${item.status} by hand (manual wins)`,
      ...keep,
    }
  if (isForwardMove(item.status, c.to)) return { outcome: 'applied', reason: null, status: c.to, lock: null }
  if (p === 1)
    return {
      outcome: 'refused',
      reason: `${c.by} cannot move it from ${item.status} back to ${c.to}: only a person can`,
      ...keep,
    }
  if (item.statusAt && Date.parse(c.at) < Date.parse(item.statusAt))
    return { outcome: 'superseded', reason: 'a later change was already applied (latest wins)', ...keep }
  return { outcome: 'applied', reason: null, status: c.to, lock: p === 3 ? 'owner' : 'member' }
}

// ------------------------------------------------------------------------------------- helpers

export const ownerActor = (share: Share, by: SharedActor['by'] = 'user'): SharedActor => ({
  participantId: 'owner',
  role: 'owner',
  label: share.ownerLabel,
  name: share.ownerName,
  by,
})

/** A participant's standing now: the owner's member list decides (it may change after they joined). */
export function roleOf(share: Share, p: ShareParticipant): 'member' | 'invitee' {
  return share.options.members.includes(p.email) ? 'member' : 'invitee'
}

export const participantActor = (share: Share, p: ShareParticipant, by: SharedActor['by']): SharedActor => ({
  participantId: p.id,
  role: roleOf(share, p),
  label: p.email,
  name: p.name,
  by,
})

const refuse = (code: 'conflict' | 'not_found' | 'bad_request' | 'unauthorized', msg: string) =>
  code === 'unauthorized' ? new ShareForbidden(msg) : new StoreError(code, msg)

/** The caller may not do this on this share (the server maps it to 403). */
export class ShareForbidden extends StoreError {
  constructor(message: string) {
    super('bad_request', message)
    this.name = 'ShareForbidden'
  }
}

/** Thrown when a rate limit is hit (the server maps it to 429). */
export class ShareRateLimited extends StoreError {
  constructor(message: string) {
    super('conflict', message)
    this.name = 'ShareRateLimited'
  }
}

/** Thrown for a revoked share (the server maps it to 410). */
export class ShareGone extends StoreError {
  constructor() {
    super('not_found', 'this agenda is no longer shared')
    this.name = 'ShareGone'
  }
}

export function live(s: ShareState | null): ShareState {
  if (!s) throw refuse('not_found', 'no such shared agenda')
  if (s.share.revokedAt) throw new ShareGone()
  return s
}

// --------------------------------------------------------------------------------- owner: header

export type OccurrenceInput = Extract<ShareOp, { op: 'occurrence' }>['occurrence']

export function planCreateShare(i: {
  shareId: string
  tokenHash: string
  ownerName: string
  ownerLabel: string
  options: ShareOptions
  occurrence: OccurrenceInput
  now: Date
}): SharePlan<Share> {
  const at = i.now.toISOString()
  const share: Share = {
    id: i.shareId,
    ownerName: i.ownerName,
    ownerLabel: i.ownerLabel,
    occurrences: [{ ...i.occurrence, recapShared: false, addedAt: at }],
    current: i.occurrence.agendaId,
    options: { allowInvitees: i.options.allowInvitees, members: [...new Set(i.options.members)].sort() },
    createdAt: at,
    updatedAt: at,
    revokedAt: null,
  }
  return {
    events: [{ type: 'share.upserted', share }],
    bookkeeping: [
      op(
        'INSERT INTO share_tokens (token_hash, share_id, created_at) VALUES (?, ?, ?)',
        i.tokenHash,
        i.shareId,
        at,
      ),
    ],
    result: share,
  }
}

export function planUpdateShare(
  st: ShareState | null,
  patch: { ownerName?: string; ownerLabel?: string; options?: ShareOptions },
  now: Date,
): SharePlan<Share> {
  const s = live(st)
  const share: Share = {
    ...s.share,
    ...(patch.ownerName !== undefined ? { ownerName: patch.ownerName } : {}),
    ...(patch.ownerLabel !== undefined ? { ownerLabel: patch.ownerLabel } : {}),
    ...(patch.options
      ? {
          options: {
            allowInvitees: patch.options.allowInvitees,
            members: [...new Set(patch.options.members)].sort(),
          },
        }
      : {}),
    updatedAt: now.toISOString(),
  }
  return { events: [{ type: 'share.upserted', share }], bookkeeping: [], result: share }
}

/** Unshare: a tombstone stays (the link answers 410); every item, change, card, comment and participant goes. */
export function planRevokeShare(st: ShareState | null, now: Date): SharePlan<true> {
  if (!st) throw refuse('not_found', 'no such shared agenda')
  if (st.share.revokedAt) return { events: [], bookkeeping: [], result: true }
  const at = now.toISOString()
  const tomb: Share = {
    ...st.share,
    occurrences: [],
    current: st.share.current,
    options: { allowInvitees: false, members: [] },
    ownerName: st.share.ownerName,
    updatedAt: at,
    revokedAt: at,
  }
  return {
    events: [
      { type: 'share.upserted', share: tomb },
      { type: 'share.revoked', shareId: st.share.id, at },
    ],
    bookkeeping: [
      op('DELETE FROM share_participant_tokens WHERE share_id = ?', st.share.id),
      op('DELETE FROM share_codes WHERE share_id = ?', st.share.id),
    ],
    result: true,
  }
}

// ------------------------------------------------------------------------------------------ push

/**
 * A device's push: the owner's projection of their agenda, or a member's own changes. Ops apply in
 * order against a working copy; refused ops are reported and do not stop the rest.
 */
export function planPush(
  st: ShareState | null,
  who: { role: 'owner' } | { role: 'member'; participant: ShareParticipant },
  ops: ShareOp[],
  now: Date,
  newId: (kind: 'shc') => string,
): SharePlan<SharePushResult> {
  const s = live(st)
  const at = now.toISOString()
  let share: Share = structuredClone(s.share)
  let shareChanged = false
  const items = new Map(s.items.map((i) => [i.id, structuredClone(i)]))
  const cards = new Map(s.cards.map((c) => [c.id, structuredClone(c)]))
  const seen = new Set(s.changes.map((c) => `${c.actor.participantId}\u0000${c.key}`))
  const events: DurableEventData[] = []
  const recorded: SharedChange[] = []
  const out = { applied: 0, unchanged: 0, refused: [] as SharePushResult['refused'] }
  if (who.role === 'member' && roleOf(share, who.participant) !== 'member')
    throw refuse('unauthorized', 'only attendees the owner listed can sync this agenda')
  const actor = (by: SharedActor['by']): SharedActor =>
    who.role === 'owner' ? ownerActor(share, by) : participantActor(share, who.participant, by)
  const isOwner = who.role === 'owner'
  const occurrences = () => new Set(share.occurrences.map((o) => o.agendaId))
  const upsertItem = (i: SharedItem) => {
    items.set(i.id, i)
    events.push({ type: 'share.item.upserted', shareId: share.id, item: i })
  }

  const handle = (o: ShareOp, index: number): undefined => {
    const no = (reason: string): undefined => {
      out.refused.push({ index, op: o.op, reason })
    }
    switch (o.op) {
      case 'occurrence': {
        if (!isOwner) return no('only the owner changes the agenda header')
        const cur = share.occurrences.find((x) => x.agendaId === o.occurrence.agendaId)
        const next = cur ? { ...cur, ...o.occurrence } : { ...o.occurrence, recapShared: false, addedAt: at }
        const changed =
          !cur ||
          JSON.stringify(cur) !== JSON.stringify(next) ||
          (o.current && share.current !== next.agendaId)
        if (!changed) {
          out.unchanged++
          return
        }
        share = {
          ...share,
          occurrences: cur
            ? share.occurrences.map((x) => (x.agendaId === next.agendaId ? next : x))
            : [...share.occurrences, next],
          ...(o.current ? { current: next.agendaId } : {}),
        }
        shareChanged = true
        out.applied++
        return
      }
      case 'item': {
        const i = o.item
        if (!occurrences().has(i.occurrence)) return no(`no occurrence ${i.occurrence} on this share`)
        const cur = items.get(i.id)
        if (cur && cur.occurrence !== i.occurrence) return no(`item ${i.id} belongs to another occurrence`)
        if (
          !isOwner &&
          cur &&
          cur.createdBy.participantId !== (who as { participant: ShareParticipant }).participant.id
        )
          return no('a member edits only the items they added')
        if (
          !cur &&
          [...items.values()].filter((x) => x.occurrence === i.occurrence).length >=
            SHARE_LIMITS.itemsPerOccurrence
        )
          return no('too many items on this agenda')
        const order = isOwner
          ? i.order
          : (cur?.order ??
            Math.max(
              -1,
              ...[...items.values()].filter((x) => x.occurrence === i.occurrence).map((x) => x.order),
            ) + 1)
        const base = cur ?? {
          id: i.id,
          occurrence: i.occurrence,
          status: 'open' as const,
          outcome: null,
          auto: false,
          confidence: null,
          // a carried-over item keeps who added it originally (an invitee's item stays theirs)
          createdBy:
            (i.carriedFrom ? items.get(i.carriedFrom.itemId)?.createdBy : undefined) ?? actor('user'),
          changedBy: actor('user'),
          lock: null,
          statusAt: null,
          createdAt: at,
          updatedAt: at,
        }
        const next: SharedItem = {
          ...base,
          text: i.text,
          kind: i.kind,
          owner: i.owner,
          timeboxMin: i.timeboxMin,
          order,
          carriedFrom: i.carriedFrom ?? cur?.carriedFrom ?? null,
          updatedAt: cur ? cur.updatedAt : at,
        }
        if (cur && sameItemFields(cur, next)) {
          out.unchanged++
          return
        }
        upsertItem({ ...next, updatedAt: at })
        out.applied++
        return
      }
      case 'item.delete': {
        const cur = items.get(o.itemId)
        if (!cur) {
          out.unchanged++
          return
        }
        if (
          !isOwner &&
          cur.createdBy.participantId !== (who as { participant: ShareParticipant }).participant.id
        )
          return no('a member deletes only the items they added')
        items.delete(o.itemId)
        events.push({ type: 'share.item.deleted', shareId: share.id, itemId: o.itemId })
        out.applied++
        return
      }
      case 'status': {
        const cur = items.get(o.itemId)
        if (!cur) return no(`no item ${o.itemId}`)
        const a = actor(o.by)
        const k = `${a.participantId}\u0000${o.key}`
        if (seen.has(k)) {
          out.unchanged++
          return
        }
        seen.add(k)
        const d = decideSharedStatus(cur, { role: a.role, by: o.by, to: o.to, at: o.at })
        const change: SharedChange = {
          id: newId('shc'),
          key: o.key,
          itemId: o.itemId,
          occurrence: cur.occurrence,
          from: o.from,
          to: o.to,
          actor: a,
          at: o.at,
          receivedAt: at,
          auto: o.auto,
          confidence: o.confidence,
          outcome: d.outcome,
          reason: d.reason,
          before: cur.status,
          after: d.status,
        }
        let item: SharedItem | null = null
        if (d.outcome === 'applied') {
          item = {
            ...cur,
            status: d.status,
            lock: d.lock,
            changedBy: a,
            statusAt: o.at,
            auto: o.auto,
            confidence: o.confidence,
            updatedAt: at,
          }
          items.set(item.id, item)
          out.applied++
        } else out.unchanged++
        recorded.push(change)
        events.push({ type: 'share.change', shareId: share.id, change, item })
        return
      }
      case 'outcome': {
        if (!isOwner) return no('only the owner writes outcomes')
        const cur = items.get(o.itemId)
        if (!cur) return no(`no item ${o.itemId}`)
        const occ = share.occurrences.find((x) => x.agendaId === cur.occurrence)
        if (!occ?.recapShared) return no('the recap of this occurrence is not shared')
        if (cur.outcome === o.outcome) {
          out.unchanged++
          return
        }
        upsertItem({ ...cur, outcome: o.outcome, updatedAt: at })
        out.applied++
        return
      }
      case 'card': {
        if (!isOwner) return no('only the owner shares context cards')
        const c = o.card
        if (!occurrences().has(c.occurrence)) return no(`no occurrence ${c.occurrence} on this share`)
        const cur = cards.get(c.id)
        const next: SharedCard = { ...c, createdAt: cur?.createdAt ?? at, updatedAt: cur?.updatedAt ?? at }
        if (cur && JSON.stringify(cur) === JSON.stringify(next)) {
          out.unchanged++
          return
        }
        const card = { ...next, updatedAt: at }
        cards.set(c.id, card)
        events.push({ type: 'share.card.upserted', shareId: share.id, card })
        out.applied++
        return
      }
      case 'card.delete': {
        if (!isOwner) return no('only the owner shares context cards')
        if (!cards.has(o.cardId)) {
          out.unchanged++
          return
        }
        cards.delete(o.cardId)
        events.push({ type: 'share.card.deleted', shareId: share.id, cardId: o.cardId })
        out.applied++
        return
      }
      case 'recap': {
        if (!isOwner) return no('only the owner shares the recap')
        const occ = share.occurrences.find((x) => x.agendaId === o.occurrence)
        if (!occ) return no(`no occurrence ${o.occurrence} on this share`)
        if (occ.recapShared === o.shared) {
          out.unchanged++
          return
        }
        share = {
          ...share,
          occurrences: share.occurrences.map((x) =>
            x.agendaId === o.occurrence ? { ...x, recapShared: o.shared } : x,
          ),
        }
        shareChanged = true
        // un-sharing takes the outcomes off the server, not just off the page
        if (!o.shared)
          for (const i of [...items.values()])
            if (i.occurrence === o.occurrence && i.outcome !== null)
              upsertItem({ ...i, outcome: null, updatedAt: at })
        out.applied++
        return
      }
    }
  }
  for (const [index, o] of ops.entries()) handle(o, index)
  if (shareChanged) {
    share = { ...share, updatedAt: at }
    // the header goes first so every later event refers to a share that has the occurrence
    events.unshift({ type: 'share.upserted', share })
  }
  const after: ShareState = { ...s, share, items: [...items.values()], cards: [...cards.values()] }
  const you =
    who.role === 'owner'
      ? { participantId: 'owner', role: 'owner' as const, label: share.ownerLabel }
      : { participantId: who.participant.id, role: 'member' as const, label: who.participant.email }
  return {
    events,
    bookkeeping: [],
    result: { ...out, changes: recorded, state: stateView(after, you) },
  }
}

function sameItemFields(a: SharedItem, b: SharedItem): boolean {
  return (
    a.text === b.text &&
    a.kind === b.kind &&
    a.owner === b.owner &&
    a.timeboxMin === b.timeboxMin &&
    a.order === b.order &&
    JSON.stringify(a.carriedFrom) === JSON.stringify(b.carriedFrom)
  )
}

// ------------------------------------------------------------------------------- magic links

/**
 * Ask for a code. Always "sent" to the caller (no enumeration): `send` says whether the server should
 * actually mail it — only to a listed member, or to anyone when the owner allows invitees.
 */
export function planVerify(
  st: ShareState | null,
  i: { email: string; name: string | null; codeHash: string; now: Date },
): SharePlan<{ expiresAt: string; send: boolean }> {
  const s = live(st)
  const now = i.now.getTime()
  const expiresAt = new Date(now + SHARE_LIMITS.codeTtlMs).toISOString()
  const mine = s.codes.filter((c) => c.email === i.email)
  if (
    mine.filter((c) => now - Date.parse(c.createdAt) < SHARE_LIMITS.codeTtlMs).length >=
    SHARE_LIMITS.codesPerEmailWindow
  )
    throw new ShareRateLimited('too many codes for this address; wait a few minutes')
  if (mine.length >= SHARE_LIMITS.codesPerEmailDay)
    throw new ShareRateLimited('too many codes for this address today')
  if (
    s.codes.filter((c) => now - Date.parse(c.createdAt) < 3_600_000).length >= SHARE_LIMITS.codesPerShareHour
  )
    throw new ShareRateLimited('this link has asked for too many codes; try again later')
  const allowed = s.share.options.allowInvitees || s.share.options.members.includes(i.email)
  const existing = s.participants.find((p) => p.email === i.email)
  if (!allowed || existing?.revokedAt)
    return { events: [], bookkeeping: [], result: { expiresAt, send: false } }
  return {
    events: [],
    bookkeeping: [
      op(
        `INSERT INTO share_codes (code_hash, share_id, email, name, created_at, expires_at, used_at, attempts)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
        i.codeHash,
        s.share.id,
        i.email,
        i.name,
        i.now.toISOString(),
        expiresAt,
      ),
    ],
    result: { expiresAt, send: true },
  }
}

export type ConfirmOutcome = { ok: true; participant: ShareParticipant } | { ok: false; reason: string }

/** Exchange a code for a participant (created on first confirm). A wrong code counts against every live code of that email. */
export function planConfirm(
  st: ShareState | null,
  i: { email: string; codeHash: string; participantId: string; tokenHash: string; now: Date },
): SharePlan<ConfirmOutcome> {
  const s = live(st)
  const nowIso = i.now.toISOString()
  const usable = (c: CodeRecord) =>
    c.email === i.email &&
    c.usedAt === null &&
    c.expiresAt > nowIso &&
    c.attempts < SHARE_LIMITS.attemptsPerCode
  const active = s.codes.filter(usable)
  const hit = active.find((c) => c.codeHash === i.codeHash)
  if (!hit) {
    return {
      events: [],
      bookkeeping: active.map((c) =>
        op('UPDATE share_codes SET attempts = attempts + 1 WHERE code_hash = ?', c.codeHash),
      ),
      result: { ok: false, reason: 'that code is wrong or has expired; ask for a new one' },
    }
  }
  const cur = s.participants.find((p) => p.email === i.email)
  if (cur?.revokedAt)
    return {
      events: [],
      bookkeeping: [],
      result: { ok: false, reason: 'the owner removed this address from the agenda' },
    }
  const role = s.share.options.members.includes(i.email) ? ('member' as const) : ('invitee' as const)
  if (role === 'invitee' && !s.share.options.allowInvitees)
    return {
      events: [],
      bookkeeping: [],
      result: { ok: false, reason: 'this agenda does not take contributions' },
    }
  const participant: ShareParticipant = cur
    ? { ...cur, role, name: hit.name ?? cur.name }
    : {
        id: i.participantId,
        shareId: s.share.id,
        email: i.email,
        name: hit.name,
        role,
        createdAt: nowIso,
        revokedAt: null,
      }
  const events: DurableEventData[] =
    cur && JSON.stringify(cur) === JSON.stringify(participant)
      ? []
      : [{ type: 'share.participant.upserted', participant }]
  return {
    events,
    bookkeeping: [
      op('UPDATE share_codes SET used_at = ? WHERE code_hash = ?', nowIso, hit.codeHash),
      op(
        'INSERT INTO share_participant_tokens (token_hash, participant_id, share_id, created_at) VALUES (?, ?, ?, ?)',
        i.tokenHash,
        participant.id,
        s.share.id,
        nowIso,
      ),
    ],
    result: { ok: true, participant },
  }
}

// ------------------------------------------------------------------------- invitee contributions

function contributor(s: ShareState): ShareParticipant {
  const p = s.caller
  if (!p) throw refuse('unauthorized', 'verify your email first')
  if (roleOf(s.share, p) === 'invitee' && !s.share.options.allowInvitees)
    throw refuse('unauthorized', 'this agenda does not take contributions')
  return p
}

function checkRate(s: ShareState, p: ShareParticipant, now: Date): void {
  const hour = now.getTime() - 3_600_000
  const n =
    s.items.filter((i) => i.createdBy.participantId === p.id && Date.parse(i.createdAt) > hour).length +
    s.comments.filter((c) => c.author.participantId === p.id && Date.parse(c.at) > hour).length
  if (n >= SHARE_LIMITS.contributionsPerHour)
    throw new ShareRateLimited('too many contributions; try again later')
}

export function planAddItem(
  st: ShareState | null,
  i: { text: string; kind: 'topic' | 'question'; itemId: string; now: Date },
): SharePlan<SharedItem> {
  const s = live(st)
  const p = contributor(s)
  checkRate(s, p, i.now)
  if (s.items.filter((x) => x.createdBy.role === 'invitee').length >= SHARE_LIMITS.inviteeItemsPerShare)
    throw new ShareRateLimited('this agenda has taken as many contributed items as it can')
  const occ = s.share.current
  const mine = s.items.filter((x) => x.occurrence === occ)
  if (mine.length >= SHARE_LIMITS.itemsPerOccurrence)
    throw new ShareRateLimited('too many items on this agenda')
  const at = i.now.toISOString()
  const a = participantActor(s.share, p, roleOf(s.share, p) === 'invitee' ? `invitee:${p.email}` : 'user')
  const item: SharedItem = {
    id: i.itemId,
    occurrence: occ,
    text: i.text,
    kind: i.kind,
    owner: null,
    timeboxMin: null,
    order: Math.max(-1, ...mine.map((x) => x.order)) + 1,
    status: 'open',
    outcome: null,
    auto: false,
    confidence: null,
    createdBy: a,
    changedBy: a,
    lock: null,
    statusAt: null,
    carriedFrom: null,
    createdAt: at,
    updatedAt: at,
  }
  return {
    events: [{ type: 'share.item.upserted', shareId: s.share.id, item }],
    bookkeeping: [],
    result: item,
  }
}

export function planAddComment(
  st: ShareState | null,
  i: { itemId: string | null; text: string; commentId: string; now: Date },
): SharePlan<SharedComment> {
  const s = live(st)
  const p = contributor(s)
  checkRate(s, p, i.now)
  if (s.comments.length >= SHARE_LIMITS.commentsPerShare)
    throw new ShareRateLimited('this agenda has too many comments')
  let occ = s.share.current
  if (i.itemId !== null) {
    const it = s.items.find((x) => x.id === i.itemId)
    if (!it) throw refuse('not_found', `no item ${i.itemId}`)
    occ = it.occurrence
  }
  const comment: SharedComment = {
    id: i.commentId,
    occurrence: occ,
    itemId: i.itemId,
    author: participantActor(s.share, p, roleOf(s.share, p) === 'invitee' ? `invitee:${p.email}` : 'user'),
    text: i.text,
    at: i.now.toISOString(),
    hidden: false,
  }
  return {
    events: [{ type: 'share.comment.upserted', shareId: s.share.id, comment }],
    bookkeeping: [],
    result: comment,
  }
}

// ---------------------------------------------------------------------------- owner moderation

export function planRevokeParticipant(
  st: ShareState | null,
  participantId: string,
  now: Date,
): SharePlan<ShareParticipant> {
  const s = live(st)
  const p = s.participants.find((x) => x.id === participantId)
  if (!p) throw refuse('not_found', `no participant ${participantId}`)
  if (p.revokedAt) return { events: [], bookkeeping: [], result: p }
  const participant = { ...p, revokedAt: now.toISOString() }
  return {
    events: [{ type: 'share.participant.upserted', participant }],
    bookkeeping: [op('DELETE FROM share_participant_tokens WHERE participant_id = ?', p.id)],
    result: participant,
  }
}

export function planHideComment(st: ShareState | null, commentId: string): SharePlan<SharedComment> {
  const s = live(st)
  const c = s.comments.find((x) => x.id === commentId)
  if (!c) throw refuse('not_found', `no comment ${commentId}`)
  if (c.hidden) return { events: [], bookkeeping: [], result: c }
  const comment = { ...c, hidden: true }
  return {
    events: [{ type: 'share.comment.upserted', shareId: s.share.id, comment }],
    bookkeeping: [],
    result: comment,
  }
}

// ------------------------------------------------------------------------------------------ views

export function stateView(s: ShareState, you: SharedAgendaState['you']): SharedAgendaState {
  return {
    share: s.share,
    items: [...s.items].sort(
      (a, b) => a.occurrence.localeCompare(b.occurrence) || a.order - b.order || a.id.localeCompare(b.id),
    ),
    cards: s.cards,
    comments: s.comments,
    participants: you.role === 'owner' ? s.participants : [],
    you,
  }
}

/** The public page: one occurrence, outcomes only if its recap is shared, no ids of people. */
export function publicPage(
  st: ShareState | null,
  o: { occurrence?: string | undefined; contributions: boolean },
): SharedAgendaPage {
  const s = live(st)
  const occ =
    s.share.occurrences.find((x) => x.agendaId === (o.occurrence ?? s.share.current)) ??
    s.share.occurrences.find((x) => x.agendaId === s.share.current)
  if (!occ) throw refuse('not_found', 'no such occurrence')
  const label = (a: SharedActor) => publicActorLabel(a, s.share.ownerName)
  const items: PublicItem[] = s.items
    .filter((i) => i.occurrence === occ.agendaId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((i) => ({
      id: i.id,
      text: i.text,
      kind: i.kind,
      owner: i.owner,
      timeboxMin: i.timeboxMin,
      status: i.status,
      outcome: occ.recapShared ? i.outcome : null,
      auto: i.auto,
      changedBy: label(i.changedBy),
      addedBy: label(i.createdBy),
      contributed: i.createdBy.role !== 'owner',
      carriedOver: i.carriedFrom !== null,
    }))
  const comments: PublicComment[] = s.comments
    .filter((c) => c.occurrence === occ.agendaId && !c.hidden)
    .map((c) => ({
      id: c.id,
      itemId: c.itemId,
      author: label(c.author),
      text: c.text,
      at: c.at,
      mine: s.caller !== null && c.author.participantId === s.caller.id,
    }))
  return {
    title: occ.title,
    ownerName: s.share.ownerName,
    occurrence: occ,
    occurrences: s.share.occurrences.map((x) => ({
      agendaId: x.agendaId,
      title: x.title,
      meeting: x.meeting,
      recapShared: x.recapShared,
    })),
    current: s.share.current,
    items,
    cards: s.cards
      .filter((c) => c.occurrence === occ.agendaId)
      .map((c) => ({ id: c.id, title: c.title, body: c.body, pinned: c.pinned, sourceUrl: c.sourceUrl })),
    comments,
    contributions: o.contributions && s.share.options.allowInvitees,
    you: s.caller ? { email: s.caller.email, name: s.caller.name, role: roleOf(s.share, s.caller) } : null,
  }
}
