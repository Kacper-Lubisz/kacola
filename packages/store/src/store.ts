import {
  type DurableEvent,
  DurableEventData,
  newId,
  type QaMessage,
  type SearchHit,
  type Segment,
  type Session,
  type SessionMeeting,
  type SessionStatus,
  StoredSettings,
  type Track,
  type TrackKind,
} from '@gnomeola/protocol'
import Database from 'better-sqlite3'
import {
  type Compilable,
  DummyDriver,
  Kysely,
  type RawBuilder,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from 'kysely'
import { capSnippet, SNIPPET_TOKENS, toFtsQuery } from './fts.ts'
import { migrations as defaultMigrations, type Migration, migrate } from './migrations.ts'
import type { DB, QaRow, SegmentRow, SessionRow, TrackRow } from './schema.ts'

// The store. Two rules make the event log trustworthy:
//
//   1. Every state change goes through `commit()`, which — inside ONE IMMEDIATE transaction — builds
//      the event from current state, applies it to the tables, bumps the seq counter and appends the
//      event. State and log can therefore never disagree, and seq is gap-free even with several
//      connections writing (IMMEDIATE takes the write lock before the counter is read).
//   2. Tables are a pure function of the log: `applyEvent` is the only code that writes them, and
//      `replay()` drives the same function from a log. A test proves replay reproduces the tables
//      byte-for-byte.
//
// All access is synchronous (better-sqlite3). kysely is used as a type-safe query *compiler* only, so a
// transaction can never interleave with anything else on the event loop.

export class StoreError extends Error {
  readonly code: 'not_found' | 'conflict' | 'bad_request'
  constructor(code: StoreError['code'], message: string) {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}

export type SegmentInput = Omit<Segment, 'revision'>

export type ListSessionsOptions = {
  since?: Date
  limit?: number
  includePrivate?: boolean
}

export type TranscriptOptions = {
  fromMs?: number
  toMs?: number
  speaker?: string
  track?: TrackKind
  quality?: 'live' | 'final' | 'best'
}

export type TranscriptWindow = {
  segments: Segment[]
  window: { fromMs: number; toMs: number } | null
  total: number
}

export type SearchOptions = {
  q: string
  since?: Date
  sessionId?: string
  speaker?: string
  limit?: number
  includePrivate?: boolean
}

export type StoreOptions = {
  /** File path, or ':memory:'. */
  path: string
  now?: () => Date
  busyTimeoutMs?: number
  migrations?: readonly Migration[]
  readonly?: boolean
}

type Listener = (e: DurableEvent) => void

const compiler = new Kysely<DB>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
})

const bool = (v: boolean | undefined): number => (v ? 1 : 0)

function rowToSegment(r: SegmentRow): Segment {
  return {
    id: r.id,
    sessionId: r.session_id,
    track: r.track as TrackKind,
    speaker: r.speaker,
    startMs: r.start_ms,
    endMs: r.end_ms,
    text: r.text,
    quality: r.quality as Segment['quality'],
    revision: r.revision,
    confidence: r.confidence,
  }
}

function rowToTrack(r: TrackRow): Track {
  return {
    kind: r.kind as TrackKind,
    device: r.device,
    sampleRate: r.sample_rate,
    audioPath: r.audio_path,
    archivePath: r.archive_path,
    gaps: JSON.parse(r.gaps) as Track['gaps'],
  }
}

function rowToQa(r: QaRow): QaMessage {
  return {
    id: r.id,
    sessionId: r.session_id,
    requestId: r.request_id,
    role: r.role as QaMessage['role'],
    text: r.text,
    citations: JSON.parse(r.citations) as QaMessage['citations'],
    model: r.model,
    usage: r.usage === null ? null : (JSON.parse(r.usage) as QaMessage['usage']),
    stopReason: r.stop_reason,
    createdAt: r.created_at,
  }
}

export class Store {
  readonly db: Database.Database
  readonly path: string
  private readonly now: () => Date
  private readonly stmts = new Map<string, Database.Statement>()
  private readonly listeners = new Set<Listener>()
  private readonly outbox: DurableEvent[] = []
  private draining = false

