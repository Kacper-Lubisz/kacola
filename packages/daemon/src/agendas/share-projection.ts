import { createHash } from 'node:crypto'
import type {
  AgendaItem,
  AgendaView,
  SharedAgendaState,
  SharedItem,
  ShareOp,
  StatusChange,
} from '@kacola/protocol'

// Team sharing — what a device sends to the hosted server, as pure functions of the local agenda and
// the server's last known state. This is THE privacy boundary on the device side: everything that
// leaves is built here, field by field, from an allow-list (never by copying an object and deleting
// keys), and the server's strict push schema refuses anything else.
//
//   leaves     title, meeting (event UID, start, end, recurring), goals (only with shareGoals), item
//              text/kind/owner/timebox/order/carried-from, status changes (who, when, from → to, auto,
//              confidence), outcomes (only while this occurrence's recap is shared), cards the owner
//              marked shared (title, body, pinned, a source URL)
//   never      evidence (quotes and segment ids), status notes, private cards, agent cards, suggestions,
//              the session, the calendar's name, local paths

/** A device-local change author: the only attributions a device pushes as its own. */
export const isLocalAuthor = (by: string): boolean =>
  by === 'user' || by === 'tracker' || by.startsWith('agent:')

/** The idempotency key of a local status change (stable across restarts: derived from the change). */
export function changeKey(agendaId: string, c: StatusChange): string {
  return createHash('sha256')
    .update(`${agendaId}|${c.itemId}|${c.at}|${c.from}|${c.to}|${c.by}`)
    .digest('base64url')
    .slice(0, 32)
}

export type OccurrenceProjection = {
  /** The owner agenda id (== the local agenda id on the owner's device). */
  occurrence: string
  view: AgendaView
  history: StatusChange[]
  /** Remote item ids this device has mirrored (to tell "deleted here" from "new there"). */
  seenRemote: ReadonlySet<string>
  recapShared: boolean
}

const itemOp = (occurrence: string, i: AgendaItem, order: number): Extract<ShareOp, { op: 'item' }> => ({
  op: 'item',
  item: {
    id: i.id,
    occurrence,
    text: i.text,
    kind: i.kind,
    owner: i.owner,
    timeboxMin: i.timeboxMin,
    order,
    carriedFrom: i.carriedFrom ? { occurrence: i.carriedFrom.agendaId, itemId: i.carriedFrom.itemId } : null,
  },
})

const sameItem = (op: Extract<ShareOp, { op: 'item' }>['item'], s: SharedItem, compareOrder: boolean) =>
  s.text === op.text &&
  s.kind === op.kind &&
  s.owner === op.owner &&
  s.timeboxMin === op.timeboxMin &&
  (!compareOrder || s.order === op.order) &&
  JSON.stringify(s.carriedFrom) === JSON.stringify(op.carriedFrom)

function statusOps(
  p: OccurrenceProjection,
  known: ReadonlySet<string>,
  pushed: ReadonlySet<string>,
): Extract<ShareOp, { op: 'status' }>[] {
  const out: Extract<ShareOp, { op: 'status' }>[] = []
  for (const c of p.history) {
    if (!isLocalAuthor(c.by) || !known.has(c.itemId)) continue
    const key = changeKey(p.view.agenda.id, c)
    if (pushed.has(key)) continue
    out.push({
      op: 'status',
      key,
      itemId: c.itemId,
      from: c.from,
      to: c.to,
      by: c.by,
      at: c.at,
      auto: c.auto,
      confidence: c.confidence,
    })
  }
  return out
}

