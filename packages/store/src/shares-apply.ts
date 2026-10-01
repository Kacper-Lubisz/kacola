import type {
  DurableEventData,
  Share,
  SharedCard,
  SharedChange,
  SharedComment,
  SharedItem,
  ShareParticipant,
} from '@gnomeola/protocol'
import type { Op, SqlParam } from './agendas-apply.ts'
import type { Row } from './rows.ts'

// Team sharing — how `share.*` events become rows, in both dialects (driver-free: the hosted bundle
// imports it). Same discipline as ./agendas-apply.ts: every event carries the post-state it writes, so
// applying one is a fixed list of `?` statements that never reads state.

export type ShareEvent = Extract<DurableEventData, { type: `share.${string}` }>

export const isShareEvent = (d: DurableEventData): d is ShareEvent => d.type.startsWith('share.')

const op = (sql: string, ...params: SqlParam[]): Op => ({ sql, params })

function upsertItem(shareId: string, i: SharedItem): Op {
  return op(
    `INSERT INTO share_items (share_id, id, occurrence, position, status, data) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (share_id, id) DO UPDATE SET occurrence = excluded.occurrence, position = excluded.position,
       status = excluded.status, data = excluded.data`,
    shareId,
    i.id,
    i.occurrence,
    i.order,
    i.status,
    JSON.stringify(i),
  )
}

