import {
  type DurableEvent,
  DurableEventData,
  ME,
  type Note,
  type NoteTemplate,
  type NoteVersion,
  type QaMessage,
  type SearchHit,
  type Segment,
  type Session,
  type SessionMeeting,
  type SessionStatus,
  type SpeakerSummary,
  StoredSettings,
  type SyncItem,
  type SyncPushResult,
  THEM,
} from '@gnomeola/protocol'
import { type Kysely, type RawBuilder, sql, type Transaction } from 'kysely'
import {
  AGENDA_SNAPSHOT_QUERIES,
  agendaOps,
  agendaSnapshot,
  type Op,
  sessionDeletedAgendaOps,
} from '../agendas-apply.ts'
import type {
  AudioChunkRecord,
  CommitListener,
  DeviceRecord,
  DomainSnapshot,
  ListSessionsOptions,
  PairingClaim,
  PairingRecord,
  SearchOptions,
  SegmentInput,
  StoreApi,
  TranscriptOptions,
  TranscriptWindow,
} from '../api.ts'
import { byKey, checkIngestOrder, decideIngest, ingestSubject, newSession, nextSegment } from '../domain.ts'
import { StoreError } from '../errors.ts'
import type { Migration } from '../migrations.ts'
import {
  type Row,
  rowToChunk,
  rowToDevice,
  rowToNoteVersion,
  rowToQa,
  rowToSegment,
  rowToSpeaker,
  rowToTrack,
  truthy,
} from '../rows.ts'
import { parseQuery, searchText, snippet, toTsQuery } from '../search-text.ts'
import { migratePg, pgMigrations } from './migrations.ts'

// StoreApi on Postgres — Neon in production, PGlite in `pnpm check`, a real server in the int tier.
//
// The single-writer rule, ported: every commit transaction starts with
//   SELECT value FROM counters WHERE name = 'seq' FOR UPDATE
// BEFORE it reads any state. That row lock is what BEGIN IMMEDIATE is in SQLite: it serialises every
// writer in every process, so `build` sees current state, seq is gap-free (a rolled-back transaction
// releases the lock without having bumped the counter), and commits become visible strictly in seq
// order — a reader paging `seq > cursor` can never see seq n+1 before seq n. That last property is what
// makes cursor-resumed SSE exact on a stateless host (H-4).
//
// Commits through one instance are additionally queued, so onCommit listeners hear them in seq order.

// biome-ignore lint/suspicious/noExplicitAny: queries are raw SQL; row shapes are mapped in ../rows.ts
type DB = any
type Exec = Kysely<DB> | Transaction<DB>

export type PgStoreOptions = {
  now?: () => Date
  migrations?: readonly Migration[]
  /** Run migrations on open (default true). */
  migrate?: boolean
}

type Built = { sessionId: string | null; data: DurableEventData }

const rows = async (e: Exec, q: RawBuilder<unknown>): Promise<Row[]> => (await q.execute(e)).rows as Row[]
const one = async (e: Exec, q: RawBuilder<unknown>): Promise<Row | undefined> => (await rows(e, q))[0]

/** A dialect-neutral statement (`?` placeholders) as a Postgres query with bound parameters. */
function bind(o: Op): RawBuilder<unknown> {
  const parts = o.sql.split('?')
  if (parts.length !== o.params.length + 1) throw new Error(`placeholder mismatch in: ${o.sql}`)
  return parts
    .slice(1)
    .reduce<RawBuilder<unknown>>(
      (acc, part, i) => sql`${acc}${o.params[i]}${sql.raw(part)}`,
      sql.raw(parts[0]!),
    )
}
const runOps = async (e: Exec, ops: Op[]): Promise<void> => {
  for (const o of ops) await bind(o).execute(e)
}

export class PgStore implements StoreApi {
  readonly dialect = 'postgres' as const
  readonly db: Kysely<DB>
  private readonly now: () => Date
  private readonly listeners = new Set<CommitListener>()
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(db: Kysely<DB>, now: () => Date) {
    this.db = db
    this.now = now
  }

  static async open(db: Kysely<DB>, opts: PgStoreOptions = {}): Promise<PgStore> {
    const now = opts.now ?? (() => new Date())
    if (opts.migrate ?? true) await migratePg(db, opts.migrations ?? pgMigrations, now)
    return new PgStore(db, now)
  }

  async close(): Promise<void> {
    this.listeners.clear()
    await this.db.destroy()
  }