/** The owner's ops for one occurrence: header, items, deletions, statuses, recap + outcomes, shared cards. */
export function ownerOps(
  p: OccurrenceProjection,
  o: { server: SharedAgendaState | null; current: boolean; shareGoals: boolean; pushed: ReadonlySet<string> },
): ShareOp[] {
  const ops: ShareOp[] = []
  const a = p.view.agenda
  const occ = o.server?.share.occurrences.find((x) => x.agendaId === p.occurrence)
  const header = {
    agendaId: p.occurrence,
    title: a.title,
    meeting: a.meeting
      ? {
          eventUid: a.meeting.eventUid,
          start: a.meeting.start,
          end: a.meeting.end,
          recurring: a.meeting.recurring,
        }
      : null,
    goals: o.shareGoals ? [...a.goals] : [],
  }
  const headerSame =
    occ &&
    occ.title === header.title &&
    JSON.stringify(occ.meeting) === JSON.stringify(header.meeting) &&
    JSON.stringify(occ.goals) === JSON.stringify(header.goals)
  if (!headerSame || (o.current && o.server?.share.current !== p.occurrence))
    ops.push({ op: 'occurrence', occurrence: header, current: o.current })

  const server = new Map(
    (o.server?.items ?? []).filter((i) => i.occurrence === p.occurrence).map((i) => [i.id, i] as const),
  )
  const local = new Set(p.view.items.map((i) => i.id))
  for (const i of p.view.items) {
    const op = itemOp(p.occurrence, i, i.order)
    const s = server.get(i.id)
    if (!s || !sameItem(op.item, s, true)) ops.push(op)
  }
  for (const s of server.values())
    if (!local.has(s.id) && (s.createdBy.role === 'owner' || p.seenRemote.has(s.id)))
      ops.push({ op: 'item.delete', itemId: s.id })

  ops.push(...statusOps(p, local, o.pushed))

  if (!occ || occ.recapShared !== p.recapShared)
    ops.push({ op: 'recap', occurrence: p.occurrence, shared: p.recapShared })
  if (p.recapShared)
    for (const i of p.view.items)
      if ((server.get(i.id)?.outcome ?? null) !== i.outcome)
        ops.push({ op: 'outcome', itemId: i.id, outcome: i.outcome })

  const shared = p.view.context.filter((c) => c.visibility === 'shared' && c.createdBy === 'user')
  const serverCards = new Map(
    (o.server?.cards ?? []).filter((c) => c.occurrence === p.occurrence).map((c) => [c.id, c] as const),
  )
  for (const c of shared) {
    const card = {
      id: c.id,
      occurrence: p.occurrence,
      title: c.title,
      body: c.body,
      pinned: c.pinned,
      sourceUrl: c.source.kind === 'url' ? c.source.ref : null,
    }
    const s = serverCards.get(c.id)
    if (
      !s ||
      s.title !== card.title ||
      s.body !== card.body ||
      s.pinned !== card.pinned ||
      s.sourceUrl !== card.sourceUrl
    )
      ops.push({ op: 'card', card })
  }
  const sharedIds = new Set(shared.map((c) => c.id))
  for (const s of serverCards.values())
    if (!sharedIds.has(s.id)) ops.push({ op: 'card.delete', cardId: s.id })
  return ops
}

/** A member's ops for one occurrence: the items they added, their deletions, their status changes. */
export function memberOps(
  p: OccurrenceProjection,
  o: { server: SharedAgendaState; me: string; pushed: ReadonlySet<string> },
): ShareOp[] {
  const ops: ShareOp[] = []
  const server = new Map(
    o.server.items.filter((i) => i.occurrence === p.occurrence).map((i) => [i.id, i] as const),
  )
  const known = new Set(server.keys())
  for (const i of p.view.items) {
    const s = server.get(i.id)
    const mine = s
      ? s.createdBy.participantId === o.me
      : isLocalAuthor(i.createdBy) && !p.seenRemote.has(i.id)
    if (!mine) continue
    const op = itemOp(p.occurrence, i, i.order)
    if (!s || !sameItem(op.item, s, false)) ops.push(op)
    known.add(i.id)
  }
  const local = new Set(p.view.items.map((i) => i.id))
  for (const s of server.values())
    if (s.createdBy.participantId === o.me && !local.has(s.id)) ops.push({ op: 'item.delete', itemId: s.id })
  ops.push(...statusOps(p, new Set([...known].filter((id) => local.has(id))), o.pushed))
  return ops
}
