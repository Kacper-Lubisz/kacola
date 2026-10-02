import {
  type Agenda,
  type AgendaCounts,
  type AgendaItem,
  type AgendaItemStatus,
  type AgendaMeeting,
  type AgendaSummary,
  type AgendaView,
  type ChangedBy,
  type ContextCard,
  type ContextSource,
  type DurableEventData,
  type Evidence,
  type ItemCause,
  isForwardMove,
  isPeer,
  isPeerHuman,
  NewAgendaItem,
  newAgendaId,
  parseAgendaMarkdown,
  RESOLVED_STATUSES,
  type StatusChange,
  type Suggestion,
  type SuggestionKind,
  type SuggestionProposal,
  UpdateItemBody,
} from '@gnomeola/protocol'
import type Database from 'better-sqlite3'
import {
  type AgendaEvent,
  agendaOps,
  type Op,
  occurrenceKey,
  rowToAgenda,
  rowToCard,
  rowToChange,
  rowToItem,
  rowToSuggestion,
  sessionDeletedAgendaOps,
} from './agendas-apply.ts'
import { StoreError } from './errors.ts'
import type { Row } from './rows.ts'
import type { Store } from './store.ts'

// Agendas on the local (SQLite) store. Same discipline as notes: every change is a durable event
// committed through `store.commit()`, built from current state inside the transaction; the tables are
// written only by the statements in ./agendas-apply.ts, so replay == state.
//
// The domain rules live here, next to the data they guard:
//   - one agenda per calendar occurrence (eventUid + occurrence key);
//   - item statuses move forward only, except for the user, whose backward moves are overrides that an
//     automated changer (tracker, agent) may then not undo — "manual wins";
//   - every status change is recorded, with who made it;
//   - an agenda linked to a private session, or marked private, is invisible without includePrivate.

const prepared = new WeakMap<Database.Database, Map<string, Database.Statement>>()
function stmt(db: Database.Database, q: string): Database.Statement {
  let m = prepared.get(db)
  if (!m) {
    m = new Map()
    prepared.set(db, m)
  }
  let s = m.get(q)
  if (!s) {
    s = db.prepare(q)
    m.set(q, s)
  }
  return s
}

export function runOps(db: Database.Database, ops: Op[]): void {
  for (const o of ops) stmt(db, o.sql).run(...o.params)
}

/** Tables are a function of the log: the only code that writes the agenda tables (SQLite). */
export function applyAgendaEvent(db: Database.Database, data: AgendaEvent): void {
  runOps(db, agendaOps(data))
}

export function detachAgendasOf(db: Database.Database, sessionId: string): void {
  runOps(db, sessionDeletedAgendaOps(sessionId))
}

// ------------------------------------------------------------------------------------ inputs

/** A new item as a client describes it (validated and defaulted on the way in). */
export type NewItemInput = NewAgendaItem

export type CreateAgendaInput = {
  title: string
  meeting?: AgendaMeeting | null
  owner?: string
  goals?: string[]
  private?: boolean
  items?: NewItemInput[]
  /** Carry over the unresolved items of this agenda (the previous occurrence). */
  carryFrom?: string | null
  by?: ChangedBy
  id?: string
}

export type StatusInput = {
  status: AgendaItemStatus
  by?: ChangedBy
  evidence?: Evidence[]
  note?: string
  outcome?: string
  auto?: boolean
  confidence?: number
}

export type ItemPatch = {
  text?: string
  kind?: AgendaItem['kind']
  owner?: string | null
  timeboxMin?: number | null
  outcome?: string | null
}

/** One item event from the log, with its seq (item history; see AgendaStore.itemEvents). */
export type ItemEvent = {
  seq: number
  data: Extract<
    DurableEventData,
    { type: 'agenda.item.upserted' | 'agenda.item.status' | 'agenda.item.deleted' }
  >
}

const ITEM_EVENTS: ReadonlySet<string> = new Set([
  'agenda.item.upserted',
  'agenda.item.status',
  'agenda.item.deleted',
])

export type ListAgendasOptions = {
  eventUid?: string
  sessionId?: string
  since?: Date
  limit?: number
  includePrivate?: boolean
}

const EMPTY_COUNTS = (): AgendaCounts => ({
  items: 0,
  open: 0,
  inProgress: 0,
  covered: 0,
  skipped: 0,
  parked: 0,
})

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Agenda operations over a Store. Stateless: construct one wherever it is needed. */
export class AgendaStore {
  private readonly store: Store
  constructor(store: Store) {
    this.store = store
  }

  private get db(): Database.Database {
    return this.store.db
  }

  private rows(q: string, ...params: unknown[]): Row[] {
    return stmt(this.db, q).all(...params) as Row[]
  }

  // ---------------------------------------------------------------------------------- reads

  get(id: string): Agenda | null {
    const r = stmt(this.db, 'SELECT * FROM agendas WHERE id = ?').get(id) as Row | undefined
    return r ? rowToAgenda(r) : null
  }

