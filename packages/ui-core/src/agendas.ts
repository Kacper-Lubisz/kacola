import type {
  AgendaItem,
  AgendaItemStatus,
  AgendaView,
  DurableEvent,
  StatusChange,
  Suggestion,
} from '@gnomeola/protocol'

// Agendas in the window (kacola wave 2): the pure folds that keep a cached AgendaView and its history in
// step with the daemon's `agenda.*` events, and the view logic of the live panel (the next talking point,
// "not covered yet", the interview split, attribution). No React, no DOM: unit-tested under plain vitest.
//
// The folds follow the event log's own discipline (docs/agendas.md, "Durable events"): every agenda-scoped
// event carries the agenda's new `version` and the full post-state of what it writes, so applying one
// never needs to read anything, and an event whose version is not newer than the cached view's is a
// replay or a duplicate — a no-op. Suggestions do not bump the version; they are upserted by id.
// An optimistic edit in the window never bumps the version, so its echo always applies over it.

/** The agenda events, as `DurableEvent['data']` members. */
export type AgendaEventData = Extract<DurableEvent['data'], { type: `agenda.${string}` }>

export const isAgendaEvent = (d: DurableEvent['data']): d is AgendaEventData => d.type.startsWith('agenda.')

/** Which agenda an event concerns. */
export function agendaIdOf(d: AgendaEventData): string {
  return d.type === 'agenda.upserted' ? d.agenda.id : d.agendaId
}

const byOrder = (a: AgendaItem, b: AgendaItem) => a.order - b.order || (a.id < b.id ? -1 : 1)

/**
 * Fold one event into a cached view. Returns the same object when nothing changed (so React Query does
 * not notify), and `null` when the agenda was deleted.
 */
export function applyAgendaEvent(view: AgendaView, d: AgendaEventData): AgendaView | null {
  if (agendaIdOf(d) !== view.agenda.id) return view
  switch (d.type) {
    case 'agenda.deleted':
      return null
    case 'agenda.upserted':
      if (d.agenda.version < view.agenda.version) return view
      if (d.agenda.version === view.agenda.version && d.agenda.updatedAt === view.agenda.updatedAt)
        return view
      return { ...view, agenda: d.agenda }
    case 'agenda.suggestion.upserted': {
      const cur = view.suggestions.find((s) => s.id === d.suggestion.id)
      if (cur && sameSuggestion(cur, d.suggestion)) return view
      return {
        ...view,
        suggestions: cur
          ? view.suggestions.map((s) => (s.id === d.suggestion.id ? d.suggestion : s))
          : [...view.suggestions, d.suggestion],
      }
    }
    default:
      break
  }
  if (d.version <= view.agenda.version) return view
  const agenda = { ...view.agenda, version: d.version, updatedAt: d.at }
  switch (d.type) {
    case 'agenda.item.upserted':
    case 'agenda.item.status': {
      const has = view.items.some((i) => i.id === d.item.id)
      const items = has
        ? view.items.map((i) => (i.id === d.item.id ? d.item : i))
        : [...view.items, d.item].sort(byOrder)
      return { ...view, agenda, items }
    }
    case 'agenda.item.deleted':
      return { ...view, agenda, items: view.items.filter((i) => i.id !== d.itemId) }
    case 'agenda.items.reordered':
      return { ...view, agenda, items: reorderItems(view.items, d.itemIds) }
    case 'agenda.context.upserted': {
      const has = view.context.some((c) => c.id === d.card.id)
      return {
        ...view,
        agenda,
        context: has ? view.context.map((c) => (c.id === d.card.id ? d.card : c)) : [...view.context, d.card],
      }
    }
    case 'agenda.context.deleted':
      return { ...view, agenda, context: view.context.filter((c) => c.id !== d.cardId) }
  }
}

const sameSuggestion = (a: Suggestion, b: Suggestion) =>
  a.state === b.state && a.resolvedAt === b.resolvedAt && a.text === b.text && a.expiresAt === b.expiresAt

