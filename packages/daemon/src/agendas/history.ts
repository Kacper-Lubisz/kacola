import {
  type Actor,
  type AgendaItem,
  actorOf,
  type ChangedBy,
  type ItemField,
  type ItemVersion,
  type ShareStatus,
} from '@kacola/protocol'
import type { AgendaStore } from '@kacola/store'

// Agenda item history (UX trust fixes): the versions of an agenda's items from the event log — adds,
// edits, status changes, removals, imports, restores — with who made each in the five-actor words.

const FIELDS: readonly Exclude<ItemField, 'status'>[] = ['text', 'kind', 'owner', 'timeboxMin', 'outcome']

function changed(prev: AgendaItem | null, next: AgendaItem): ItemField[] {
  if (!prev) return []
  return FIELDS.filter((f) => prev[f] !== next[f])
}

/** Names for peer / invitee labels from a shared agenda's participants (email → name). */
export function participantNames(
  share: Pick<ShareStatus, 'participants'> | null,
): (label: string) => string | null {
  const byEmail = new Map(
    (share?.participants ?? []).filter((p) => p.name).map((p) => [p.email.toLowerCase(), p.name!] as const),
  )
  return (label) => byEmail.get(label.toLowerCase()) ?? null
}

/** Every changedBy / createdBy / source / resolvedBy in a view, in words (AgendaView.actors). */
export function actorsOf(
  bys: Iterable<string | null>,
  names: (label: string) => string | null,
): Record<string, Actor> {
  const out: Record<string, Actor> = {}
  for (const by of bys) if (by && !out[by]) out[by] = actorOf(by, { names })
  return out
}

export function itemVersions(
  agendas: AgendaStore,
  agendaId: string,
  o: { itemId?: string; names?: (label: string) => string | null } = {},
): ItemVersion[] {
  const names = o.names ?? (() => null)
  const last = new Map<string, AgendaItem | null>()
  const out: ItemVersion[] = []
  const push = (v: Omit<ItemVersion, 'actor' | 'restorable'>) =>
    out.push({ ...v, actor: actorOf(v.by, { names }), restorable: v.item !== null })
  for (const { seq, data } of agendas.itemEvents(agendaId, o.itemId)) {
    const cause = data.cause ?? null
    if (data.type === 'agenda.item.deleted') {
      const item = data.item ?? last.get(data.itemId) ?? null
      push({
        seq,
        itemId: data.itemId,
        kind: 'removed',
        by: (data.by ?? 'user') as ChangedBy,
        at: data.at,
        item,
        fields: [],
        status: null,
        cause,
      })
      last.set(data.itemId, null)
      continue
    }
    const prev = last.get(data.item.id) ?? null
    last.set(data.item.id, data.item)
    if (data.type === 'agenda.item.status') {
      push({
        seq,
        itemId: data.item.id,
        kind: cause === 'restore' ? 'restored' : cause === 'import' ? 'imported' : 'status',
        by: data.change.by,
        at: data.at,
        item: data.item,
        fields: ['status'],
        status: data.change,
        cause,
      })
      continue
    }
    const fields = changed(prev, data.item)
    const added = prev === null
    // evidence-only updates (more quotes for the same status) are not a version anyone restores to
    if (!added && !fields.length) continue
    push({
      seq,
      itemId: data.item.id,
      kind: cause === 'restore' ? 'restored' : cause === 'import' ? 'imported' : added ? 'added' : 'edited',
      by: data.item.changedBy,
      at: data.at,
      item: data.item,
      fields,
      status: null,
      cause,
    })
  }
  return out
}
