import type {
  DurableEvent,
  Note,
  NoteTemplate,
  NoteVersion,
  QaMessage,
  Segment,
  Session,
  SessionMeeting,
  SessionStatus,
  StoredSettings,
  SyncItem,
  SyncPushResult,
} from '@gnomeola/protocol'
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
} from './api.ts'
import { byKey, checkIngestOrder, decideIngest, ingestSubject } from './domain.ts'
import { NoteStore } from './notes.ts'
import { type Row, rowToChunk, rowToDevice, rowToQa } from './rows.ts'
import { Store, type StoreOptions } from './store.ts'

// StoreApi over the synchronous SQLite `Store`. Every method runs synchronously inside the returned
// promise, so the atomicity the local daemon relies on (nothing interleaves with a transaction) is
// kept exactly; the async surface is only so one server implementation can also run on Postgres.

export class SqliteStoreApi implements StoreApi {
  readonly dialect = 'sqlite' as const
  readonly store: Store

  private readonly notes: NoteStore

  constructor(store: Store) {
    this.store = store
    this.notes = new NoteStore(store)
  }

  static open(path: string, opts: Omit<StoreOptions, 'path'> = {}): SqliteStoreApi {
    return new SqliteStoreApi(Store.open(path, opts))
  }

  private get db() {
    return this.store.db
  }

  async close(): Promise<void> {
    this.store.close()
  }
  onCommit(listener: CommitListener): () => void {
    return this.store.onCommit(listener)
  }

  async lastSeq(): Promise<number> {
    return this.store.lastSeq()
  }
  async eventsAfter(after: number, opts?: { limit?: number; sessionId?: string }): Promise<DurableEvent[]> {
    return this.store.eventsAfter(after, opts)
  }
  async replay(events: Iterable<DurableEvent>, batchSize?: number): Promise<number> {
    return this.store.replay(events, batchSize)
  }

  async createSession(input: {
    title?: string
    private?: boolean
    id?: string
    meeting?: SessionMeeting
  }): Promise<Session> {
    return this.store.createSession(input)
  }
  async updateSession(id: string, change: (s: Session) => Session): Promise<Session> {
    return this.store.updateSession(id, change)
  }
  async deleteSession(id: string, guard?: (s: Session) => void): Promise<void> {
    this.store.deleteSession(id, guard)
  }
  async upsertSegment(input: SegmentInput): Promise<Segment> {
    return this.store.upsertSegment(input)
  }
  async addQaMessage(message: QaMessage): Promise<QaMessage> {
    return this.store.addQaMessage(message)
  }
  async putSettings(settings: StoredSettings): Promise<StoredSettings> {
    return this.store.putSettings(settings)
  }

  async getSession(id: string): Promise<Session | null> {
    return this.store.getSession(id)
  }
  async listSessions(opts?: ListSessionsOptions): Promise<Session[]> {
    return this.store.listSessions(opts)
  }
  async sessionsWithStatus(statuses: SessionStatus[]): Promise<Session[]> {
    return this.store.sessionsWithStatus(statuses)
  }
  async getSegment(id: string): Promise<Segment | null> {
    return this.store.getSegment(id)
  }
  async segments(sessionId: string): Promise<Segment[]> {
    return this.store.segments(sessionId)
  }
  async transcript(sessionId: string, opts?: TranscriptOptions): Promise<TranscriptWindow> {
    return this.store.transcript(sessionId, opts)
  }
  async search(opts: SearchOptions) {
    return this.store.search(opts)
  }
  async qaHistory(sessionId: string): Promise<QaMessage[]> {
    return this.store.qaHistory(sessionId)
  }
  async getSettings(): Promise<StoredSettings | null> {
    return this.store.getSettings()
  }
  async getNotes(sessionId: string): Promise<Note> {
    return this.notes.get(sessionId)
  }
  async noteVersion(sessionId: string, version: number): Promise<NoteVersion | null> {
    return this.notes.version(sessionId, version)
  }
  async noteVersions(sessionId: string): Promise<NoteVersion[]> {
    return this.notes.versions(sessionId)
  }
  async noteTemplates(): Promise<NoteTemplate[]> {
    return this.notes.templates()
  }

  async snapshot(): Promise<DomainSnapshot> {
    const s = this.store
    const ids = (this.db.prepare('SELECT id FROM sessions ORDER BY id').all() as { id: string }[]).map(
      (r) => r.id,
    )
    const sessions = ids.map((id) => s.getSession(id)!)
    const segments = ids.flatMap((id) => s.segments(id)).sort(byKey((g) => g.id))
    // qaHistory() only answers per session; cross-session messages (session_id NULL) need a direct read.
    const qa = (this.db.prepare('SELECT * FROM qa_messages').all() as Row[])
      .map(rowToQa)
      .sort(byKey((m) => m.id))
    const withNotes = (
      this.db.prepare('SELECT session_id FROM notes ORDER BY session_id').all() as {
        session_id: string
      }[]
    ).map((r) => r.session_id)
    return {
      lastSeq: s.lastSeq(),
      sessions,
      segments,
      qa,
      settings: s.getSettings(),
      noteVersions: withNotes.flatMap((id) => this.notes.versions(id)),
      notes: withNotes.map((id) => this.notes.get(id)),
      templates: this.notes.templates(),
    }
  }

  // ------------------------------------------------------------------------------- sync (H-7)