  /** Whether the agent surfaces may see it: not private, and not linked to a private session. */
  isVisible(a: Agenda, includePrivate?: boolean): boolean {
    if (includePrivate) return true
    if (a.private) return false
    if (a.sessionId) return !this.store.getSession(a.sessionId)?.private
    return true
  }

  items(agendaId: string): AgendaItem[] {
    return this.rows('SELECT * FROM agenda_items WHERE agenda_id = ? ORDER BY position, id', agendaId).map(
      rowToItem,
    )
  }

  item(agendaId: string, itemId: string): AgendaItem | null {
    const r = stmt(this.db, 'SELECT * FROM agenda_items WHERE id = ? AND agenda_id = ?').get(
      itemId,
      agendaId,
    ) as Row | undefined
    return r ? rowToItem(r) : null
  }

  context(agendaId: string): ContextCard[] {
    return this.rows('SELECT * FROM agenda_context WHERE agenda_id = ? ORDER BY id', agendaId).map(rowToCard)
  }

  card(agendaId: string, cardId: string): ContextCard | null {
    const r = stmt(this.db, 'SELECT * FROM agenda_context WHERE id = ? AND agenda_id = ?').get(
      cardId,
      agendaId,
    ) as Row | undefined
    return r ? rowToCard(r) : null
  }

  suggestions(agendaId: string): Suggestion[] {
    return this.rows('SELECT * FROM agenda_suggestions WHERE agenda_id = ? ORDER BY id', agendaId).map(
      rowToSuggestion,
    )
  }

  suggestion(agendaId: string, id: string): Suggestion | null {
    const r = stmt(this.db, 'SELECT * FROM agenda_suggestions WHERE id = ? AND agenda_id = ?').get(
      id,
      agendaId,
    ) as Row | undefined
    return r ? rowToSuggestion(r) : null
  }

  /** Every status change of the agenda, oldest first. */
  history(agendaId: string): StatusChange[] {
    return this.rows('SELECT * FROM agenda_item_history WHERE agenda_id = ? ORDER BY version', agendaId).map(
      rowToChange,
    )
  }

  view(id: string): AgendaView | null {
    const agenda = this.get(id)
    if (!agenda) return null
    return {
      agenda,
      items: this.items(id),
      context: this.context(id),
      suggestions: this.suggestions(id),
    }
  }

  counts(agendaId: string): AgendaCounts {
    const out = EMPTY_COUNTS()
    for (const r of this.rows(
      'SELECT status, count(*) AS n FROM agenda_items WHERE agenda_id = ? GROUP BY status',
      agendaId,
    )) {
      const n = Number(r.n)
      out.items += n
      const s = r.status as AgendaItemStatus
      if (s === 'in-progress') out.inProgress += n
      else out[s] += n
    }
    return out
  }

  /** Newest first (by last change). Private ones only with includePrivate. */
  list(o: ListAgendasOptions = {}): AgendaSummary[] {
    const where: string[] = []
    const params: unknown[] = []
    if (o.eventUid !== undefined) {
      where.push('a.meeting_uid = ?')
      params.push(o.eventUid)
    }
    if (o.sessionId !== undefined) {
      where.push('a.session_id = ?')
      params.push(o.sessionId)
    }
    if (o.since) {
      where.push('a.updated_at >= ?')
      params.push(o.since.toISOString())
    }
    if (!o.includePrivate) where.push('a.private = 0 AND coalesce(s.private, 0) = 0')
    const q = `SELECT a.* FROM agendas a LEFT JOIN sessions s ON s.id = a.session_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.updated_at DESC, a.id DESC LIMIT ?`
    return this.rows(q, ...params, o.limit ?? 50).map((r) => {
      const a = rowToAgenda(r)
      return { ...a, counts: this.counts(a.id) }
    })
  }

  /** The agenda of one occurrence, if it has one. */
  forOccurrence(
    meeting: Pick<AgendaMeeting, 'eventUid' | 'start' | 'recurrenceId' | 'recurring'>,
  ): Agenda | null {
    const key = occurrenceKey({ ...meeting, end: null, meetingId: null, title: '', calendar: null })
    const r = stmt(
      this.db,
      'SELECT * FROM agendas WHERE meeting_uid = ? AND occurrence_key = ? ORDER BY created_at, id LIMIT 1',
    ).get(meeting.eventUid, key) as Row | undefined
    return r ? rowToAgenda(r) : null
  }

  /** Every agenda of a calendar event (all occurrences), by occurrence start. */
  forEvent(eventUid: string): Agenda[] {
    return this.rows('SELECT * FROM agendas WHERE meeting_uid = ? ORDER BY meeting_start, id', eventUid).map(
      rowToAgenda,
    )
  }

