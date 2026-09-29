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
    version: 2,
    name: 'notes',
    up: `
      -- M7: every version of a session's notes, append-only (see src/notes.ts).
      CREATE TABLE note_versions (
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        kind TEXT NOT NULL,
        markdown TEXT NOT NULL,
        base_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        meta TEXT NOT NULL,
        PRIMARY KEY (session_id, version)
      ) STRICT;
      -- which version is the head, and which enhanced version awaits review
      CREATE TABLE notes (
        session_id TEXT PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
        head INTEGER NOT NULL,
        pending_enhancement INTEGER
      ) STRICT;
      CREATE TABLE note_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        keywords TEXT NOT NULL,
        body TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 3,
    name: 'session-meeting',
    up: `
      -- M4: the calendar meeting a session was recorded for (JSON SessionMeeting), or NULL.
      ALTER TABLE sessions ADD COLUMN meeting TEXT;
    `,
  },
  {
    // M3 — attribution.
    version: 4,
    name: 'speakers',
    up: `
      -- far-end speakers, per session. A merged speaker stays as a tombstone (merged_into) so a late
      -- reference to it from the diarizer still resolves.
      CREATE TABLE speakers (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        named INTEGER NOT NULL,
        colour INTEGER NOT NULL,
        voiceprint_id TEXT,
        merged_into TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX speakers_session ON speakers (session_id);

      -- which far-end speaker a segment is, and whether a person (not the diarizer) decided it.
      ALTER TABLE segments ADD COLUMN speaker_id TEXT;
      ALTER TABLE segments ADD COLUMN speaker_source TEXT;
      CREATE INDEX segments_speaker ON segments (speaker_id);

      -- cross-session voiceprints (opt-in). The embedding is a JSON array of floats.
      CREATE TABLE voiceprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding TEXT NOT NULL,
        samples INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
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
