import type { AgendaItem, AgendaView, Evidence, Suggestion } from '@gnomeola/protocol'
import { activeSuggestions, isOpenItem } from '@gnomeola/ui-core/agendas'

// The live screen's one suggestion slot (unit-tested in test/day.test.ts). At most one suggestion is
// shown, and only when there is one: no fallback card, no "next item" filler, no time pressure.
//
// Order: what just happened first (an item that looks covered, an agent's proposed change), then what to
// say next, then a fact to check. "Missed" is never shown live: it would sit next to the checklist's
// "covered" marks and read as a contradiction, and it is time pressure the owner asked to drop.

export type SlotKind = 'looks-covered' | 'proposal' | 'say-next' | 'check'

export type Slot = {
  suggestion: Suggestion
  kind: SlotKind
  /** The agenda item it is about, when it names one. */
  item: AgendaItem | null
  /** The words that prompted it (the item's latest evidence), when there are any. */
  evidence: Evidence | null
}

const RANK: Record<SlotKind, number> = { 'looks-covered': 0, proposal: 1, 'say-next': 2, check: 3 }

export function slotKind(s: Suggestion): SlotKind | null {
  switch (s.kind) {
    case 'looks-covered':
      return 'looks-covered'
    case 'set-status':
    case 'add-item':
      return 'proposal'
    case 'next-point':
    case 'question':
      return 'say-next'
    case 'fact-check':
      return 'check'
    case 'missed':
      return null
  }
}

export function pickSuggestion(view: AgendaView, now: number): Slot | null {
  const byId = new Map(view.items.map((i) => [i.id, i]))
  let best: Slot | null = null
  // newest first: among equals, the newest wins
  for (const s of activeSuggestions(view, now)) {
    const kind = slotKind(s)
    if (!kind) continue
    const item = s.itemId ? (byId.get(s.itemId) ?? null) : null
    // stale: the item it is about has moved on already
    if (item && (kind === 'looks-covered' || kind === 'say-next') && !isOpenItem(item)) continue
    if (best && RANK[best.kind] <= RANK[kind]) continue
    best = { suggestion: s, kind, item, evidence: item?.evidence.at(-1) ?? null }
  }
  return best
}

/** The item the meeting is on: the first in progress, in agenda order. */
export function currentItem(view: AgendaView): AgendaItem | null {
  return [...view.items].sort((a, b) => a.order - b.order).find((i) => i.status === 'in-progress') ?? null
}