  /** The agenda of the latest occurrence of the series that started before `start` (carry-over source). */
  previousOccurrence(eventUid: string, start: string): Agenda | null {
    const r = stmt(
      this.db,
      'SELECT * FROM agendas WHERE meeting_uid = ? AND meeting_start < ? ORDER BY meeting_start DESC, id DESC LIMIT 1',
    ).get(eventUid, new Date(start).toISOString()) as Row | undefined
    return r ? rowToAgenda(r) : null
  }

  bySession(sessionId: string): Agenda[] {
    return this.rows('SELECT * FROM agendas WHERE session_id = ? ORDER BY id', sessionId).map(rowToAgenda)
  }

  // --------------------------------------------------------------------------------- writes

  private require(id: string): Agenda {
    const a = this.get(id)
    if (!a) throw new StoreError('not_found', `no agenda ${id}`)
    return a
  }

  private requireItem(agendaId: string, itemId: string): AgendaItem {
    const i = this.item(agendaId, itemId)
    if (!i) throw new StoreError('not_found', `no item ${itemId} in agenda ${agendaId}`)
    return i
  }

  /** Commit one agenda-scoped event: `build` gets the next version and returns the event. */
  private scoped(agendaId: string, build: (version: number, at: string) => DurableEventData): void {
    this.store.commit(() => {
      const cur = this.require(agendaId)
      const at = this.nowIso()
      const data = build(cur.version + 1, at)
      // item history: an import or a restore marks every item event it makes
      if (this.cause && ITEM_EVENTS.has(data.type))
        return { sessionId: cur.sessionId, data: { ...data, cause: this.cause } }
      return { sessionId: cur.sessionId, data }
    })
  }

  /** Set while an import or a restore runs: its item events carry this `cause`. */
  private cause: ItemCause | null = null
  private withCause<T>(cause: ItemCause, fn: () => T): T {
    const prev = this.cause
    this.cause = cause
    try {
      return fn()
    } finally {
      this.cause = prev
    }
  }

  private clock: (() => Date) | null = null
  /** Use a fixed clock (tests, deterministic cross-dialect histories). */
  withClock(now: () => Date): this {
    this.clock = now
    return this
  }
  private nowIso(): string {
    return (this.clock ? this.clock() : new Date()).toISOString()
  }
  private nowMs(): number {
    return (this.clock ? this.clock() : new Date()).getTime()
  }

  /**
   * A new agenda (one transaction: the agenda, then each item — carried-over first, then the given ones,
   * then any status the given items arrive with, as history). Refuses a second agenda for an occurrence.
   */
  create(input: CreateAgendaInput): AgendaView {
    const by = input.by ?? 'user'
    const id = input.id ?? newAgendaId('agd', this.nowMs())
    this.store.transaction(() => {
      if (input.meeting) {
        const existing = this.forOccurrence(input.meeting)
        if (existing) throw new StoreError('conflict', `this meeting already has an agenda (${existing.id})`)
      }
      const at = this.nowIso()
      const carriedFrom = input.carryFrom ?? null
      const agenda: Agenda = {
        id,
        title: input.title.trim(),
        meeting: input.meeting ?? null,
        sessionId: null,
        owner: input.owner ?? 'me',
        goals: input.goals ?? [],
        private: input.private ?? false,
        carriedFrom,
        version: 1,
        createdAt: at,
        updatedAt: at,
      }
      this.store.commit(() => {
        if (this.get(id)) throw new StoreError('conflict', `agenda ${id} exists`)
        return { sessionId: null, data: { type: 'agenda.upserted', agenda } }
      })
      if (carriedFrom) {
        const prev = this.require(carriedFrom)
        const unresolved = this.items(prev.id).filter((i) => !RESOLVED_STATUSES.includes(i.status))
        this.insertItems(
          id,
          unresolved.map((i) => ({
            text: i.text,
            kind: i.kind,
            owner: i.owner,
            timeboxMin: i.timeboxMin,
            outcome: null,
            carriedFrom: { agendaId: prev.id, itemId: i.id },
          })),
          null,
          by,
        )
      }
      if (input.items?.length) this.addItems(id, input.items, { by })
    })
    return this.view(id)!
  }

  /** Header changes (title, goals, privacy, meeting link). */
  update(id: string, change: (a: Agenda) => Partial<Agenda>, baseVersion?: number): Agenda {
    let out: Agenda | undefined
    this.store.commit(() => {
      const cur = this.require(id)
      if (baseVersion !== undefined && cur.version !== baseVersion)
        throw new StoreError(
          'conflict',
          `agenda changed: it is at version ${cur.version}, not ${baseVersion}`,
        )
      const patch = change(cur)
      if (patch.meeting) {
        const other = this.forOccurrence(patch.meeting)
        if (other && other.id !== id)
          throw new StoreError('conflict', `that meeting already has an agenda (${other.id})`)
      }
      out = {
        ...cur,
        ...patch,
        id: cur.id,
        createdAt: cur.createdAt,
        version: cur.version + 1,
        updatedAt: this.nowIso(),
      }
      return { sessionId: out.sessionId, data: { type: 'agenda.upserted', agenda: out } }
    })
    return out!
  }

