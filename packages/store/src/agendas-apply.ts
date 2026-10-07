import type {
  Agenda,
  AgendaItem,
  AgendaMeeting,
  ContextCard,
  DurableEventData,
  Evidence,
  StatusChange,
  Suggestion,
} from '@kacola/protocol'
import type { Row } from './rows.ts'

// Agendas — how their events become rows, in both dialects. Driver-free (the hosted bundle imports it).
//
// Every agenda event carries the full post-state of what it writes (see protocol/agendas.ts), so
// applying one is a fixed list of statements that never reads state: `agendaOps` returns them with `?`
// placeholders, SQLite runs them as they are and Postgres numbers the placeholders. One list of
// statements for both dialects is what keeps replay == state identical across them.

export type AgendaEvent = Extract<
  DurableEventData,
  {
    type:
      | 'agenda.upserted'
      | 'agenda.deleted'
      | 'agenda.item.upserted'
      | 'agenda.item.status'
      | 'agenda.item.deleted'
      | 'agenda.items.reordered'
      | 'agenda.context.upserted'
      | 'agenda.context.deleted'
      | 'agenda.suggestion.upserted'
  }
>

export const isAgendaEvent = (d: DurableEventData): d is AgendaEvent => d.type.startsWith('agenda.')

export type SqlParam = string | number | null
export type Op = { sql: string; params: SqlParam[] }

const op = (sql: string, ...params: SqlParam[]): Op => ({ sql, params })

/** Which occurrence of an event an agenda is for: '' for a one-off (the UID alone identifies it). */
export function occurrenceKey(m: AgendaMeeting): string {
  return m.recurring ? new Date(m.recurrenceId ?? m.start).toISOString() : ''
}

function agendaData(a: Agenda): string {
  return JSON.stringify({
    title: a.title,
    meeting: a.meeting,
    owner: a.owner,
    goals: a.goals,
    carriedFrom: a.carriedFrom,
  })
}

function itemData(i: AgendaItem): string {
  const { id: _id, agendaId: _a, order: _o, status: _s, evidence: _e, ...rest } = i
  return JSON.stringify(rest)
}

const touch = (agendaId: string, version: number, at: string): Op =>
  op('UPDATE agendas SET version = ?, updated_at = ? WHERE id = ?', version, at, agendaId)

function upsertItem(i: AgendaItem): Op {
  return op(
    `INSERT INTO agenda_items (id, agenda_id, position, status, evidence, data) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET agenda_id = excluded.agenda_id, position = excluded.position,
       status = excluded.status, evidence = excluded.evidence, data = excluded.data`,
    i.id,
    i.agendaId,
    i.order,
    i.status,
    JSON.stringify(i.evidence),
    itemData(i),
  )
}

/** The statements that apply one agenda event. Pure: the same event always yields the same list. */
export function agendaOps(data: AgendaEvent): Op[] {
  switch (data.type) {
    case 'agenda.upserted': {
      const a = data.agenda
      return [
        op(
          `INSERT INTO agendas (id, meeting_uid, occurrence_key, meeting_start, session_id, private, version, created_at, updated_at, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET meeting_uid = excluded.meeting_uid, occurrence_key = excluded.occurrence_key,
             meeting_start = excluded.meeting_start, session_id = excluded.session_id, private = excluded.private,
             version = excluded.version, created_at = excluded.created_at, updated_at = excluded.updated_at,
             data = excluded.data`,
          a.id,
          a.meeting?.eventUid ?? null,
          a.meeting ? occurrenceKey(a.meeting) : null,
          a.meeting ? new Date(a.meeting.start).toISOString() : null,
          a.sessionId,
          a.private ? 1 : 0,
          a.version,
          a.createdAt,
          a.updatedAt,
          agendaData(a),
        ),
      ]
    }
    case 'agenda.deleted':
      return [
        op('DELETE FROM agenda_suggestions WHERE agenda_id = ?', data.agendaId),
        op('DELETE FROM agenda_context WHERE agenda_id = ?', data.agendaId),
        op('DELETE FROM agenda_item_history WHERE agenda_id = ?', data.agendaId),
        op('DELETE FROM agenda_items WHERE agenda_id = ?', data.agendaId),
        op('DELETE FROM agendas WHERE id = ?', data.agendaId),
      ]
    case 'agenda.item.upserted':
      return [upsertItem(data.item), touch(data.agendaId, data.version, data.at)]
    case 'agenda.item.status': {
      const { evidence, ...rest } = data.change
      return [
        upsertItem(data.item),
        op(
          'INSERT INTO agenda_item_history (agenda_id, version, item_id, evidence, data) VALUES (?, ?, ?, ?, ?)',
          data.agendaId,
          data.version,
          data.change.itemId,
          JSON.stringify(evidence),
          JSON.stringify(rest),
        ),
        touch(data.agendaId, data.version, data.at),
      ]
    }
    case 'agenda.item.deleted':
      return [
        op('DELETE FROM agenda_item_history WHERE item_id = ?', data.itemId),
        op('DELETE FROM agenda_items WHERE id = ?', data.itemId),
        touch(data.agendaId, data.version, data.at),
      ]
    case 'agenda.items.reordered':
      return [
        ...data.itemIds.map((id, position) =>
          op(
            'UPDATE agenda_items SET position = ? WHERE id = ? AND agenda_id = ?',
            position,
            id,
            data.agendaId,
          ),
        ),
        touch(data.agendaId, data.version, data.at),
      ]
    case 'agenda.context.upserted': {
      const c = data.card
      return [
        op(
          `INSERT INTO agenda_context (id, agenda_id, data) VALUES (?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET agenda_id = excluded.agenda_id, data = excluded.data`,
          c.id,
          c.agendaId,
          JSON.stringify(c),
        ),
        touch(data.agendaId, data.version, data.at),
      ]
    }
    case 'agenda.context.deleted':
      return [
        op('DELETE FROM agenda_context WHERE id = ?', data.cardId),
        touch(data.agendaId, data.version, data.at),
      ]
    case 'agenda.suggestion.upserted': {
      const s = data.suggestion
      return [
        op(
          `INSERT INTO agenda_suggestions (id, agenda_id, state, data) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET agenda_id = excluded.agenda_id, state = excluded.state, data = excluded.data`,
          s.id,
          s.agendaId,
          s.state,
          JSON.stringify(s),
        ),
      ]
    }
  }
}