  constructor(opts: StoreOptions) {
    this.path = opts.path
    this.now = opts.now ?? (() => new Date())
    this.db = new Database(opts.path, { readonly: opts.readonly ?? false })
    this.db.pragma(`busy_timeout = ${opts.busyTimeoutMs ?? 5000}`)
    this.db.pragma('foreign_keys = ON')
    if (!opts.readonly) {
      if (opts.path !== ':memory:') this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
      migrate(this.db, opts.migrations ?? defaultMigrations, this.now)
    }
  }

  static open(path: string, opts: Omit<StoreOptions, 'path'> = {}): Store {
    return new Store({ ...opts, path })
  }

  close(): void {
    if (this.db.open) this.db.close()
    this.listeners.clear()
  }

  // ------------------------------------------------------------------ plumbing

  private stmt(q: string): Database.Statement {
    let s = this.stmts.get(q)
    if (!s) {
      s = this.db.prepare(q)
      this.stmts.set(q, s)
    }
    return s
  }

  private compile(q: Compilable | RawBuilder<unknown>): { sql: string; params: unknown[] } {
    // Query builders compile themselves; raw `sql` fragments need the (compile-only) Kysely instance.
    const c = (q as RawBuilder<unknown>).compile(compiler)
    return { sql: c.sql, params: [...c.parameters] }
  }

  private run(q: Compilable | RawBuilder<unknown>): Database.RunResult {
    const c = this.compile(q)
    return this.stmt(c.sql).run(...c.params)
  }

  private all<T>(q: Compilable | RawBuilder<unknown>): T[] {
    const c = this.compile(q)
    return this.stmt(c.sql).all(...c.params) as T[]
  }

  private first<T>(q: Compilable | RawBuilder<unknown>): T | undefined {
    const c = this.compile(q)
    return this.stmt(c.sql).get(...c.params) as T | undefined
  }