  /** Link the recorded session (recording started for this agenda's meeting). No-op when already linked. */
  attachSession(id: string, sessionId: string): Agenda {
    const cur = this.require(id)
    if (cur.sessionId === sessionId) return cur
    if (!this.store.getSession(sessionId)) throw new StoreError('not_found', `no session ${sessionId}`)
    return this.update(id, () => ({ sessionId }))
  }

  delete(id: string): void {
    this.store.commit(() => {
      const cur = this.require(id)
      return { sessionId: cur.sessionId, data: { type: 'agenda.deleted', agendaId: id } }
    })
  }

  private insertItems(
    agendaId: string,
    items: Omit<
      AgendaItem,
      | 'id'
      | 'agendaId'
      | 'order'
      | 'status'
      | 'evidence'
      | 'changedBy'
      | 'createdBy'
      | 'createdAt'
      | 'updatedAt'
    >[],
    before: string | null,
    by: ChangedBy,
  ): AgendaItem[] {
    const out: AgendaItem[] = []
    this.store.transaction(() => {
      const existing = this.items(agendaId)
      let at = before === null ? existing.length : existing.findIndex((i) => i.id === before)
      if (at === -1) throw new StoreError('not_found', `no item ${before} in agenda ${agendaId}`)
      for (const it of items) {
        const position = at++
        this.scoped(agendaId, (version, now) => {
          const item: AgendaItem = {
            id: newAgendaId('itm', this.nowMs()),
            agendaId,
            text: it.text,
            kind: it.kind,
            owner: it.owner,
            timeboxMin: it.timeboxMin,
            order: position,
            status: 'open',
            evidence: [],
            outcome: it.outcome,
            changedBy: by,
            createdBy: by,
            carriedFrom: it.carriedFrom,
            createdAt: now,
            updatedAt: now,
          }
          out.push(item)
          return { type: 'agenda.item.upserted', agendaId, version, at: now, item }
        })
      }
      // shift what was after the insertion point
      if (before !== null) {
        const ids = existing.map((i) => i.id)
        const idx = ids.indexOf(before)
        ids.splice(idx, 0, ...out.map((i) => i.id))
        this.reorder(agendaId, ids)
      }
    })
    return out.map((i) => this.item(agendaId, i.id)!)
  }

  /** Add items (at the end, or before one). An item may arrive with a status: that is a recorded change. */
  addItems(agendaId: string, raw: NewItemInput[], o: { before?: string; by?: ChangedBy } = {}): AgendaItem[] {
    const by = o.by ?? 'user'
    const items = raw.map((r) => NewAgendaItem.parse(r))
    let out: AgendaItem[] = []
    this.store.transaction(() => {
      this.require(agendaId)
      out = this.insertItems(
        agendaId,
        items.map((i) => ({
          text: i.text,
          kind: i.kind,
          owner: i.owner ?? null,
          timeboxMin: i.timeboxMin ?? null,
          outcome: i.outcome ?? null,
          carriedFrom: null,
        })),
        o.before ?? null,
        by,
      )
      out = out.map((item, n) => {
        const status = items[n]!.status
        return status && status !== 'open' ? this.setStatus(agendaId, item.id, { status, by }).item : item
      })
    })
    return out
  }

  updateItem(agendaId: string, itemId: string, patch: ItemPatch, by: ChangedBy = 'user'): AgendaItem {
    let out: AgendaItem | undefined
    this.scoped(agendaId, (version, at) => {
      const cur = this.requireItem(agendaId, itemId)
      // UpdateItemBody has no defaults: an absent field stays absent (NewAgendaItem would default kind)
      const parsed = UpdateItemBody.omit({ by: true }).parse({
        text: patch.text,
        kind: patch.kind,
        owner: patch.owner,
        timeboxMin: patch.timeboxMin,
        outcome: patch.outcome,
      })
      out = {
        ...cur,
        ...(parsed.text !== undefined ? { text: parsed.text } : {}),
        ...(parsed.kind !== undefined ? { kind: parsed.kind } : {}),
        ...(parsed.owner !== undefined ? { owner: parsed.owner } : {}),
        ...(parsed.timeboxMin !== undefined ? { timeboxMin: parsed.timeboxMin } : {}),
        ...(parsed.outcome !== undefined ? { outcome: parsed.outcome } : {}),
        changedBy: by,
        updatedAt: at,
      }
      return { type: 'agenda.item.upserted', agendaId, version, at, item: out }
    })
    return out!
  }

  deleteItem(agendaId: string, itemId: string, by: ChangedBy = 'user'): void {
    this.store.transaction(() => {
      const item = this.requireItem(agendaId, itemId)
      // the item as it was rides along, so its history can show what was removed and put it back
      this.scoped(agendaId, (version, at) => ({
        type: 'agenda.item.deleted',
        agendaId,
        version,
        at,
        itemId,
        by,
        item,
      }))
      // close the gap so positions stay 0..n-1
      const rest = this.items(agendaId)
      if (rest.some((i, n) => i.order !== n))
        this.reorder(
          agendaId,
          rest.map((i) => i.id),
        )
    })
  }

