import type {
  DurableEvent,
  Note,
  NoteTemplate,
  NoteVersion,
  QaMessage,
  SearchHit,
  Segment,
  Session,
  SessionMeeting,
  SessionStatus,
  StoredSettings,
  SyncItem,
  SyncPushResult,
  TrackKind,
} from '@gnomeola/protocol'

// H-1 — the store as an asynchronous interface, so one server can run on either dialect:
//
//   SQLite   the local build. `Store` (./store.ts) is synchronous by design (better-sqlite3, one
//            transaction can never interleave with anything on the event loop); `SqliteStoreApi`
//            (./sqlite-api.ts) adapts it to this interface without changing its semantics.
//   Postgres the hosted build (Neon on Vercel, PGlite in tests). `PgStore` (./pg/store.ts).
//
// Both keep the same two rules that make the event log trustworthy: every state change is one
// transaction that applies the event, bumps a single counter row and appends to the log (so seq is
// gap-free and commit order == seq order), and tables are a pure function of the log (replay == state).
// One shared contract suite (test/contract/) runs against both, and a cross-dialect test asserts the
// same history yields the same `snapshot()` on each.
//
// This file must stay free of driver imports: the Vercel bundle imports it without better-sqlite3.

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

export type CommitListener = (e: DurableEvent) => void

/**
 * A dialect-neutral, canonical picture of every piece of domain state (not the log, not bookkeeping).
 * Two stores fed the same history must produce deep-equal snapshots whatever their dialect.
 */
export type DomainSnapshot = {
  lastSeq: number
  sessions: Session[]
  segments: Segment[]
  qa: QaMessage[]
  settings: StoredSettings | null
  /** Every notes version (sorted by session, version), and each session's derived head/pending state. */
  noteVersions: NoteVersion[]
  notes: Note[]
  templates: NoteTemplate[]
}

// ------------------------------------------------------------------ hosted bookkeeping

/**
 * Server-local bookkeeping for the hosted features. Deliberately NOT event-sourced: pairing secrets and
 * upload receipts must never be replicated over /events, and none of it is meeting content. It lives
 * in its own tables, which `dump()`/`snapshot()` leave out.
 */
export type PairingRecord = {
  deviceCodeHash: string
  userCode: string
  name: string
  createdAt: string
  expiresAt: string
}

export type PairingClaim = { status: 'pending' } | { status: 'approved'; deviceId: string; name: string }

export type DeviceRecord = { id: string; name: string; createdAt: string; revokedAt: string | null }

export type AudioChunkRecord = {
  sessionId: string
  chunkSeq: number
  track: TrackKind
  bytes: number
  sha256: string
  blobKey: string
  receivedAt: string
}

export interface StoreApi {
  readonly dialect: 'sqlite' | 'postgres'
  close(): Promise<void>
  /** Called after each commit made through THIS instance, in seq order, outside the transaction. */
  onCommit(listener: CommitListener): () => void

  // ---- the log
  lastSeq(): Promise<number>
  eventsAfter(after: number, opts?: { limit?: number; sessionId?: string }): Promise<DurableEvent[]>
  /** Rebuild from a log; only valid on an empty store, log must be gap-free from seq 1. */
  replay(events: Iterable<DurableEvent>, batchSize?: number): Promise<number>

  // ---- domain writes (each is exactly one durable event)
  createSession(input: {
    title?: string
    private?: boolean
    id?: string
    meeting?: SessionMeeting
  }): Promise<Session>
  updateSession(id: string, change: (s: Session) => Session): Promise<Session>
  deleteSession(id: string, guard?: (s: Session) => void): Promise<void>
  upsertSegment(input: SegmentInput): Promise<Segment>
  addQaMessage(message: QaMessage): Promise<QaMessage>
  putSettings(settings: StoredSettings): Promise<StoredSettings>

  // ---- reads
  getSession(id: string): Promise<Session | null>
  listSessions(opts?: ListSessionsOptions): Promise<Session[]>
  sessionsWithStatus(statuses: SessionStatus[]): Promise<Session[]>
  getSegment(id: string): Promise<Segment | null>
  segments(sessionId: string): Promise<Segment[]>
  transcript(sessionId: string, opts?: TranscriptOptions): Promise<TranscriptWindow>
  search(opts: SearchOptions): Promise<{ hits: SearchHit[]; total: number }>
  qaHistory(sessionId: string): Promise<QaMessage[]>
  getSettings(): Promise<StoredSettings | null>
  /** M7 notes, read side (a hosted store only ever receives notes through sync or replay). */
  getNotes(sessionId: string): Promise<Note>
  noteVersion(sessionId: string, version: number): Promise<NoteVersion | null>
  noteVersions(sessionId: string): Promise<NoteVersion[]>
  noteTemplates(): Promise<NoteTemplate[]>
  snapshot(): Promise<DomainSnapshot>

  // ---- H-7: hybrid sync (a device's log applied to this store, idempotently)
  syncCursor(deviceId: string): Promise<number>
  /** One transaction: skip items at/below the device's cursor, apply the rest, advance the cursor. */
  ingest(deviceId: string, items: SyncItem[], opts?: { partial?: boolean }): Promise<SyncPushResult>

  // ---- H-6: pairing
  createPairing(p: PairingRecord): Promise<void>
  /** Approve a pending, unexpired request by user code; creates the device. null = no such request. */
  approvePairing(userCode: string, deviceId: string, now: Date): Promise<DeviceRecord | null>
  /** Poll by device-code hash. The approved claim is handed out exactly once. null = unknown/expired. */
  claimPairing(deviceCodeHash: string, now: Date): Promise<PairingClaim | null>
  getDevice(id: string): Promise<DeviceRecord | null>
  revokeDevice(id: string, now: Date): Promise<boolean>

  // ---- H-3: chunked audio receipts
  /** `duplicate` = same bytes already recorded; `conflict` = different bytes under the same key. */
  putAudioChunk(c: AudioChunkRecord): Promise<'stored' | 'duplicate' | 'conflict'>
  audioChunks(sessionId: string): Promise<AudioChunkRecord[]>
}