/** The statements that apply one share event. Pure. */
export function shareOps(data: ShareEvent): Op[] {
  switch (data.type) {
    case 'share.upserted': {
      const s = data.share
      return [
        op(
          `INSERT INTO shares (id, revoked, updated_at, data) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET revoked = excluded.revoked, updated_at = excluded.updated_at,
             data = excluded.data`,
          s.id,
          s.revokedAt ? 1 : 0,
          s.updatedAt,
          JSON.stringify(s),
        ),
      ]
    }
    case 'share.revoked':
      // the share itself stays as a tombstone (written by the share.upserted before this event)
      return [
        op('DELETE FROM share_items WHERE share_id = ?', data.shareId),
        op('DELETE FROM share_changes WHERE share_id = ?', data.shareId),
        op('DELETE FROM share_cards WHERE share_id = ?', data.shareId),
        op('DELETE FROM share_comments WHERE share_id = ?', data.shareId),
        op('DELETE FROM share_participants WHERE share_id = ?', data.shareId),
      ]
    case 'share.participant.upserted': {
      const p = data.participant
      return [
        op(
          `INSERT INTO share_participants (id, share_id, email, revoked, data) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET share_id = excluded.share_id, email = excluded.email,
             revoked = excluded.revoked, data = excluded.data`,
          p.id,
          p.shareId,
          p.email,
          p.revokedAt ? 1 : 0,
          JSON.stringify(p),
        ),
      ]
    }
    case 'share.item.upserted':
      return [upsertItem(data.shareId, data.item)]
    case 'share.item.deleted':
      // its history stays (every submitted change is kept); comments on it stay too
      return [op('DELETE FROM share_items WHERE share_id = ? AND id = ?', data.shareId, data.itemId)]
    case 'share.change': {
      const c = data.change
      return [
        op(
          `INSERT INTO share_changes (share_id, id, actor, change_key, item_id, occurrence, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          data.shareId,
          c.id,
          c.actor.participantId,
          c.key,
          c.itemId,
          c.occurrence,
          JSON.stringify(c),
        ),
        ...(data.item ? [upsertItem(data.shareId, data.item)] : []),
      ]
    }
    case 'share.card.upserted': {
      const c = data.card
      return [
        op(
          `INSERT INTO share_cards (share_id, id, occurrence, data) VALUES (?, ?, ?, ?)
           ON CONFLICT (share_id, id) DO UPDATE SET occurrence = excluded.occurrence, data = excluded.data`,
          data.shareId,
          c.id,
          c.occurrence,
          JSON.stringify(c),
        ),
      ]
    }
    case 'share.card.deleted':
      return [op('DELETE FROM share_cards WHERE share_id = ? AND id = ?', data.shareId, data.cardId)]
    case 'share.comment.upserted': {
      const c = data.comment
      return [
        op(
          `INSERT INTO share_comments (share_id, id, occurrence, author, at, data) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (share_id, id) DO UPDATE SET occurrence = excluded.occurrence, author = excluded.author,
             at = excluded.at, data = excluded.data`,
          data.shareId,
          c.id,
          c.occurrence,
          c.author.participantId,
          c.at,
          JSON.stringify(c),
        ),
      ]
    }
  }
}

// ------------------------------------------------------------------------------------------ rows

const parse = <T>(r: Row): T => JSON.parse(r.data as string) as T

/** Canonical order (both dialects sort the same way: ids are ASCII, Postgres columns are COLLATE "C"). */
export const SHARE_SNAPSHOT_QUERIES = {
  shares: 'SELECT * FROM shares ORDER BY id',
  items: 'SELECT * FROM share_items ORDER BY share_id, id',
  changes: 'SELECT * FROM share_changes ORDER BY share_id, id',
  cards: 'SELECT * FROM share_cards ORDER BY share_id, id',
  comments: 'SELECT * FROM share_comments ORDER BY share_id, id',
  participants: 'SELECT * FROM share_participants ORDER BY id',
} as const

export function shareSnapshot(all: (q: string) => Row[]) {
  return {
    shares: all(SHARE_SNAPSHOT_QUERIES.shares).map((r) => parse<Share>(r)),
    shareItems: all(SHARE_SNAPSHOT_QUERIES.items).map((r) => parse<SharedItem>(r)),
    shareChanges: all(SHARE_SNAPSHOT_QUERIES.changes).map((r) => parse<SharedChange>(r)),
    shareCards: all(SHARE_SNAPSHOT_QUERIES.cards).map((r) => parse<SharedCard>(r)),
    shareComments: all(SHARE_SNAPSHOT_QUERIES.comments).map((r) => parse<SharedComment>(r)),
    shareParticipants: all(SHARE_SNAPSHOT_QUERIES.participants).map((r) => parse<ShareParticipant>(r)),
  }
}

// ---------------------------------------------------------------------- loading one share's state
//
// A generator of queries, so one loader serves the synchronous SQLite store and the async Postgres one:
// the driver answers each yielded query with its rows.

export type Query = { sql: string; params: SqlParam[] }

export type ShareKey =
  | { shareId: string }
  /** The link secret's hash (the public page and invitees). */
  | { tokenHash: string }

export type CodeRecord = {
  codeHash: string
  shareId: string
  email: string
  name: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
  attempts: number
}

/** Everything about one share a request can need. Small by construction (one meeting's agenda). */
export type ShareState = {
  share: Share
  items: SharedItem[]
  changes: SharedChange[]
  cards: SharedCard[]
  comments: SharedComment[]
  participants: ShareParticipant[]
  /** Magic-link codes issued for this share in the last day (rate limits count them). */
  codes: CodeRecord[]
  /** The participant whose token the request presented (null: none, unknown or revoked). */
  caller: ShareParticipant | null
}

const q = (sql: string, ...params: SqlParam[]): Query => ({ sql, params })

export function* loadShareState(
  key: ShareKey,
  o: { participantTokenHash?: string | null; now: Date },
): Generator<Query, ShareState | null, Row[]> {
  let shareId: string
  if ('shareId' in key) shareId = key.shareId
  else {
    const t = yield q('SELECT share_id FROM share_tokens WHERE token_hash = ?', key.tokenHash)
    if (!t.length) return null
    shareId = t[0]!.share_id as string
  }
  const s = yield q('SELECT data FROM shares WHERE id = ?', shareId)
  if (!s.length) return null
  const share = parse<Share>(s[0]!)
  const items = (yield q(
    'SELECT data FROM share_items WHERE share_id = ? ORDER BY position, id',
    shareId,
  )).map((r) => parse<SharedItem>(r))
  const changes = (yield q('SELECT data FROM share_changes WHERE share_id = ? ORDER BY id', shareId)).map(
    (r) => parse<SharedChange>(r),
  )
  const cards = (yield q('SELECT data FROM share_cards WHERE share_id = ? ORDER BY id', shareId)).map((r) =>
    parse<SharedCard>(r),
  )
  const comments = (yield q(
    'SELECT data FROM share_comments WHERE share_id = ? ORDER BY at, id',
    shareId,
  )).map((r) => parse<SharedComment>(r))
  const participants = (yield q(
    'SELECT data FROM share_participants WHERE share_id = ? ORDER BY id',
    shareId,
  )).map((r) => parse<ShareParticipant>(r))
  const since = new Date(o.now.getTime() - 86_400_000).toISOString()
  const codes = (yield q(
    'SELECT * FROM share_codes WHERE share_id = ? AND created_at > ? ORDER BY created_at',
    shareId,
    since,
  )).map(
    (r): CodeRecord => ({
      codeHash: r.code_hash as string,
      shareId: r.share_id as string,
      email: r.email as string,
      name: (r.name as string | null) ?? null,
      createdAt: r.created_at as string,
      expiresAt: r.expires_at as string,
      usedAt: (r.used_at as string | null) ?? null,
      attempts: Number(r.attempts),
    }),
  )
  let caller: ShareParticipant | null = null
  if (o.participantTokenHash) {
    const t = yield q(
      'SELECT participant_id FROM share_participant_tokens WHERE token_hash = ? AND share_id = ?',
      o.participantTokenHash,
      shareId,
    )
    const p = t.length ? participants.find((x) => x.id === t[0]!.participant_id) : undefined
    caller = p && !p.revokedAt ? p : null
  }
  return { share, items, changes, cards, comments, participants, codes, caller }
}

/** Drive a query generator synchronously (SQLite). */
export function runSync<T>(gen: Generator<Query, T, Row[]>, exec: (q: Query) => Row[]): T {
  let r = gen.next(undefined as unknown as Row[])
  while (!r.done) r = gen.next(exec(r.value))
  return r.value
}

/** Drive a query generator asynchronously (Postgres). */
export async function runAsync<T>(
  gen: Generator<Query, T, Row[]>,
  exec: (q: Query) => Promise<Row[]>,
): Promise<T> {
  let r = gen.next(undefined as unknown as Row[])
  while (!r.done) r = gen.next(await exec(r.value))
  return r.value
}