  /** `itemIds` must be exactly the agenda's items, in their new order. */
  reorder(agendaId: string, itemIds: string[]): number {
    let version = 0
    this.scoped(agendaId, (v, at) => {
      const ids = this.items(agendaId).map((i) => i.id)
      if (
        itemIds.length !== ids.length ||
        new Set(itemIds).size !== ids.length ||
        itemIds.some((i) => !ids.includes(i))
      )
        throw new StoreError('bad_request', 'the new order must list every item of the agenda exactly once')
      version = v
      return { type: 'agenda.items.reordered', agendaId, version: v, at, itemIds }
    })
    return version
  }

  /**
   * Change an item's status. The user may move it anywhere (a non-forward move is an override); anyone
   * else only forward, and never over the user's latest override. Moving to the status it already has
   * records no change (evidence/outcome given with it are still kept).
   */
  setStatus(
    agendaId: string,
    itemId: string,
    s: StatusInput,
  ): { item: AgendaItem; change: StatusChange | null } {
    const by = s.by ?? 'user'
    let item: AgendaItem | undefined
    let change: StatusChange | null = null
    this.store.transaction(() => {
      const cur = this.requireItem(agendaId, itemId)
      const newEvidence = s.evidence ?? []
      if (cur.status === s.status) {
        if (!newEvidence.length && s.outcome === undefined) {
          item = cur
          return
        }
        this.scoped(agendaId, (version, at) => {
          item = {
            ...cur,
            evidence: [...cur.evidence, ...newEvidence].slice(-20),
            ...(s.outcome !== undefined ? { outcome: s.outcome } : {}),
            changedBy: by,
            updatedAt: at,
          }
          return { type: 'agenda.item.upserted', agendaId, version, at, item }
        })
        return
      }
      const forward = isForwardMove(cur.status, s.status)
      if (by !== 'user') {
        if (!forward)
          throw new StoreError(
            'conflict',
            `${by} cannot move "${cur.text}" from ${cur.status} back to ${s.status}: only the user can`,
          )
        const last = this.history(agendaId)
          .filter((c) => c.itemId === itemId)
          .at(-1)
        // a person's override locks the item: the user's, or (team sharing) another attendee's in person
        if (last && (last.by === 'user' || isPeerHuman(last.by)) && last.override)
          throw new StoreError(
            'conflict',
            `the user set "${cur.text}" to ${cur.status} by hand; ${by} cannot change it (manual wins)`,
          )
      }
      this.scoped(agendaId, (version, at) => {
        change = {
          itemId,
          from: cur.status,
          to: s.status,
          by,
          at,
          note: s.note ?? null,
          evidence: newEvidence,
          override: !forward,
          auto: s.auto ?? false,
          confidence: s.confidence ?? null,
        }
        item = {
          ...cur,
          status: s.status,
          // evidence accumulates while an item moves forward; an override starts it afresh
          evidence: forward ? [...cur.evidence, ...newEvidence].slice(-20) : newEvidence,
          ...(s.outcome !== undefined ? { outcome: s.outcome } : {}),
          changedBy: by,
          updatedAt: at,
        }
        return { type: 'agenda.item.status', agendaId, version, at, item, change }
      })
    })
    return { item: item!, change }
  }

  addContext(
    agendaId: string,
    c: {
      title: string
      body: string
      source?: ContextSource
      visibility?: 'private' | 'shared'
      pinned?: boolean
      by?: ChangedBy
    },
  ): ContextCard {
    let out: ContextCard | undefined
    this.scoped(agendaId, (version, at) => {
      out = {
        id: newAgendaId('ctx', this.nowMs()),
        agendaId,
        title: c.title.trim(),
        body: c.body,
        source: c.source ?? { kind: 'user', ref: null },
        visibility: c.visibility ?? 'private',
        pinned: c.pinned ?? false,
        createdBy: c.by ?? 'user',
        createdAt: at,
        updatedAt: at,
      }
      return { type: 'agenda.context.upserted', agendaId, version, at, card: out }
    })
    return out!
  }

  updateContext(
    agendaId: string,
    cardId: string,
    patch: Partial<Omit<ContextCard, 'id' | 'agendaId' | 'createdAt' | 'createdBy'>>,
  ): ContextCard {
    let out: ContextCard | undefined
    this.scoped(agendaId, (version, at) => {
      const cur = this.card(agendaId, cardId)
      if (!cur) throw new StoreError('not_found', `no context card ${cardId} in agenda ${agendaId}`)
      out = {
        ...cur,
        ...patch,
        id: cur.id,
        agendaId,
        createdAt: cur.createdAt,
        createdBy: cur.createdBy,
        updatedAt: at,
      }
      return { type: 'agenda.context.upserted', agendaId, version, at, card: out }
    })
    return out!
  }