/** Items in the given order (positions renumbered); ids not listed keep their relative order at the end. */
export function reorderItems(items: readonly AgendaItem[], itemIds: readonly string[]): AgendaItem[] {
  const pos = new Map(itemIds.map((id, i) => [id, i]))
  const listed = items.filter((i) => pos.has(i.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
  const rest = items.filter((i) => !pos.has(i.id)).sort(byOrder)
  return [...listed, ...rest].map((i, order) => (i.order === order ? i : { ...i, order }))
}

/** Move one item from `from` to `to` (indexes in the current order): the full new order of ids. */
export function moveItem(items: readonly AgendaItem[], from: number, to: number): string[] {
  const ids = [...items].sort(byOrder).map((i) => i.id)
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return ids
  const [id] = ids.splice(from, 1)
  ids.splice(to, 0, id!)
  return ids
}

/** Fold a status change into a cached history (oldest first; idempotent). */
export function applyHistoryEvent(history: StatusChange[], d: AgendaEventData): StatusChange[] {
  if (d.type !== 'agenda.item.status') return history
  const c = d.change
  if (history.some((h) => h.itemId === c.itemId && h.at === c.at && h.to === c.to && h.by === c.by))
    return history
  return [...history, c]
}

// ------------------------------------------------------------------------------------ view logic

/**
 * Who made a change, for the "checked by Claude" / "auto" attributions. `peer` is another attendee's
 * device on a shared agenda (team sharing): `peer:<label>` the person, `peer:<label>/tracker` their
 * tracker, `peer:<label>/agent:<name>` their agent — `name` is the label, `via` what acted for them.
 */
export type Attribution = {
  kind: 'you' | 'tracker' | 'agent' | 'invitee' | 'peer'
  name: string | null
  via?: { kind: 'person' } | { kind: 'tracker' } | { kind: 'agent'; name: string }
}

export function attributionOf(by: string): Attribution {
  if (by === 'user') return { kind: 'you', name: null }
  if (by === 'tracker') return { kind: 'tracker', name: null }
  if (by.startsWith('agent:')) return { kind: 'agent', name: by.slice(6) }
  if (by.startsWith('invitee:')) return { kind: 'invitee', name: by.slice(8) }
  if (by.startsWith('peer:')) {
    const rest = by.slice(5)
    const slash = rest.indexOf('/')
    if (slash === -1) return { kind: 'peer', name: rest, via: { kind: 'person' } }
    const label = rest.slice(0, slash)
    const what = rest.slice(slash + 1)
    if (what === 'tracker') return { kind: 'peer', name: label, via: { kind: 'tracker' } }
    if (what.startsWith('agent:'))
      return { kind: 'peer', name: label, via: { kind: 'agent', name: what.slice(6) } }
    return { kind: 'peer', name: label, via: { kind: 'person' } }
  }
  return { kind: 'you', name: null }
}

/**
 * How the window names a person known by a `peer:` label or an invitee's email: the name they gave
 * (`names`, from the share's participants and comments), else an email's local part capitalised
 * ("ben@x.com" → "Ben"), else the label itself.
 */
export function personName(label: string, names?: ReadonlyMap<string, string>): string {
  const known = names?.get(label.toLowerCase())
  if (known) return known
  const at = label.indexOf('@')
  if (at <= 0) return label
  const local = label.slice(0, at).split(/[._+-]/)[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : label
}

/** The latest status change of an item, from a history (oldest first). */
export function lastChange(history: readonly StatusChange[], itemId: string): StatusChange | null {
  for (let i = history.length - 1; i >= 0; i--) if (history[i]!.itemId === itemId) return history[i]!
  return null
}

export const itemHistory = (history: readonly StatusChange[], itemId: string): StatusChange[] =>
  history.filter((h) => h.itemId === itemId)

/** Open, unexpired suggestions, newest first. */
export function activeSuggestions(view: AgendaView, now: number): Suggestion[] {
  return view.suggestions
    .filter((s) => s.state === 'open' && (s.expiresAt === null || Date.parse(s.expiresAt) > now))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

const OPEN: ReadonlySet<AgendaItemStatus> = new Set(['open', 'in-progress'])
export const isOpenItem = (i: AgendaItem) => OPEN.has(i.status)

/** Counts per status, for the header ("3 of 7 covered"). */
export function statusCounts(items: readonly AgendaItem[]): Record<AgendaItemStatus, number> {
  const c: Record<AgendaItemStatus, number> = { open: 0, 'in-progress': 0, covered: 0, skipped: 0, parked: 0 }
  for (const i of items) c[i.status]++
  return c
}

/** Items that will roll to the next occurrence of a recurring meeting (unresolved: open, in progress, parked). */
export function carriesOver(view: AgendaView): AgendaItem[] {
  if (!view.agenda.meeting?.recurring) return []
  return [...view.items].sort(byOrder).filter((i) => i.status !== 'covered' && i.status !== 'skipped')
}

/**
 * An item's recap, read from its outcome. The daemon's recap (agendas/recap.ts formatOutcome) writes the
 * outcome sentence(s), then `Decisions:` / `Actions:` blocks of `- …` lines (`- Owner: action`); the recap
 * prompt's raw form (`Status:` / `Outcome:` headers) reads the same. A plain outcome is just the outcome.
 */
export type ItemRecap = {
  outcome: string | null
  decisions: string[]
  actions: { owner: string | null; text: string }[]
}

export function parseRecapOutcome(text: string | null): ItemRecap {
  const r: ItemRecap = { outcome: null, decisions: [], actions: [] }
  if (!text?.trim()) return r
  const lines = text.split('\n').map((l) => l.trim())
  if (!lines.some((l) => /^(outcome|decisions?|actions?)\s*:/i.test(l))) {
    r.outcome = text.trim()
    return r
  }
  // the daemon's recap (formatOutcome) leads with the outcome sentence(s), no header; the prompt's own
  // form says `Outcome:`. Lines before any header are the outcome either way.
  let block: 'outcome' | 'decisions' | 'actions' | null = 'outcome'
  const outcome: string[] = []
  for (const l of lines) {
    if (!l) continue
    const head = /^(status|outcome|decisions?|actions?)\s*:\s*(.*)$/i.exec(l)
    if (head) {
      const k = head[1]!.toLowerCase()
      const rest = head[2]!.trim()
      block =
        k === 'status'
          ? null
          : k === 'outcome'
            ? 'outcome'
            : k.startsWith('decision')
              ? 'decisions'
              : 'actions'
      if (rest && block === 'outcome') outcome.push(rest)
      else if (rest && block === 'decisions') r.decisions.push(rest)
      else if (rest && block === 'actions') r.actions.push(recapAction(rest))
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(l)?.[1]
    if (block === 'decisions') r.decisions.push(bullet ?? l)
    else if (block === 'actions') r.actions.push(recapAction(bullet ?? l))
    else if (block === 'outcome') outcome.push(l)
  }
  r.outcome = outcome.join(' ') || null
  return r
}

function recapAction(s: string): { owner: string | null; text: string } {
  const m = /^([^:]{1,60}):\s+(.+)$/.exec(s)
  return m ? { owner: m[1]!.trim(), text: m[2]!.trim() } : { owner: null, text: s }
}