  onCommit(listener: CommitListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(events: DurableEvent[]): void {
    for (const e of events)
      for (const l of this.listeners) {
        try {
          l(e)
        } catch {}
      }
  }

  /** Serialise this instance's write transactions; listeners run after each commits, in order. */
  private write<T>(fn: (trx: Transaction<DB>, events: DurableEvent[]) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const events: DurableEvent[] = []
      const out = await this.db.transaction().execute((trx) => fn(trx, events))
      this.notify(events)
      return out
    })
    this.queue = run.catch(() => {})
    return run
  }

  // ------------------------------------------------------------------------ the one writer

  /** Inside a write transaction: lock the counter, build, apply, append. */
  private async commitIn(
    trx: Transaction<DB>,
    events: DurableEvent[],
    build: () => Built | Promise<Built>,
  ): Promise<DurableEvent> {
    const cur = await one(trx, sql`SELECT value FROM counters WHERE name = 'seq' FOR UPDATE`)
    const { sessionId, data: raw } = await build()
    const data = DurableEventData.parse(raw)
    await this.applyEvent(trx, data)
    const seq = Number(cur!.value) + 1
    await sql`UPDATE counters SET value = ${seq} WHERE name = 'seq'`.execute(trx)
    const e: DurableEvent = { seq, at: this.now().toISOString(), sessionId, data }
    await this.insertEvent(trx, e)
    events.push(e)
    return e
  }

  private commit(build: (trx: Transaction<DB>) => Built | Promise<Built>): Promise<DurableEvent> {
    return this.write((trx, events) => this.commitIn(trx, events, () => build(trx)))
  }

  private async insertEvent(e: Exec, ev: DurableEvent): Promise<void> {
    await sql`INSERT INTO events (seq, at, session_id, type, data)
      VALUES (${ev.seq}, ${ev.at}, ${ev.sessionId}, ${ev.data.type}, ${JSON.stringify(ev.data)})`.execute(e)
  }

  /** Tables are a function of the log: this is the only code that writes them. */
  private async applyEvent(e: Exec, data: DurableEventData): Promise<void> {
    switch (data.type) {
      case 'session.upserted': {
        const s = data.session
        const meeting = s.meeting ? JSON.stringify(s.meeting) : null
        await sql`INSERT INTO sessions (id, title, created_at, started_at, ended_at, status, private, duration_ms, error, meeting)
          VALUES (${s.id}, ${s.title}, ${s.createdAt}, ${s.startedAt}, ${s.endedAt}, ${s.status}, ${s.private}, ${s.durationMs}, ${s.error}, ${meeting})
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, created_at = excluded.created_at,
            started_at = excluded.started_at, ended_at = excluded.ended_at, status = excluded.status,
            private = excluded.private, duration_ms = excluded.duration_ms, error = excluded.error,
            meeting = excluded.meeting`.execute(e)
        await sql`DELETE FROM tracks WHERE session_id = ${s.id}`.execute(e)
        for (const [position, t] of s.tracks.entries()) {
          await sql`INSERT INTO tracks (session_id, position, kind, device, sample_rate, audio_path, archive_path, gaps)
            VALUES (${s.id}, ${position}, ${t.kind}, ${t.device}, ${t.sampleRate}, ${t.audioPath}, ${t.archivePath}, ${JSON.stringify(t.gaps)})`.execute(
            e,
          )
        }
        return
      }
      case 'segment.upserted': {
        const g = data.segment
        // speaker_source is set only for a new row (as ../store.ts does); later changes carry their own `by`
        const speakerId = g.speakerId ?? null
        await sql`INSERT INTO segments (id, session_id, track, speaker, start_ms, end_ms, text, quality, revision, confidence, search_text, speaker_id, speaker_source)
          VALUES (${g.id}, ${g.sessionId}, ${g.track}, ${g.speaker}, ${g.startMs}, ${g.endMs}, ${g.text}, ${g.quality}, ${g.revision}, ${g.confidence}, ${searchText(g.text)},
            ${speakerId}, ${speakerId ? 'auto' : null})
          ON CONFLICT (id) DO UPDATE SET session_id = excluded.session_id, track = excluded.track,
            speaker = excluded.speaker, start_ms = excluded.start_ms, end_ms = excluded.end_ms, text = excluded.text,
            quality = excluded.quality, revision = excluded.revision, confidence = excluded.confidence,
            search_text = excluded.search_text, speaker_id = excluded.speaker_id`.execute(e)
        return
      }
      case 'qa.message': {
        const m = data.message
        await sql`INSERT INTO qa_messages (id, session_id, request_id, role, text, citations, model, usage, stop_reason, created_at)
          VALUES (${m.id}, ${m.sessionId}, ${m.requestId}, ${m.role}, ${m.text}, ${JSON.stringify(m.citations)}, ${m.model},
            ${m.usage === null ? null : JSON.stringify(m.usage)}, ${m.stopReason}, ${m.createdAt})
          ON CONFLICT (id) DO UPDATE SET session_id = excluded.session_id, request_id = excluded.request_id,
            role = excluded.role, text = excluded.text, citations = excluded.citations, model = excluded.model,
            usage = excluded.usage, stop_reason = excluded.stop_reason, created_at = excluded.created_at`.execute(
          e,
        )
        return
      }
      case 'session.deleted': {
        const id = data.sessionId
        await runOps(e, sessionDeletedAgendaOps(id))
        await sql`DELETE FROM speakers WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM notes WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM note_versions WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM qa_messages WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM segments WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM tracks WHERE session_id = ${id}`.execute(e)
        await sql`DELETE FROM sessions WHERE id = ${id}`.execute(e)
        return
      }
      case 'settings.updated': {
        const value = JSON.stringify(data.settings)
        await sql`INSERT INTO settings (id, value) VALUES (1, ${value})
          ON CONFLICT (id) DO UPDATE SET value = excluded.value`.execute(e)
        return
      }
      // ---- M7 notes: the same derivation as ../notes.ts applyNotesEvent, statement for statement
      case 'note.version': {
        const v = data.version
        const meta = JSON.stringify({
          enhancement: v.enhancement,
          merge: v.merge,
          restoredFrom: v.restoredFrom,
        })
        await sql`INSERT INTO note_versions (session_id, version, kind, markdown, base_version, created_at, meta)
          VALUES (${v.sessionId}, ${v.version}, ${v.kind}, ${v.markdown}, ${v.baseVersion}, ${v.createdAt}, ${meta})`.execute(
          e,
        )
        await sql`INSERT INTO notes (session_id, head, pending_enhancement) VALUES (${v.sessionId}, 0, NULL)
          ON CONFLICT (session_id) DO NOTHING`.execute(e)
        if (v.kind === 'enhanced') {
          await sql`UPDATE notes SET pending_enhancement = ${v.version} WHERE session_id = ${v.sessionId}`.execute(
            e,
          )
        } else {
          await sql`UPDATE notes SET head = ${v.version} WHERE session_id = ${v.sessionId}`.execute(e)
          if (v.merge)
            await sql`UPDATE notes SET pending_enhancement = NULL
              WHERE session_id = ${v.sessionId} AND pending_enhancement = ${v.merge.enhancedVersion}`.execute(
              e,
            )
        }
        return
      }
      case 'template.upserted': {
        const t = data.template
        await sql`INSERT INTO note_templates (id, name, keywords, body)
          VALUES (${t.id}, ${t.name}, ${JSON.stringify(t.keywords)}, ${t.body})
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, keywords = excluded.keywords, body = excluded.body`.execute(
          e,
        )
        return
      }
      case 'template.deleted':
        await sql`DELETE FROM note_templates WHERE id = ${data.id}`.execute(e)
        return
      // ---- M3 attribution: the same writes as ../store.ts applySpeakerEvent
      case 'speaker.upserted': {
        const p = data.speaker
        await sql`INSERT INTO speakers (id, session_id, label, named, colour, voiceprint_id, merged_into, created_at)
          VALUES (${p.id}, ${p.sessionId}, ${p.label}, ${p.named}, ${p.colour}, ${p.voiceprintId}, ${p.mergedInto}, ${p.createdAt})
          ON CONFLICT (id) DO UPDATE SET session_id = excluded.session_id, label = excluded.label, named = excluded.named,
            colour = excluded.colour, voiceprint_id = excluded.voiceprint_id, merged_into = excluded.merged_into,
            created_at = excluded.created_at`.execute(e)
        await sql`UPDATE segments SET speaker = ${p.label} WHERE speaker_id = ${p.id}`.execute(e)
        return
      }
      case 'speaker.merged': {
        const into = await one(e, sql`SELECT id, label FROM speakers WHERE id = ${data.intoId}`)
        await sql`UPDATE segments SET speaker_id = ${into!.id as string}, speaker = ${into!.label as string}, speaker_source = 'user'
          WHERE speaker_id = ${data.fromId}`.execute(e)
        await sql`UPDATE speakers SET merged_into = ${into!.id as string}
          WHERE id = ${data.fromId} OR merged_into = ${data.fromId}`.execute(e)
        return
      }
      case 'segments.attributed': {
        if (!data.segmentIds.length) return
        const spk = await one(e, sql`SELECT id, label FROM speakers WHERE id = ${data.speakerId}`)
        await sql`UPDATE segments SET speaker_id = ${spk!.id as string}, speaker = ${spk!.label as string}, speaker_source = ${data.by}
          WHERE session_id = ${data.sessionId} AND id IN (${sql.join(data.segmentIds)})`.execute(e)
        return
      }
      case 'voiceprint.upserted': {
        const v = data.voiceprint
        await sql`INSERT INTO voiceprints (id, name, model, embedding, samples, created_at, updated_at)
          VALUES (${v.id}, ${v.name}, ${v.model}, ${JSON.stringify(v.embedding)}, ${v.samples}, ${v.createdAt}, ${v.updatedAt})
          ON CONFLICT (id) DO UPDATE SET name = excluded.name, model = excluded.model, embedding = excluded.embedding,
            samples = excluded.samples, created_at = excluded.created_at, updated_at = excluded.updated_at`.execute(
          e,
        )
        return
      }
      case 'voiceprint.deleted':
        await sql`DELETE FROM voiceprints WHERE id = ${data.voiceprintId}`.execute(e)
        await sql`UPDATE speakers SET voiceprint_id = NULL WHERE voiceprint_id = ${data.voiceprintId}`.execute(
          e,
        )
        return
      // ---- agendas: the same statements as the SQLite store (../agendas-apply.ts)
      case 'agenda.upserted':
      case 'agenda.deleted':
      case 'agenda.item.upserted':
      case 'agenda.item.status':
      case 'agenda.item.deleted':
      case 'agenda.items.reordered':
      case 'agenda.context.upserted':
      case 'agenda.context.deleted':
      case 'agenda.suggestion.upserted':
        await runOps(e, agendaOps(data))
        return
      default: {
        const never: never = data
        throw new Error(`unhandled event ${JSON.stringify(never)}`)
      }
    }
  }

  async replay(events: Iterable<DurableEvent>, batchSize = 500): Promise<number> {
    if ((await this.lastSeq()) !== 0) throw new StoreError('conflict', 'replay requires an empty store')
    let expected = 1
    let batch: DurableEvent[] = []
    const flush = async () => {
      if (!batch.length) return
      const items = batch
      batch = []
      await this.write(async (trx) => {
        await sql`SELECT value FROM counters WHERE name = 'seq' FOR UPDATE`.execute(trx)
        for (const e of items) {
          await this.applyEvent(trx, DurableEventData.parse(e.data))
          await this.insertEvent(trx, e)
        }
        await sql`UPDATE counters SET value = ${items.at(-1)!.seq} WHERE name = 'seq'`.execute(trx)
      })
    }
    for (const e of events) {
      if (e.seq !== expected)
        throw new StoreError('bad_request', `replay gap: expected ${expected}, got ${e.seq}`)
      expected++
      batch.push(e)
      if (batch.length >= batchSize) await flush()
    }
    await flush()
    return expected - 1
  }

  // ------------------------------------------------------------------------- domain writes

  async createSession(input: {
    title?: string
    private?: boolean
    id?: string
    meeting?: SessionMeeting
  }): Promise<Session> {
    const session = newSession(input, this.now())
    await this.commit(async (trx) => {
      if (await this.getSessionIn(trx, session.id))
        throw new StoreError('conflict', `session ${session.id} exists`)
      return { sessionId: session.id, data: { type: 'session.upserted', session } }
    })
    return session
  }

  async updateSession(id: string, change: (s: Session) => Session): Promise<Session> {
    let next: Session | undefined
    await this.commit(async (trx) => {
      const cur = await this.getSessionIn(trx, id)
      if (!cur) throw new StoreError('not_found', `no session ${id}`)
      next = { ...change(cur), id: cur.id, createdAt: cur.createdAt }
      return { sessionId: id, data: { type: 'session.upserted', session: next } }
    })
    return next!
  }

  async deleteSession(id: string, guard?: (s: Session) => void): Promise<void> {
    await this.commit(async (trx) => {
      const cur = await this.getSessionIn(trx, id)
      if (!cur) throw new StoreError('not_found', `no session ${id}`)
      guard?.(cur)
      return { sessionId: id, data: { type: 'session.deleted', sessionId: id } }
    })
  }

  async upsertSegment(input: SegmentInput): Promise<Segment> {
    let out: Segment | undefined
    await this.commit(async (trx) => {
      const exists = (await this.getSessionIn(trx, input.sessionId)) !== null
      out = nextSegment(input, await this.getSegmentIn(trx, input.id), exists)
      return { sessionId: input.sessionId, data: { type: 'segment.upserted', segment: out } }
    })
    return out!
  }

  async addQaMessage(message: QaMessage): Promise<QaMessage> {
    await this.commit(async (trx) => {
      if (message.sessionId !== null && !(await this.getSessionIn(trx, message.sessionId)))
        throw new StoreError('not_found', `no session ${message.sessionId}`)
      return { sessionId: message.sessionId, data: { type: 'qa.message', message } }
    })
    return message
  }

  async putSettings(settings: StoredSettings): Promise<StoredSettings> {
    const parsed = StoredSettings.parse(settings)
    await this.commit(() => ({ sessionId: null, data: { type: 'settings.updated', settings: parsed } }))
    return parsed
  }

  // --------------------------------------------------------------------------------- reads

  async lastSeq(): Promise<number> {
    return Number((await one(this.db, sql`SELECT value FROM counters WHERE name = 'seq'`))!.value)
  }

  async eventsAfter(
    after: number,
    opts: { limit?: number; sessionId?: string } = {},
  ): Promise<DurableEvent[]> {
    const where = [sql`seq > ${after}`]
    if (opts.sessionId !== undefined) where.push(sql`session_id = ${opts.sessionId}`)
    const limit = opts.limit !== undefined ? sql`LIMIT ${opts.limit}` : sql``
    const rs = await rows(
      this.db,
      sql`SELECT seq, at, session_id, data FROM events WHERE ${sql.join(where, sql` AND `)} ORDER BY seq ${limit}`,
    )
    return rs.map((r) => ({
      seq: Number(r.seq),
      at: r.at as string,
      sessionId: r.session_id as string | null,
      data: JSON.parse(r.data as string) as DurableEventData,
    }))
  }

  private async toSessions(e: Exec, rs: Row[]): Promise<Session[]> {
    if (!rs.length) return []
    const ids = rs.map((r) => r.id as string)
    const trs = await rows(
      e,
      sql`SELECT * FROM tracks WHERE session_id IN (${sql.join(ids)}) ORDER BY session_id, position`,
    )
    const tracks = new Map<string, Session['tracks']>()
    for (const t of trs) {
      const list = tracks.get(t.session_id as string) ?? []
      list.push(rowToTrack(t))
      tracks.set(t.session_id as string, list)
    }
    return rs.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      createdAt: r.created_at as string,
      startedAt: r.started_at as string | null,
      endedAt: r.ended_at as string | null,
      status: r.status as SessionStatus,
      private: truthy(r.private),
      durationMs: Number(r.duration_ms),
      tracks: tracks.get(r.id as string) ?? [],
      error: r.error as string | null,
      ...(r.meeting ? { meeting: JSON.parse(r.meeting as string) as Session['meeting'] } : {}),
    }))
  }

  private async getSessionIn(e: Exec, id: string): Promise<Session | null> {
    const r = await one(e, sql`SELECT * FROM sessions WHERE id = ${id}`)
    return r ? (await this.toSessions(e, [r]))[0]! : null
  }

  private async getSegmentIn(e: Exec, id: string): Promise<Segment | null> {
    const r = await one(e, sql`SELECT * FROM segments WHERE id = ${id}`)
    return r ? rowToSegment(r) : null
  }

  getSession(id: string): Promise<Session | null> {
    return this.getSessionIn(this.db, id)
  }

  async listSessions(opts: ListSessionsOptions = {}): Promise<Session[]> {
    const where = [sql`true`]
    if (!opts.includePrivate) where.push(sql`private = false`)
    if (opts.since) where.push(sql`created_at >= ${opts.since.toISOString()}`)
    const rs = await rows(
      this.db,
      sql`SELECT * FROM sessions WHERE ${sql.join(where, sql` AND `)}
        ORDER BY created_at DESC, id DESC LIMIT ${opts.limit ?? 50}`,
    )
    return this.toSessions(this.db, rs)
  }

  async sessionsWithStatus(statuses: SessionStatus[]): Promise<Session[]> {
    if (!statuses.length) return []
    const rs = await rows(
      this.db,
      sql`SELECT * FROM sessions WHERE status IN (${sql.join(statuses)}) ORDER BY id`,
    )
    return this.toSessions(this.db, rs)
  }

  getSegment(id: string): Promise<Segment | null> {
    return this.getSegmentIn(this.db, id)
  }

  async segments(sessionId: string): Promise<Segment[]> {
    return (
      await rows(
        this.db,
        sql`SELECT * FROM segments WHERE session_id = ${sessionId} ORDER BY start_ms, track, id`,
      )
    ).map(rowToSegment)
  }

  private async maxSegmentEndMs(sessionId: string): Promise<number> {
    const r = await one(this.db, sql`SELECT max(end_ms) AS m FROM segments WHERE session_id = ${sessionId}`)
    return r?.m === null || r?.m === undefined ? 0 : Number(r.m)
  }

  async transcript(sessionId: string, opts: TranscriptOptions = {}): Promise<TranscriptWindow> {
    const session = await this.getSession(sessionId)
    if (!session) throw new StoreError('not_found', `no session ${sessionId}`)
    const windowed = opts.fromMs !== undefined || opts.toMs !== undefined
    const fromMs = opts.fromMs ?? 0
    const toMs = opts.toMs ?? Math.max(session.durationMs, await this.maxSegmentEndMs(sessionId))
    if (windowed && toMs < fromMs) throw new StoreError('bad_request', `toMs ${toMs} < fromMs ${fromMs}`)
    const where = [sql`session_id = ${sessionId}`]
    if (windowed) where.push(sql`start_ms <= ${toMs}`, sql`end_ms >= ${fromMs}`)
    // a label ("Ana", "me") or a speaker id (M3), as in ../store.ts
    if (opts.speaker !== undefined)
      where.push(sql`(lower(speaker) = lower(${opts.speaker}) OR speaker_id = ${opts.speaker})`)
    if (opts.track !== undefined) where.push(sql`track = ${opts.track}`)
    if (opts.quality === 'live' || opts.quality === 'final') where.push(sql`quality = ${opts.quality}`)
    const segs = await rows(
      this.db,
      sql`SELECT * FROM segments WHERE ${sql.join(where, sql` AND `)} ORDER BY start_ms, track, id`,
    )
    const total = await one(this.db, sql`SELECT count(*) AS n FROM segments WHERE session_id = ${sessionId}`)
    return {
      segments: segs.map(rowToSegment),
      window: windowed ? { fromMs, toMs } : null,
      total: Number(total!.n),
    }
  }

  /** tsvector search over the normalised text; ts_rank with length normalisation. Higher = better. */
  async search(opts: SearchOptions): Promise<{ hits: SearchHit[]; total: number }> {
    const tsq = toTsQuery(opts.q)
    if (!tsq) return { hits: [], total: 0 }
    const where = [sql`s.search_vec @@ q.q`]
    if (!opts.includePrivate) where.push(sql`ses.private = false`)
    if (opts.since) where.push(sql`ses.created_at >= ${opts.since.toISOString()}`)
    if (opts.sessionId !== undefined) where.push(sql`s.session_id = ${opts.sessionId}`)
    if (opts.speaker !== undefined)
      where.push(sql`(lower(s.speaker) = lower(${opts.speaker}) OR s.speaker_id = ${opts.speaker})`)
    const cond = sql.join(where, sql` AND `)
    const from = sql`segments s JOIN sessions ses ON ses.id = s.session_id
      CROSS JOIN (SELECT to_tsquery('simple', ${tsq}) AS q) q`
    const rs = await rows(
      this.db,
      sql`SELECT s.id AS segment_id, s.session_id, ses.title, s.speaker, s.start_ms, s.end_ms, s.text,
            ts_rank(s.search_vec, q.q, 1) AS rank
          FROM ${from} WHERE ${cond}
          ORDER BY rank DESC, s.session_id, s.start_ms, s.id
          LIMIT ${opts.limit ?? 20}`,
    )
    const total = await one(this.db, sql`SELECT count(*) AS n FROM ${from} WHERE ${cond}`)
    const parsed = parseQuery(opts.q)
    return {
      total: Number(total!.n),
      hits: rs.map((r) => ({
        sessionId: r.session_id as string,
        sessionTitle: r.title as string,
        segmentId: r.segment_id as string,
        speaker: r.speaker as string,
        startMs: Number(r.start_ms),
        endMs: Number(r.end_ms),
        snippet: snippet(r.text as string, parsed),
        score: Number(r.rank),
      })),
    }
  }

  async qaHistory(sessionId: string): Promise<QaMessage[]> {
    return (
      await rows(this.db, sql`SELECT * FROM qa_messages WHERE session_id = ${sessionId} ORDER BY ord`)
    ).map(rowToQa)
  }

  async getSettings(): Promise<StoredSettings | null> {
    const r = await one(this.db, sql`SELECT value FROM settings WHERE id = 1`)
    return r ? StoredSettings.parse(JSON.parse(r.value as string)) : null
  }

  // ---------------------------------------------------------------------------------- notes

  async getNotes(sessionId: string): Promise<Note> {
    const row = await one(
      this.db,
      sql`SELECT head, pending_enhancement FROM notes WHERE session_id = ${sessionId}`,
    )
    const headNo = row ? Number(row.head) : 0
    const head = headNo > 0 ? await this.noteVersion(sessionId, headNo) : null
    return {
      sessionId,
      version: head?.version ?? 0,
      markdown: head?.markdown ?? '',
      updatedAt: head?.createdAt ?? null,
      pendingEnhancement:
        row?.pending_enhancement === null || row?.pending_enhancement === undefined
          ? null
          : Number(row.pending_enhancement),
    }
  }

  async noteVersion(sessionId: string, version: number): Promise<NoteVersion | null> {
    const r = await one(
      this.db,
      sql`SELECT * FROM note_versions WHERE session_id = ${sessionId} AND version = ${version}`,
    )
    return r ? rowToNoteVersion(r) : null
  }

  async noteVersions(sessionId: string): Promise<NoteVersion[]> {
    return (
      await rows(this.db, sql`SELECT * FROM note_versions WHERE session_id = ${sessionId} ORDER BY version`)
    ).map(rowToNoteVersion)
  }

  async noteTemplates(): Promise<NoteTemplate[]> {
    return (await rows(this.db, sql`SELECT * FROM note_templates ORDER BY id`)).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      builtIn: false,
      keywords: JSON.parse(r.keywords as string) as string[],
      body: r.body as string,
    }))
  }

  async snapshot(): Promise<DomainSnapshot> {
    const sessions = await this.toSessions(
      this.db,
      await rows(this.db, sql`SELECT * FROM sessions ORDER BY id`),
    )
    const segments = (await rows(this.db, sql`SELECT * FROM segments ORDER BY id`)).map(rowToSegment)
    const qa = (await rows(this.db, sql`SELECT * FROM qa_messages`)).map(rowToQa).sort(byKey((m) => m.id))
    const withNotes = (await rows(this.db, sql`SELECT session_id FROM notes ORDER BY session_id`)).map(
      (r) => r.session_id as string,
    )
    const noteVersions: NoteVersion[] = []
    const notes: Note[] = []
    for (const id of withNotes) {
      noteVersions.push(...(await this.noteVersions(id)))
      notes.push(await this.getNotes(id))
    }
    return {
      lastSeq: await this.lastSeq(),
      sessions,
      segments,
      qa,
      settings: await this.getSettings(),
      noteVersions,
      notes,
      templates: await this.noteTemplates(),
      speakers: (await rows(this.db, sql`SELECT * FROM speakers ORDER BY id`)).map(rowToSpeaker),
      attribution: (
        await rows(
          this.db,
          sql`SELECT id, speaker_source FROM segments WHERE speaker_source IS NOT NULL ORDER BY id`,
        )
      ).map((r) => ({ segmentId: r.id as string, source: r.speaker_source as string })),
      voiceprints: (await rows(this.db, sql`SELECT * FROM voiceprints ORDER BY id`)).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        model: r.model as string,
        embedding: JSON.parse(r.embedding as string) as number[],
        samples: Number(r.samples),
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      })),
      ...(await (async () => {
        const got: Record<string, Row[]> = {}
        for (const [k, q] of Object.entries(AGENDA_SNAPSHOT_QUERIES)) got[q] = await rows(this.db, sql.raw(q))
        return agendaSnapshot((q) => got[q]!)
      })()),
    }
  }

  /** As ../store.ts speakerSummaries: `me`, the live far-end speakers in creation order, then `them`. */
  async speakerSummaries(sessionId: string): Promise<SpeakerSummary[]> {
    const stats = await rows(
      this.db,
      sql`SELECT track, speaker_id, count(*) AS n, coalesce(sum(end_ms - start_ms), 0) AS ms
          FROM segments WHERE session_id = ${sessionId} GROUP BY track, speaker_id`,
    )
    const stat = (track: string, id: string | null) => {
      const r = stats.find((x) => x.track === track && (x.speaker_id ?? null) === id)
      return { n: r ? Number(r.n) : 0, ms: r ? Number(r.ms) : 0 }
    }
    const pseudo = (id: string, track: 'mic' | 'system', st: { n: number; ms: number }): SpeakerSummary => ({
      id,
      label: id,
      track,
      named: false,
      colour: null,
      voiceprintId: null,
      segments: st.n,
      talkMs: st.ms,
    })
    const out: SpeakerSummary[] = [pseudo(ME, 'mic', stat('mic', null))]
    const live = (
      await rows(
        this.db,
        sql`SELECT * FROM speakers WHERE session_id = ${sessionId} AND merged_into IS NULL ORDER BY created_at, colour, id`,
      )
    ).map(rowToSpeaker)
    for (const s of live) {
      const st = stat('system', s.id)
      out.push({
        id: s.id,
        label: s.label,
        track: 'system',
        named: s.named,
        colour: s.colour,
        voiceprintId: s.voiceprintId,
        segments: st.n,
        talkMs: st.ms,
      })
    }
    const them = stat('system', null)
    if (them.n) out.push(pseudo(THEM, 'system', them))
    return out
  }

  // ------------------------------------------------------------------------------ sync (H-7)

  async syncCursor(deviceId: string): Promise<number> {
    const r = await one(this.db, sql`SELECT cursor FROM sync_devices WHERE device_id = ${deviceId}`)
    return r ? Number(r.cursor) : 0
  }

  async ingest(
    deviceId: string,
    items: SyncItem[],
    opts: { partial?: boolean } = {},
  ): Promise<SyncPushResult> {
    checkIngestOrder(items)
    return this.write(async (trx, events) => {
      // Writer lock first (as every commit does), then this device's cursor row.
      await sql`SELECT value FROM counters WHERE name = 'seq' FOR UPDATE`.execute(trx)
      const c = await one(trx, sql`SELECT cursor FROM sync_devices WHERE device_id = ${deviceId} FOR UPDATE`)
      const start = c ? Number(c.cursor) : 0
      const out: SyncPushResult = { deviceId, cursor: start, applied: 0, skipped: 0, rejected: [] }
      for (const item of items) {
        if (item.seq <= start) {
          out.skipped++
          continue
        }
        out.cursor = Math.max(out.cursor, item.seq)
        const subj = ingestSubject(item.data)
        const d = decideIngest(item.data, {
          sessionExists: subj.sessionId !== null && (await this.getSessionIn(trx, subj.sessionId)) !== null,
          prevSegment: subj.segmentId ? await this.getSegmentIn(trx, subj.segmentId) : null,
          speakersExist: await (async () => {
            for (const id of subj.speakerIds ?? []) {
              const r = await one(trx, sql`SELECT session_id FROM speakers WHERE id = ${id}`)
              if (r?.session_id !== subj.sessionId) return false
            }
            return true
          })(),
          noteVersionExists:
            subj.noteVersion !== undefined &&
            (await one(
              trx,
              sql`SELECT 1 AS x FROM note_versions WHERE session_id = ${subj.sessionId} AND version = ${subj.noteVersion}`,
            )) !== undefined,
        })
        if (d.kind === 'skip') out.skipped++
        else if (d.kind === 'reject')
          out.rejected.push({ seq: item.seq, type: item.data.type, reason: d.reason })
        else {
          await this.commitIn(trx, events, () => ({ sessionId: d.sessionId, data: d.data }))
          out.applied++
        }
      }
      if (opts.partial && items.length) out.cursor = Math.max(start, items.at(-1)!.seq - 1)
      await sql`INSERT INTO sync_devices (device_id, cursor, updated_at)
        VALUES (${deviceId}, ${out.cursor}, ${this.now().toISOString()})
        ON CONFLICT (device_id) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`.execute(
        trx,
      )
      return out
    })
  }

  // ---------------------------------------------------------------------------- pairing (H-6)

  async createPairing(p: PairingRecord): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await sql`DELETE FROM pairing_requests WHERE expires_at < ${p.createdAt}`.execute(trx)
      await sql`INSERT INTO pairing_requests (device_code_hash, user_code, name, created_at, expires_at)
        VALUES (${p.deviceCodeHash}, ${p.userCode}, ${p.name}, ${p.createdAt}, ${p.expiresAt})`.execute(trx)
    })
  }

  async approvePairing(userCode: string, deviceId: string, now: Date): Promise<DeviceRecord | null> {
    const iso = now.toISOString()
    return this.db.transaction().execute(async (trx) => {
      const r = await one(
        trx,
        sql`UPDATE pairing_requests SET device_id = ${deviceId}
          WHERE user_code = ${userCode} AND expires_at > ${iso} AND device_id IS NULL RETURNING name`,
      )
      if (!r) return null
      await sql`INSERT INTO devices (id, name, created_at, revoked_at) VALUES (${deviceId}, ${r.name}, ${iso}, NULL)`.execute(
        trx,
      )
      return { id: deviceId, name: r.name as string, createdAt: iso, revokedAt: null }
    })
  }

  async claimPairing(deviceCodeHash: string, now: Date): Promise<PairingClaim | null> {
    const claimed = await one(
      this.db,
      sql`UPDATE pairing_requests SET claimed = true
        WHERE device_code_hash = ${deviceCodeHash} AND device_id IS NOT NULL AND claimed = false
        RETURNING device_id, name`,
    )
    if (claimed)
      return { status: 'approved', deviceId: claimed.device_id as string, name: claimed.name as string }
    const r = await one(
      this.db,
      sql`SELECT expires_at, device_id FROM pairing_requests WHERE device_code_hash = ${deviceCodeHash}`,
    )
    if (!r || r.device_id !== null) return null // unknown, or approved and already claimed
    return (r.expires_at as string) > now.toISOString() ? { status: 'pending' } : null
  }

  async getDevice(id: string): Promise<DeviceRecord | null> {
    const r = await one(this.db, sql`SELECT * FROM devices WHERE id = ${id}`)
    return r ? rowToDevice(r) : null
  }

  async revokeDevice(id: string, now: Date): Promise<boolean> {
    const r = await one(
      this.db,
      sql`UPDATE devices SET revoked_at = ${now.toISOString()} WHERE id = ${id} AND revoked_at IS NULL RETURNING id`,
    )
    return r !== undefined
  }

  // ------------------------------------------------------------------------------ audio (H-3)

  async putAudioChunk(c: AudioChunkRecord): Promise<'stored' | 'duplicate' | 'conflict'> {
    const ins = await one(
      this.db,
      sql`INSERT INTO audio_chunks (session_id, chunk_seq, track, bytes, sha256, blob_key, received_at)
        VALUES (${c.sessionId}, ${c.chunkSeq}, ${c.track}, ${c.bytes}, ${c.sha256}, ${c.blobKey}, ${c.receivedAt})
        ON CONFLICT (session_id, chunk_seq) DO NOTHING RETURNING chunk_seq`,
    )
    if (ins) return 'stored'
    const prev = await one(
      this.db,
      sql`SELECT sha256 FROM audio_chunks WHERE session_id = ${c.sessionId} AND chunk_seq = ${c.chunkSeq}`,
    )
    return prev?.sha256 === c.sha256 ? 'duplicate' : 'conflict'
  }

  async audioChunks(sessionId: string): Promise<AudioChunkRecord[]> {
    return (
      await rows(this.db, sql`SELECT * FROM audio_chunks WHERE session_id = ${sessionId} ORDER BY chunk_seq`)
    ).map(rowToChunk)
  }
}