/**
 * Part of `session.deleted`: agendas outlive their recording, but lose the link to it and every quote
 * taken from its transcript (evidence), so nothing of a deleted meeting's words survives in them.
 */
export function sessionDeletedAgendaOps(sessionId: string): Op[] {
  const linked = 'SELECT id FROM agendas WHERE session_id = ?'
  return [
    op(`UPDATE agenda_items SET evidence = '[]' WHERE agenda_id IN (${linked})`, sessionId),
    op(`UPDATE agenda_item_history SET evidence = '[]' WHERE agenda_id IN (${linked})`, sessionId),
    op('UPDATE agendas SET session_id = NULL WHERE session_id = ?', sessionId),
  ]
}

// ------------------------------------------------------------------------------------------ rows

export function rowToAgenda(r: Row): Agenda {
  const d = JSON.parse(r.data as string) as Pick<
    Agenda,
    'title' | 'meeting' | 'owner' | 'goals' | 'carriedFrom'
  >
  return {
    id: r.id as string,
    title: d.title,
    meeting: d.meeting,
    sessionId: (r.session_id as string | null) ?? null,
    owner: d.owner,
    goals: d.goals,
    private: Number(r.private) === 1,
    carriedFrom: d.carriedFrom,
    version: Number(r.version),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export function rowToItem(r: Row): AgendaItem {
  const d = JSON.parse(r.data as string) as Omit<
    AgendaItem,
    'id' | 'agendaId' | 'order' | 'status' | 'evidence'
  >
  return {
    id: r.id as string,
    agendaId: r.agenda_id as string,
    text: d.text,
    kind: d.kind,
    owner: d.owner,
    timeboxMin: d.timeboxMin,
    order: Number(r.position),
    status: r.status as AgendaItem['status'],
    evidence: JSON.parse(r.evidence as string) as Evidence[],
    outcome: d.outcome,
    changedBy: d.changedBy,
    createdBy: d.createdBy,
    carriedFrom: d.carriedFrom,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

export function rowToChange(r: Row): StatusChange {
  const d = JSON.parse(r.data as string) as Omit<StatusChange, 'evidence'>
  return {
    itemId: d.itemId,
    from: d.from,
    to: d.to,
    by: d.by,
    at: d.at,
    note: d.note,
    evidence: JSON.parse(r.evidence as string) as Evidence[],
    override: d.override,
    auto: d.auto,
    confidence: d.confidence,
  }
}

export const rowToCard = (r: Row): ContextCard => JSON.parse(r.data as string) as ContextCard
export const rowToSuggestion = (r: Row): Suggestion => JSON.parse(r.data as string) as Suggestion

/** The agenda tables' canonical order for snapshots (both dialects sort the same way). */
export const AGENDA_SNAPSHOT_QUERIES = {
  agendas: 'SELECT * FROM agendas ORDER BY id',
  items: 'SELECT * FROM agenda_items ORDER BY id',
  history: 'SELECT * FROM agenda_item_history ORDER BY agenda_id, version',
  context: 'SELECT * FROM agenda_context ORDER BY id',
  suggestions: 'SELECT * FROM agenda_suggestions ORDER BY id',
} as const

/** The agenda part of a DomainSnapshot, from whatever runs a query (both dialects). */
export function agendaSnapshot(all: (q: string) => Row[]) {
  return {
    agendas: all(AGENDA_SNAPSHOT_QUERIES.agendas).map(rowToAgenda),
    agendaItems: all(AGENDA_SNAPSHOT_QUERIES.items).map(rowToItem),
    agendaHistory: all(AGENDA_SNAPSHOT_QUERIES.history).map(rowToChange),
    agendaContext: all(AGENDA_SNAPSHOT_QUERIES.context).map(rowToCard),
    agendaSuggestions: all(AGENDA_SNAPSHOT_QUERIES.suggestions).map(rowToSuggestion),
  }
}