  /** Called synchronously, in seq order, after each commit — never inside the transaction. */
  onCommit(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private drain(): void {
    if (this.draining) return
    this.draining = true
    try {
      for (let e = this.outbox.shift(); e; e = this.outbox.shift()) {
        for (const l of this.listeners) l(e)
      }
    } finally {
      this.draining = false
    }
  }

  // ------------------------------------------------------------ the one writer

  /**
   * The only way state changes. `build` runs inside the IMMEDIATE transaction and may read current
   * state to decide the event (e.g. the next segment revision); throwing aborts with nothing written.
   */
  commit(build: () => { sessionId: string | null; data: DurableEventData }): DurableEvent {
    const event = this.db
      .transaction(() => {
        const { sessionId, data: raw } = build()
        const data = DurableEventData.parse(raw)
        this.applyEvent(data)
        const seq = (
          this.stmt("UPDATE counters SET value = value + 1 WHERE name = 'seq' RETURNING value").get() as {
            value: number
          }
        ).value
        const e: DurableEvent = { seq, at: this.now().toISOString(), sessionId, data }
        this.insertEvent(e)
        return e
      })
      .immediate()
    this.outbox.push(event)
    this.drain()
    return event
  }

  private insertEvent(e: DurableEvent): void {
    this.run(
      compiler.insertInto('events').values({
        seq: e.seq,
        at: e.at,
        session_id: e.sessionId,
        type: e.data.type,
        data: JSON.stringify(e.data),
      }),
    )
  }

  /** Tables are a function of the log: this is the only code that writes them. */
  private applyEvent(data: DurableEventData): void {
    switch (data.type) {
      case 'session.upserted': {
        const s = data.session
        const row: SessionRow = {
          id: s.id,
          title: s.title,
          created_at: s.createdAt,
          started_at: s.startedAt,
          ended_at: s.endedAt,
          status: s.status,
          private: bool(s.private),
          duration_ms: s.durationMs,
          error: s.error,
          meeting: s.meeting ? JSON.stringify(s.meeting) : null,
        }
        const { id: _id, ...rest } = row
        this.run(
          compiler
            .insertInto('sessions')
            .values(row)
            .onConflict((oc) => oc.column('id').doUpdateSet(rest)),
        )
        this.run(compiler.deleteFrom('tracks').where('session_id', '=', s.id))
        s.tracks.forEach((t, position) => {
          this.run(
            compiler.insertInto('tracks').values({
              session_id: s.id,
              position,
              kind: t.kind,
              device: t.device,
              sample_rate: t.sampleRate,
              audio_path: t.audioPath,
              archive_path: t.archivePath,
              gaps: JSON.stringify(t.gaps),
            }),
          )
        })
        return
      }
      case 'segment.upserted': {
        const g = data.segment
        const row = {
          id: g.id,
          session_id: g.sessionId,
          track: g.track,
          speaker: g.speaker,
          start_ms: g.startMs,
          end_ms: g.endMs,
          text: g.text,
          quality: g.quality,
          revision: g.revision,
          confidence: g.confidence,
        }
        const { id: _id, ...rest } = row
        this.run(
          compiler
            .insertInto('segments')
            .values(row)
            .onConflict((oc) => oc.column('id').doUpdateSet(rest)),
        )
        return
      }
      case 'qa.message': {
        const m = data.message
        const row: QaRow = {
          id: m.id,
          session_id: m.sessionId,
          request_id: m.requestId,
          role: m.role,
          text: m.text,
          citations: JSON.stringify(m.citations),
          model: m.model,
          usage: m.usage === null ? null : JSON.stringify(m.usage),
          stop_reason: m.stopReason,
          created_at: m.createdAt,
        }
        const { id: _id, ...rest } = row
        this.run(
          compiler
            .insertInto('qa_messages')
            .values(row)
            .onConflict((oc) => oc.column('id').doUpdateSet(rest)),
        )
        return
      }
      case 'session.deleted': {
        const id = data.sessionId
        this.run(compiler.deleteFrom('qa_messages').where('session_id', '=', id))
        this.run(compiler.deleteFrom('segments').where('session_id', '=', id))
        this.run(compiler.deleteFrom('tracks').where('session_id', '=', id))
        this.run(compiler.deleteFrom('sessions').where('id', '=', id))
        return
      }
      case 'settings.updated': {
        const value = JSON.stringify(data.settings)
        this.run(
          compiler
            .insertInto('settings')
            .values({ id: 1, value })
            .onConflict((oc) => oc.column('id').doUpdateSet({ value })),
        )
        return
      }
      default: {
        const never: never = data
        throw new Error(`unhandled event ${JSON.stringify(never)}`)
      }
    }
  }

  /**
   * Rebuild state from a log. Only valid on an empty store; the log must start at seq 1 and be
   * gap-free. Events are appended verbatim (same seq, same timestamp), so a replayed store is
   * indistinguishable from the original.
   */
  replay(events: Iterable<DurableEvent>, batchSize = 500): number {
    if (this.lastSeq() !== 0) throw new StoreError('conflict', 'replay requires an empty store')
    let expected = 1
    let batch: DurableEvent[] = []
    const flush = () => {
      if (!batch.length) return
      const items = batch
      batch = []
      this.db
        .transaction(() => {
          for (const e of items) {
            this.applyEvent(DurableEventData.parse(e.data))
            this.insertEvent(e)
          }
          this.stmt("UPDATE counters SET value = ? WHERE name = 'seq'").run(items.at(-1)!.seq)
        })
        .immediate()
    }
    for (const e of events) {
      if (e.seq !== expected)
        throw new StoreError('bad_request', `replay gap: expected ${expected}, got ${e.seq}`)
      expected++
      batch.push(e)
      if (batch.length >= batchSize) flush()
    }
    flush()
    return expected - 1
  }

  // ----------------------------------------------------------- domain writes

  createSession(input: {
    title?: string
    private?: boolean
    id?: string
    meeting?: SessionMeeting
  }): Session {
    const now = this.now()
    const session: Session = {
      id: input.id ?? newId('ses', now.getTime()),
      title: input.title?.trim() || `Meeting ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
      createdAt: now.toISOString(),
      startedAt: null,
      endedAt: null,
      status: 'idle',
      private: input.private ?? false,
      durationMs: 0,
      tracks: [],
      error: null,
      ...(input.meeting ? { meeting: input.meeting } : {}),
    }
    this.commit(() => {
      if (this.getSession(session.id)) throw new StoreError('conflict', `session ${session.id} exists`)
      return { sessionId: session.id, data: { type: 'session.upserted', session } }
    })
    return session
  }

  /**
   * Read-modify-write of a session inside the transaction. `change` receives the current session and
   * returns the next one (or throws a StoreError to refuse, e.g. an illegal transition).
   */
  updateSession(id: string, change: (s: Session) => Session): Session {
    let next: Session | undefined
    this.commit(() => {
      const cur = this.getSession(id)
      if (!cur) throw new StoreError('not_found', `no session ${id}`)
      next = { ...change(cur), id: cur.id, createdAt: cur.createdAt }
      return { sessionId: id, data: { type: 'session.upserted', session: next } }
    })
    return next!
  }

  deleteSession(id: string, guard?: (s: Session) => void): void {
    this.commit(() => {
      const cur = this.getSession(id)
      if (!cur) throw new StoreError('not_found', `no session ${id}`)
      guard?.(cur)
      return { sessionId: id, data: { type: 'session.deleted', sessionId: id } }
    })
  }

  /**
   * Upsert a segment. The store assigns the revision (previous + 1) and enforces the segment-lifecycle
   * invariants, so no producer — real STT, fake, or buggy — can write a history that violates them.
   */
  upsertSegment(input: SegmentInput): Segment {
    let out: Segment | undefined
    this.commit(() => {
      if (input.endMs < input.startMs)
        throw new StoreError(
          'bad_request',
          `segment ${input.id}: end ${input.endMs} < start ${input.startMs}`,
        )
      if (input.track === 'mic' && input.speaker !== 'me')
        throw new StoreError('bad_request', `segment ${input.id}: mic track must be attributed to 'me'`)
      if (input.track === 'system' && input.speaker === 'me')
        throw new StoreError('bad_request', `segment ${input.id}: far-end track cannot be 'me'`)
      if (!input.speaker) throw new StoreError('bad_request', `segment ${input.id}: empty speaker`)
      if (!this.sessionExists(input.sessionId))
        throw new StoreError('not_found', `no session ${input.sessionId}`)
      const prev = this.getSegment(input.id)
      if (prev) {
        if (prev.sessionId !== input.sessionId || prev.track !== input.track)
          throw new StoreError('conflict', `segment ${input.id}: session/track cannot change`)
        if (prev.quality === 'final' && input.quality === 'live')
          throw new StoreError('conflict', `segment ${input.id}: cannot regress final -> live`)
      }
      out = { ...input, revision: (prev?.revision ?? 0) + 1 }
      return { sessionId: input.sessionId, data: { type: 'segment.upserted', segment: out } }
    })
    return out!
  }

  addQaMessage(message: QaMessage): QaMessage {
    this.commit(() => {
      if (message.sessionId !== null && !this.sessionExists(message.sessionId))
        throw new StoreError('not_found', `no session ${message.sessionId}`)
      return { sessionId: message.sessionId, data: { type: 'qa.message', message } }
    })
    return message
  }

  putSettings(settings: StoredSettings): StoredSettings {
    const parsed = StoredSettings.parse(settings)
    this.commit(() => ({ sessionId: null, data: { type: 'settings.updated', settings: parsed } }))
    return parsed
  }

  // ------------------------------------------------------------------- reads

  lastSeq(): number {
    return (this.stmt("SELECT value FROM counters WHERE name = 'seq'").get() as { value: number }).value
  }

  eventsAfter(after: number, opts: { limit?: number; sessionId?: string } = {}): DurableEvent[] {
    let q = compiler.selectFrom('events').selectAll().where('seq', '>', after).orderBy('seq')
    if (opts.sessionId !== undefined) q = q.where('session_id', '=', opts.sessionId)
    if (opts.limit !== undefined) q = q.limit(opts.limit)
    return this.all<{ seq: number; at: string; session_id: string | null; data: string }>(q).map((r) => ({
      seq: r.seq,
      at: r.at,
      sessionId: r.session_id,
      data: JSON.parse(r.data) as DurableEventData,
    }))
  }

  private sessionExists(id: string): boolean {
    return !!this.first(compiler.selectFrom('sessions').select('id').where('id', '=', id))
  }

  private tracksFor(ids: string[]): Map<string, Track[]> {
    const out = new Map<string, Track[]>()
    if (!ids.length) return out
    const rows = this.all<TrackRow>(
      compiler
        .selectFrom('tracks')
        .selectAll()
        .where('session_id', 'in', ids)
        .orderBy('session_id')
        .orderBy('position'),
    )
    for (const r of rows) {
      const list = out.get(r.session_id) ?? []
      list.push(rowToTrack(r))
      out.set(r.session_id, list)
    }
    return out
  }

  private toSessions(rows: SessionRow[]): Session[] {
    const tracks = this.tracksFor(rows.map((r) => r.id))
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      status: r.status as SessionStatus,
      private: r.private === 1,
      durationMs: r.duration_ms,
      tracks: tracks.get(r.id) ?? [],
      error: r.error,
      ...(r.meeting ? { meeting: JSON.parse(r.meeting) as Session['meeting'] } : {}),
    }))
  }

  getSession(id: string): Session | null {
    const row = this.first<SessionRow>(compiler.selectFrom('sessions').selectAll().where('id', '=', id))
    return row ? this.toSessions([row])[0]! : null
  }

  listSessions(opts: ListSessionsOptions = {}): Session[] {
    let q = compiler.selectFrom('sessions').selectAll()
    if (!opts.includePrivate) q = q.where('private', '=', 0)
    if (opts.since) q = q.where('created_at', '>=', opts.since.toISOString())
    q = q
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit ?? 50)
    return this.toSessions(this.all<SessionRow>(q))
  }

  sessionsWithStatus(statuses: SessionStatus[]): Session[] {
    return this.toSessions(
      this.all<SessionRow>(
        compiler.selectFrom('sessions').selectAll().where('status', 'in', statuses).orderBy('id'),
      ),
    )
  }

  /** Timestamp of the newest durable event about this session — "last known alive". */
  lastEventAt(sessionId: string): string | null {
    const r = this.first<{ at: string }>(
      compiler
        .selectFrom('events')
        .select('at')
        .where('session_id', '=', sessionId)
        .orderBy('seq', 'desc')
        .limit(1),
    )
    return r?.at ?? null
  }

  getSegment(id: string): Segment | null {
    const r = this.first<SegmentRow>(compiler.selectFrom('segments').selectAll().where('id', '=', id))
    return r ? rowToSegment(r) : null
  }

  segments(sessionId: string): Segment[] {
    return this.all<SegmentRow>(
      compiler
        .selectFrom('segments')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('start_ms')
        .orderBy('track')
        .orderBy('id'),
    ).map(rowToSegment)
  }

  maxSegmentEndMs(sessionId: string): number {
    const r = this.first<{ m: number | null }>(
      compiler
        .selectFrom('segments')
        .select((eb) => eb.fn.max('end_ms').as('m'))
        .where('session_id', '=', sessionId),
    )
    return r?.m ?? 0
  }

  /**
   * A window of a transcript. Segments overlapping [fromMs, toMs] (inclusive) are returned. `quality`:
   * `best` = every segment at its latest revision (final where available), `live`/`final` = only segments
   * currently at that quality. `total` counts the whole session, unfiltered.
   */
  transcript(sessionId: string, opts: TranscriptOptions = {}): TranscriptWindow {
    const session = this.getSession(sessionId)
    if (!session) throw new StoreError('not_found', `no session ${sessionId}`)
    const windowed = opts.fromMs !== undefined || opts.toMs !== undefined
    const fromMs = opts.fromMs ?? 0
    const toMs = opts.toMs ?? Math.max(session.durationMs, this.maxSegmentEndMs(sessionId))
    if (windowed && toMs < fromMs) throw new StoreError('bad_request', `toMs ${toMs} < fromMs ${fromMs}`)
    let q = compiler.selectFrom('segments').selectAll().where('session_id', '=', sessionId)
    if (windowed) q = q.where('start_ms', '<=', toMs).where('end_ms', '>=', fromMs)
    if (opts.speaker !== undefined) q = q.where(sql<boolean>`speaker = ${opts.speaker} COLLATE NOCASE`)
    if (opts.track !== undefined) q = q.where('track', '=', opts.track)
    if (opts.quality === 'live' || opts.quality === 'final') q = q.where('quality', '=', opts.quality)
    q = q.orderBy('start_ms').orderBy('track').orderBy('id')
    const total = this.first<{ n: number }>(
      compiler
        .selectFrom('segments')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('session_id', '=', sessionId),
    )!.n
    return {
      segments: this.all<SegmentRow>(q).map(rowToSegment),
      window: windowed ? { fromMs, toMs } : null,
      total,
    }
  }

  /** FTS5 search, bm25-ranked, with bracket-marked, length-capped snippets. Higher score = better. */
  search(opts: SearchOptions): { hits: SearchHit[]; total: number } {
    const match = toFtsQuery(opts.q)
    if (!match) return { hits: [], total: 0 }
    const filters = [sql`segments_fts MATCH ${match}`]
    if (!opts.includePrivate) filters.push(sql`ses.private = 0`)
    if (opts.since) filters.push(sql`ses.created_at >= ${opts.since.toISOString()}`)
    if (opts.sessionId !== undefined) filters.push(sql`s.session_id = ${opts.sessionId}`)
    if (opts.speaker !== undefined) filters.push(sql`s.speaker = ${opts.speaker} COLLATE NOCASE`)
    const where = sql.join(filters, sql` AND `)
    const from = sql`segments_fts
      JOIN segments s ON s.pk = segments_fts.rowid
      JOIN sessions ses ON ses.id = s.session_id`
    const rows = this.all<{
      segment_id: string
      session_id: string
      title: string
      speaker: string
      start_ms: number
      end_ms: number
      snippet: string
      rank: number
    }>(
      sql`SELECT s.id AS segment_id, s.session_id, ses.title, s.speaker, s.start_ms, s.end_ms,
            snippet(segments_fts, 0, '[', ']', '…', ${sql.lit(SNIPPET_TOKENS)}) AS snippet,
            bm25(segments_fts) AS rank
          FROM ${from} WHERE ${where}
          ORDER BY rank, s.session_id, s.start_ms, s.id
          LIMIT ${opts.limit ?? 20}`,
    )
    const total = this.first<{ n: number }>(sql`SELECT count(*) AS n FROM ${from} WHERE ${where}`)!.n
    return {
      total,
      hits: rows.map((r) => ({
        sessionId: r.session_id,
        sessionTitle: r.title,
        segmentId: r.segment_id,
        speaker: r.speaker,
        startMs: r.start_ms,
        endMs: r.end_ms,
        snippet: capSnippet(r.snippet),
        // bm25() is "lower is better" and negative; flip it so clients can sort descending.
        score: -r.rank,
      })),
    }
  }

  qaHistory(sessionId: string): QaMessage[] {
    return this.all<QaRow>(
      compiler.selectFrom('qa_messages').selectAll().where('session_id', '=', sessionId).orderBy(sql`rowid`),
    ).map(rowToQa)
  }

  getSettings(): StoredSettings | null {
    const r = this.first<{ value: string }>(
      compiler.selectFrom('settings').select('value').where('id', '=', 1),
    )
    return r ? StoredSettings.parse(JSON.parse(r.value)) : null
  }

  // ------------------------------------------------------------- verification

  /**
   * A canonical, byte-comparable dump of every table except the log itself (and the migration
   * bookkeeping, whose timestamps are by definition when *this* file was created). FTS5 shadow tables
   * are included, so a replay must reproduce the search index exactly too.
   */
  dump(): string {
    const tables = (
      this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('events', 'schema_migrations', 'segments_fts') ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((r) => r.name)
    const out: Record<string, string[]> = {}
    for (const t of tables) {
      const rows = this.db.prepare(`SELECT * FROM "${t}"`).raw().all() as unknown[][]
      out[t] = rows
        .map((row) => JSON.stringify(row.map((v) => (Buffer.isBuffer(v) ? `x'${v.toString('hex')}'` : v))))
        .sort()
    }
    return JSON.stringify(out, null, 1)
  }

  /** FTS5's own consistency check between the index and the content table; throws if out of sync. */
  checkFts(): void {
    this.db.prepare("INSERT INTO segments_fts (segments_fts, rank) VALUES ('integrity-check', 1)").run()
  }
}