  deleteContext(agendaId: string, cardId: string): void {
    this.scoped(agendaId, (version, at) => {
      if (!this.card(agendaId, cardId))
        throw new StoreError('not_found', `no context card ${cardId} in agenda ${agendaId}`)
      return { type: 'agenda.context.deleted', agendaId, version, at, cardId }
    })
  }

  addSuggestion(
    agendaId: string,
    s: {
      kind: SuggestionKind
      text: string
      itemId?: string | null
      source: ChangedBy
      ttlSec?: number
      /** Agent channel: the change accepting it applies (a suggest-mode agent's status change / item). */
      proposal?: SuggestionProposal | null
    },
  ): Suggestion {
    let out: Suggestion | undefined
    this.store.commit(() => {
      const a = this.require(agendaId)
      if (s.itemId) this.requireItem(agendaId, s.itemId)
      const now = this.nowMs()
      out = {
        id: newAgendaId('sug', now),
        agendaId,
        kind: s.kind,
        text: s.text.trim(),
        itemId: s.itemId ?? null,
        source: s.source,
        createdAt: new Date(now).toISOString(),
        expiresAt: s.ttlSec ? new Date(now + s.ttlSec * 1000).toISOString() : null,
        state: 'open',
        resolvedAt: null,
        resolvedBy: null,
        ...(s.proposal ? { proposal: s.proposal } : {}),
      }
      return {
        sessionId: a.sessionId,
        data: { type: 'agenda.suggestion.upserted', agendaId, suggestion: out },
      }
    })
    return out!
  }

  /**
   * Accept or dismiss a suggestion. Accepting a `looks-covered` suggestion marks its item covered — by
   * the person who accepted it, with the suggestion as the note.
   */
  resolveSuggestion(
    agendaId: string,
    id: string,
    action: 'accept' | 'dismiss',
    by: ChangedBy = 'user',
  ): { suggestion: Suggestion; item: AgendaItem | null } {
    let suggestion: Suggestion | undefined
    let item: AgendaItem | null = null
    this.store.transaction(() => {
      const cur = this.suggestion(agendaId, id)
      if (!cur) throw new StoreError('not_found', `no suggestion ${id} in agenda ${agendaId}`)
      if (cur.state !== 'open') throw new StoreError('conflict', `suggestion ${id} was already ${cur.state}`)
      const a = this.require(agendaId)
      suggestion = {
        ...cur,
        state: action === 'accept' ? 'accepted' : 'dismissed',
        resolvedAt: this.nowIso(),
        resolvedBy: by,
      }
      const s = suggestion
      this.store.commit(() => ({
        sessionId: a.sessionId,
        data: { type: 'agenda.suggestion.upserted', agendaId, suggestion: s },
      }))
      const p = cur.proposal
      if (action === 'accept' && p?.kind === 'status' && cur.itemId) {
        // a suggest-mode agent's status change, applied as the acceptor (the user may move anything)
        item = this.setStatus(agendaId, cur.itemId, {
          status: p.status,
          by,
          // proposals keep segment ids, not words (a deleted recording leaves nothing behind in them):
          // the quote is read back from the transcript now, if it is still there
          evidence: p.evidence.map((e) => ({
            ...e,
            quote:
              e.quote || (e.segmentId ? (this.store.getSegment(e.segmentId)?.text ?? '').slice(0, 500) : ''),
          })),
          note: p.note ?? `accepted: ${cur.text}`,
          ...(p.outcome !== null ? { outcome: p.outcome } : {}),
        }).item
      } else if (action === 'accept' && p?.kind === 'add-item') {
        const [added] = this.addItems(agendaId, [p.item], { by })
        item = added ?? null
      } else if (action === 'accept' && cur.kind === 'looks-covered' && cur.itemId) {
        const target = this.requireItem(agendaId, cur.itemId)
        if (target.status !== 'covered')
          item = this.setStatus(agendaId, cur.itemId, {
            status: 'covered',
            by,
            note: `accepted: ${cur.text}`,
          }).item
        else item = target
      } else if (cur.itemId) item = this.item(agendaId, cur.itemId)
    })
    return { suggestion: suggestion!, item }
  }

  // ------------------------------------------------------------------- team sharing: the mirror
  //
  // What another device did on a shared agenda, as the hosted server decided it, written here by the
  // share sync. These bypass the forward-only rules on purpose — the server already judged the change
  // against every device's history — but they only ever carry a `peer:` or `invitee:` attribution, which
  // no request body can claim, so nothing local can use them to skip the rules.

  private requireMirrorBy(by: ChangedBy): void {
    if (!isPeer(by) && !by.startsWith('invitee:'))
      throw new StoreError('bad_request', `mirrored changes are attributed to peer:… or invitee:…, not ${by}`)
  }

