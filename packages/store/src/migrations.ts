import type Database from 'better-sqlite3'

// Forward-only, versioned migrations. Each one runs in its own IMMEDIATE transaction together with the
// row that records it, so a crash mid-migration leaves the database at the previous version, never
// half-way. There is deliberately no `down`: a released schema is only ever extended.

export type Migration = { version: number; name: string; up: string }

export class SchemaError extends Error {
  override name = 'SchemaError'
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: `
      -- the durable event log: the source of truth. seq is gap-free and strictly increasing.
      CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;
      INSERT INTO counters (name, value) VALUES ('seq', 0);

      CREATE TABLE events (
        seq INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        session_id TEXT,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      ) STRICT;
      CREATE INDEX events_session_seq ON events (session_id, seq);

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        status TEXT NOT NULL,
        private INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        error TEXT
      ) STRICT;
      CREATE INDEX sessions_created_at ON sessions (created_at);
      CREATE INDEX sessions_status ON sessions (status);

      CREATE TABLE tracks (
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL,
        device TEXT NOT NULL,
        sample_rate INTEGER NOT NULL,
        audio_path TEXT,
        archive_path TEXT,
        gaps TEXT NOT NULL,
        PRIMARY KEY (session_id, position)
      ) STRICT;

      -- latest revision per segment id; history lives in the event log.
      CREATE TABLE segments (
        pk INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        track TEXT NOT NULL,
        speaker TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        text TEXT NOT NULL,
        quality TEXT NOT NULL,
        revision INTEGER NOT NULL,
        confidence REAL
      ) STRICT;
      CREATE INDEX segments_session_start ON segments (session_id, start_ms);

      -- external-content FTS5 index over segments.text, kept in sync by triggers.
      CREATE VIRTUAL TABLE segments_fts USING fts5 (
        text,
        content = 'segments',
        content_rowid = 'pk',
        tokenize = 'unicode61 remove_diacritics 2'
      );
      CREATE TRIGGER segments_fts_ai AFTER INSERT ON segments BEGIN
        INSERT INTO segments_fts (rowid, text) VALUES (new.pk, new.text);
      END;
      CREATE TRIGGER segments_fts_ad AFTER DELETE ON segments BEGIN
        INSERT INTO segments_fts (segments_fts, rowid, text) VALUES ('delete', old.pk, old.text);
      END;
      CREATE TRIGGER segments_fts_au AFTER UPDATE OF text ON segments BEGIN
        INSERT INTO segments_fts (segments_fts, rowid, text) VALUES ('delete', old.pk, old.text);
        INSERT INTO segments_fts (rowid, text) VALUES (new.pk, new.text);
      END;

      CREATE TABLE qa_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        request_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        citations TEXT NOT NULL,
        model TEXT,
        usage TEXT,
        stop_reason TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX qa_messages_session ON qa_messages (session_id);

      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL) STRICT;
    `,
  },
  {
    // M8 (H-1/H-3/H-6/H-7). Server-local bookkeeping, not event-sourced (see BOOKKEEPING_TABLES).
    // Mirrored, same version and name, in ./pg/migrations.ts — a parity test keeps the lists aligned.
    version: 2,
    name: 'hosted',
    up: `
      -- hybrid sync: the highest seq of each pushing device's log that this store has accounted for
      CREATE TABLE sync_devices (
        device_id TEXT PRIMARY KEY,
        cursor INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      -- paired devices; a bearer token is valid only while its device is here and not revoked
      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      ) STRICT;

      -- device-code pairing requests; the device code itself is stored only as a SHA-256
      CREATE TABLE pairing_requests (
        device_code_hash TEXT PRIMARY KEY,
        user_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        device_id TEXT,
        claimed INTEGER NOT NULL DEFAULT 0
      ) STRICT;

      -- receipts for chunked audio uploads; the bytes live in the BlobStore under blob_key
      CREATE TABLE audio_chunks (
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        chunk_seq INTEGER NOT NULL,
        track TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        blob_key TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (session_id, chunk_seq)
      ) STRICT;
    `,
  },
]

/**
 * Tables that are server-local bookkeeping rather than domain state: not written by events, not
 * reproduced by replay, left out of dump() and snapshot(). Pairing secrets and upload receipts must
 * never travel over /events.
 */
export const BOOKKEEPING_TABLES: readonly string[] = [
  'sync_devices',
  'devices',
  'pairing_requests',
  'audio_chunks',
]

function validateList(list: readonly Migration[]): void {
  list.forEach((m, i) => {
    if (m.version !== i + 1) throw new SchemaError(`migration ${m.name}: expected version ${i + 1}`)
  })
}

export type MigrationResult = { from: number; to: number; applied: number[] }

/** Bring `db` up to the newest migration in `list`. Refuses a database written by a newer build. */
export function migrate(
  db: Database.Database,
  list: readonly Migration[] = migrations,
  now: () => Date = () => new Date(),
): MigrationResult {
  validateList(list)
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`)
  const applied = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all() as {
    version: number
    name: string
  }[]
  applied.forEach((row, i) => {
    if (row.version !== i + 1) throw new SchemaError(`schema_migrations is not contiguous at ${row.version}`)
    const known = list[i]
    if (!known)
      throw new SchemaError(
        `database is at schema version ${applied.length}, newer than this build (${list.length}); refusing to open`,
      )
    if (known.name !== row.name)
      throw new SchemaError(`migration ${row.version} is '${row.name}' on disk but '${known.name}' in code`)
  })
  const from = applied.length
  const done: number[] = []
  const record = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
  for (const m of list.slice(from)) {
    db.transaction(() => {
      db.exec(m.up)
      record.run(m.version, m.name, now().toISOString())
    }).immediate()
    done.push(m.version)
  }
  return { from, to: list.length, applied: done }
}

export function schemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT max(version) AS v FROM schema_migrations').get() as { v: number | null }
  return row.v ?? 0
}