  async syncCursor(deviceId: string): Promise<number> {
    const r = this.db.prepare('SELECT cursor FROM sync_devices WHERE device_id = ?').get(deviceId) as
      | { cursor: number }
      | undefined
    return r?.cursor ?? 0
  }

  async ingest(
    deviceId: string,
    items: SyncItem[],
    opts: { partial?: boolean } = {},
  ): Promise<SyncPushResult> {
    checkIngestOrder(items)
    const s = this.store
    return s.transaction(() => {
      const start =
        (
          this.db.prepare('SELECT cursor FROM sync_devices WHERE device_id = ?').get(deviceId) as
            | { cursor: number }
            | undefined
        )?.cursor ?? 0
      const out: SyncPushResult = { deviceId, cursor: start, applied: 0, skipped: 0, rejected: [] }
      for (const item of items) {
        if (item.seq <= start) {
          out.skipped++
          continue
        }
        out.cursor = Math.max(out.cursor, item.seq)
        const subj = ingestSubject(item.data)
        const d = decideIngest(item.data, {
          sessionExists: subj.sessionId !== null && s.getSession(subj.sessionId) !== null,
          prevSegment: subj.segmentId ? s.getSegment(subj.segmentId) : null,
          noteVersionExists:
            subj.noteVersion !== undefined && this.notes.version(subj.sessionId!, subj.noteVersion) !== null,
        })
        if (d.kind === 'skip') out.skipped++
        else if (d.kind === 'reject')
          out.rejected.push({ seq: item.seq, type: item.data.type, reason: d.reason })
        else {
          s.commit(() => ({ sessionId: d.sessionId, data: d.data }))
          out.applied++
        }
      }
      if (opts.partial && items.length) out.cursor = Math.max(start, items.at(-1)!.seq - 1)
      this.db
        .prepare(
          `INSERT INTO sync_devices (device_id, cursor, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (device_id) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
        )
        .run(deviceId, out.cursor, new Date().toISOString())
      return out
    })
  }

  // ---------------------------------------------------------------------------- pairing (H-6)

  async createPairing(p: PairingRecord): Promise<void> {
    this.store.transaction(() => {
      this.db.prepare('DELETE FROM pairing_requests WHERE expires_at < ?').run(p.createdAt)
      this.db
        .prepare(
          `INSERT INTO pairing_requests (device_code_hash, user_code, name, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(p.deviceCodeHash, p.userCode, p.name, p.createdAt, p.expiresAt)
    })
  }

  async approvePairing(userCode: string, deviceId: string, now: Date): Promise<DeviceRecord | null> {
    return this.store.transaction(() => {
      const iso = now.toISOString()
      const r = this.db
        .prepare(
          'SELECT name FROM pairing_requests WHERE user_code = ? AND expires_at > ? AND device_id IS NULL',
        )
        .get(userCode, iso) as { name: string } | undefined
      if (!r) return null
      this.db.prepare('UPDATE pairing_requests SET device_id = ? WHERE user_code = ?').run(deviceId, userCode)
      this.db
        .prepare('INSERT INTO devices (id, name, created_at, revoked_at) VALUES (?, ?, ?, NULL)')
        .run(deviceId, r.name, iso)
      return { id: deviceId, name: r.name, createdAt: iso, revokedAt: null }
    })
  }

  async claimPairing(deviceCodeHash: string, now: Date): Promise<PairingClaim | null> {
    return this.store.transaction(() => {
      const r = this.db
        .prepare(
          'SELECT name, expires_at, device_id, claimed FROM pairing_requests WHERE device_code_hash = ?',
        )
        .get(deviceCodeHash) as
        | { name: string; expires_at: string; device_id: string | null; claimed: number }
        | undefined
      if (!r || r.claimed) return null
      if (r.device_id === null)
        return r.expires_at > now.toISOString() ? { status: 'pending' as const } : null
      this.db
        .prepare('UPDATE pairing_requests SET claimed = 1 WHERE device_code_hash = ?')
        .run(deviceCodeHash)
      return { status: 'approved' as const, deviceId: r.device_id, name: r.name }
    })
  }

  async getDevice(id: string): Promise<DeviceRecord | null> {
    const r = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Row | undefined
    return r ? rowToDevice(r) : null
  }

  async revokeDevice(id: string, now: Date): Promise<boolean> {
    return (
      this.db
        .prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
        .run(now.toISOString(), id).changes > 0
    )
  }

  // ------------------------------------------------------------------------------ audio (H-3)

  async putAudioChunk(c: AudioChunkRecord): Promise<'stored' | 'duplicate' | 'conflict'> {
    return this.store.transaction(() => {
      const prev = this.db
        .prepare('SELECT sha256 FROM audio_chunks WHERE session_id = ? AND chunk_seq = ?')
        .get(c.sessionId, c.chunkSeq) as { sha256: string } | undefined
      if (prev) return prev.sha256 === c.sha256 ? 'duplicate' : 'conflict'
      this.db
        .prepare(
          `INSERT INTO audio_chunks (session_id, chunk_seq, track, bytes, sha256, blob_key, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(c.sessionId, c.chunkSeq, c.track, c.bytes, c.sha256, c.blobKey, c.receivedAt)
      return 'stored'
    })
  }

  async audioChunks(sessionId: string): Promise<AudioChunkRecord[]> {
    return (
      this.db
        .prepare('SELECT * FROM audio_chunks WHERE session_id = ? ORDER BY chunk_seq')
        .all(sessionId) as Row[]
    ).map(rowToChunk)
  }
}