  /** Create (with the shared id) or update an item that another device owns. Never touches the status. */
  mirrorItem(
    agendaId: string,
    i: {
      id: string
      text: string
      kind: AgendaItem['kind']
      owner: string | null
      timeboxMin: number | null
      outcome?: string | null
      carriedFrom?: AgendaItem['carriedFrom']
    },
    by: ChangedBy,
  ): AgendaItem {
    this.requireMirrorBy(by)
    let out: AgendaItem | undefined
    this.scoped(agendaId, (version, at) => {
      const cur = this.item(agendaId, i.id)
      out = cur
        ? {
            ...cur,
            text: i.text,
            kind: i.kind,
            owner: i.owner,
            timeboxMin: i.timeboxMin,
            ...(i.outcome !== undefined ? { outcome: i.outcome } : {}),
            changedBy: by,
            updatedAt: at,
          }
        : {
            id: i.id,
            agendaId,
            text: i.text,
            kind: i.kind,
            owner: i.owner,
            timeboxMin: i.timeboxMin,
            order: this.items(agendaId).length,
            status: 'open',
            evidence: [],
            outcome: i.outcome ?? null,
            changedBy: by,
            createdBy: by,
            carriedFrom: i.carriedFrom ?? null,
            createdAt: at,
            updatedAt: at,
          }
      return { type: 'agenda.item.upserted', agendaId, version, at, item: out }
    })
    return out!
  }

  /** The status the hosted server settled on, attributed to the device that set it. No evidence crosses. */
  mirrorStatus(
    agendaId: string,
    itemId: string,
    to: AgendaItemStatus,
    by: ChangedBy,
    o: { auto?: boolean; confidence?: number | null } = {},
  ): { item: AgendaItem; change: StatusChange | null } {
    this.requireMirrorBy(by)
    let item: AgendaItem | undefined
    let change: StatusChange | null = null
    this.store.transaction(() => {
      const cur = this.requireItem(agendaId, itemId)
      if (cur.status === to) {
        item = cur
        return
      }
      const forward = isForwardMove(cur.status, to)
      this.scoped(agendaId, (version, at) => {
        change = {
          itemId,
          from: cur.status,
          to,
          by,
          at,
          note: null,
          evidence: [],
          override: !forward,
          auto: o.auto ?? false,
          confidence: o.confidence ?? null,
        }
        item = { ...cur, status: to, evidence: forward ? cur.evidence : [], changedBy: by, updatedAt: at }
        return { type: 'agenda.item.status', agendaId, version, at, item, change }
      })
    })
    return { item: item!, change }
  }

  /** A context card the owner shared, on a member's copy (same id; read-only there). */
  mirrorCard(
    agendaId: string,
    c: { id: string; title: string; body: string; pinned: boolean; sourceUrl: string | null },
    by: ChangedBy,
  ): ContextCard {
    this.requireMirrorBy(by)
    let out: ContextCard | undefined
    this.scoped(agendaId, (version, at) => {
      const cur = this.card(agendaId, c.id)
      out = {
        id: c.id,
        agendaId,
        title: c.title,
        body: c.body,
        source: c.sourceUrl ? { kind: 'url', ref: c.sourceUrl } : { kind: 'user', ref: null },
        visibility: 'shared',
        pinned: c.pinned,
        createdBy: cur?.createdBy ?? by,
        createdAt: cur?.createdAt ?? at,
        updatedAt: at,
      }
      return { type: 'agenda.context.upserted', agendaId, version, at, card: out }
    })
    return out!
  }

  /**
   * Apply the markdown form (see protocol agendas-markdown.ts) as the user's edit: items are matched to
   * existing ones by text; matched items take the markdown's kind/owner/timebox/outcome/status (status
   * through setStatus, so it is recorded); new ones are added; in `replace` mode items absent from the
   * markdown are deleted. The title and goals follow the markdown when it has them. One transaction.
   */
  importMarkdown(
    agendaId: string,
    markdown: string,
    baseVersion: number,
    mode: 'replace' | 'merge' = 'replace',
    by: ChangedBy = 'user',
  ): AgendaView {
    const md = parseAgendaMarkdown(markdown)
    this.withCause('import', () => this.importIn(agendaId, md, baseVersion, mode, by))
    return this.view(agendaId)!
  }

  private importIn(
    agendaId: string,
    md: ReturnType<typeof parseAgendaMarkdown>,
    baseVersion: number,
    mode: 'replace' | 'merge',
    by: ChangedBy,
  ): void {
    this.store.transaction(() => {
      const a = this.require(agendaId)
      if (a.version !== baseVersion)
        throw new StoreError(
          'conflict',
          `agenda changed: it is at version ${a.version}, not ${baseVersion}; export it again and reapply`,
        )
      const titleChanged = md.title !== null && md.title !== a.title
      const goalsChanged = md.goals.length > 0 && JSON.stringify(md.goals) !== JSON.stringify(a.goals)
      if (titleChanged || goalsChanged)
        this.update(agendaId, () => ({
          ...(titleChanged ? { title: md.title! } : {}),
          ...(goalsChanged ? { goals: md.goals } : {}),
        }))
      const existing = this.items(agendaId)
      const unused = new Map(existing.map((i) => [i.id, i]))
      const order: string[] = []
      for (const m of md.items) {
        const match = [...unused.values()].find((i) => norm(i.text) === norm(m.text))
        let id: string
        if (match) {
          unused.delete(match.id)
          id = match.id
          const patch: ItemPatch = {}
          if (match.text !== m.text) patch.text = m.text
          if (match.kind !== m.kind) patch.kind = m.kind
          if (match.owner !== m.owner) patch.owner = m.owner
          if (match.timeboxMin !== m.timeboxMin) patch.timeboxMin = m.timeboxMin
          if ((match.outcome ?? null) !== m.outcome) patch.outcome = m.outcome
          if (Object.keys(patch).length) this.updateItem(agendaId, id, patch, by)
          if (match.status !== m.status) this.setStatus(agendaId, id, { status: m.status, by })
        } else {
          id = this.addItems(agendaId, [m], { by })[0]!.id
        }
        order.push(id)
      }
      if (mode === 'replace') for (const i of unused.values()) this.deleteItem(agendaId, i.id, by)
      else order.push(...[...unused.values()].map((i) => i.id))
      const now = this.items(agendaId).map((i) => i.id)
      if (order.length === now.length && order.some((id, n) => now[n] !== id)) this.reorder(agendaId, order)
    })
  }

  // ------------------------------------------------------------------------------ item history

  /**
   * Every add, edit, status change and removal of an agenda's items, oldest first, from the event log
   * (removed items included: the history outlives the item). `seq` identifies a version for restore.
   */
  itemEvents(agendaId: string, itemId?: string): ItemEvent[] {
    const rows = this.rows(
      `SELECT seq, data FROM events
        WHERE type IN ('agenda.item.upserted', 'agenda.item.status', 'agenda.item.deleted')
          AND json_extract(data, '$.agendaId') = ?
        ORDER BY seq`,
      agendaId,
    ) as { seq: number; data: string }[]
    const out: ItemEvent[] = []
    for (const r of rows) {
      const data = JSON.parse(r.data) as ItemEvent['data']
      const id = data.type === 'agenda.item.deleted' ? data.itemId : data.item.id
      if (itemId === undefined || id === itemId) out.push({ seq: r.seq, data })
    }
    return out
  }

  /**
   * Put an item back as it was after event `seq` (its text, kind, owner, timebox, outcome and status),
   * as `by`. A removed item comes back with its id, at its old position. Every change it makes is an
   * ordinary item event marked `restore`, so the history shows the restore and it can be undone too.
   */
  restoreItem(agendaId: string, itemId: string, seq: number, by: ChangedBy = 'user'): AgendaItem {
    return this.withCause('restore', () => {
      let out: AgendaItem | undefined
      this.store.transaction(() => {
        this.require(agendaId)
        const ev = this.itemEvents(agendaId, itemId).find((e) => e.seq === seq)
        if (!ev) throw new StoreError('not_found', `no version ${seq} of item ${itemId}`)
        const target = ev.data.type === 'agenda.item.deleted' ? ev.data.item : ev.data.item
        if (!target)
          throw new StoreError('bad_request', `version ${seq} of item ${itemId} has no content to restore`)
        let cur = this.item(agendaId, itemId)
        if (!cur) {
          // re-add it with its id (open, then its status as a recorded change), at its old position
          const at = Math.min(target.order, this.items(agendaId).length)
          this.scoped(agendaId, (version, now) => {
            cur = {
              ...target,
              order: this.items(agendaId).length,
              status: 'open',
              evidence: [],
              changedBy: by,
              updatedAt: now,
            }
            return { type: 'agenda.item.upserted', agendaId, version, at: now, item: cur }
          })
          const ids = this.items(agendaId)
            .map((i) => i.id)
            .filter((i) => i !== itemId)
          ids.splice(at, 0, itemId)
          if (ids.some((id, n) => this.items(agendaId)[n]?.id !== id)) this.reorder(agendaId, ids)
          cur = this.item(agendaId, itemId)!
        }
        const patch: ItemPatch = {}
        if (cur.text !== target.text) patch.text = target.text
        if (cur.kind !== target.kind) patch.kind = target.kind
        if (cur.owner !== target.owner) patch.owner = target.owner
        if (cur.timeboxMin !== target.timeboxMin) patch.timeboxMin = target.timeboxMin
        if (cur.outcome !== target.outcome) patch.outcome = target.outcome
        if (Object.keys(patch).length) this.updateItem(agendaId, itemId, patch, by)
        if (cur.status !== target.status)
          this.setStatus(agendaId, itemId, { status: target.status, by, note: 'restored from history' })
        out = this.item(agendaId, itemId)!
      })
      return out!
    })
  }
}
