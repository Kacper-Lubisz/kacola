import { type Kysely, sql } from 'kysely'
// ../migrations.ts only type-imports better-sqlite3, so this stays driver-free at runtime.
import { type Migration, SchemaError } from '../migrations.ts'

// The Postgres schema, migration for migration with ../migrations.ts: same versions, same names (a
// parity test enforces it — add a Postgres twin, even an empty one, with every SQLite migration).
//
// Differences from SQLite, all deliberate:
//   - booleans are boolean; timestamps stay ISO text so both dialects return byte-identical values;
//   - seq is bigint; confidence is double precision (SQLite REAL is a double; float4 would round);
//   - text columns that are sorted or range-compared are COLLATE "C", i.e. byte order like SQLite's
//     BINARY, whatever the server's default locale (Neon's is en_US.UTF-8);
//   - search: no FTS5, so segments carry `search_text` (normalised in ../search-text.ts) and a stored
//     tsvector over it with a GIN index;
//   - Q&A keeps insertion order in an identity column, as SQLite does implicitly with rowid.
//
// All pending migrations run in ONE transaction under an advisory lock: two cold-starting functions
// cannot both migrate, and a failure leaves the schema exactly where it was (Postgres DDL is
// transactional).

export const pgMigrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: `
      CREATE TABLE counters (name text PRIMARY KEY, value bigint NOT NULL);
      INSERT INTO counters (name, value) VALUES ('seq', 0);

      CREATE TABLE events (
        seq bigint PRIMARY KEY,
        at text NOT NULL,
        session_id text COLLATE "C",
        type text NOT NULL,
        data text NOT NULL
      );
      CREATE INDEX events_session_seq ON events (session_id, seq);

      CREATE TABLE sessions (
        id text COLLATE "C" PRIMARY KEY,
        title text NOT NULL,
        created_at text COLLATE "C" NOT NULL,
        started_at text,
        ended_at text,
        status text NOT NULL,
        private boolean NOT NULL,
        duration_ms integer NOT NULL,
        error text
      );
      CREATE INDEX sessions_created_at ON sessions (created_at);
      CREATE INDEX sessions_status ON sessions (status);

      CREATE TABLE tracks (
        session_id text COLLATE "C" NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        position integer NOT NULL,
        kind text NOT NULL,
        device text NOT NULL,
        sample_rate integer NOT NULL,
        audio_path text,
        archive_path text,
        gaps text NOT NULL,
        PRIMARY KEY (session_id, position)
      );

      CREATE TABLE segments (
        id text COLLATE "C" PRIMARY KEY,
        session_id text COLLATE "C" NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        track text COLLATE "C" NOT NULL,
        speaker text NOT NULL,
        start_ms integer NOT NULL,
        end_ms integer NOT NULL,
        text text NOT NULL,
        quality text NOT NULL,
        revision integer NOT NULL,
        confidence double precision,
        search_text text NOT NULL,
        search_vec tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, search_text)) STORED
      );
      CREATE INDEX segments_session_start ON segments (session_id, start_ms);
      CREATE INDEX segments_search ON segments USING gin (search_vec);

      CREATE TABLE qa_messages (
        ord bigint GENERATED ALWAYS AS IDENTITY,
        id text COLLATE "C" PRIMARY KEY,
        session_id text COLLATE "C",
        request_id text NOT NULL,
        role text NOT NULL,
        text text NOT NULL,
        citations text NOT NULL,
        model text,
        usage text,
        stop_reason text,
        created_at text NOT NULL
      );
      CREATE INDEX qa_messages_session ON qa_messages (session_id, ord);

      CREATE TABLE settings (id integer PRIMARY KEY CHECK (id = 1), value text NOT NULL);
    `,
  },
  {
    // M7 notes (mirror of the SQLite migration of the same name)
    version: 2,
    name: 'notes',
    up: `
      CREATE TABLE note_versions (
        session_id text COLLATE "C" NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        version integer NOT NULL,
        kind text NOT NULL,
        markdown text NOT NULL,
        base_version integer NOT NULL,
        created_at text NOT NULL,
        meta text NOT NULL,
        PRIMARY KEY (session_id, version)
      );
      CREATE TABLE notes (
        session_id text COLLATE "C" PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
        head integer NOT NULL,
        pending_enhancement integer
      );
      CREATE TABLE note_templates (
        id text COLLATE "C" PRIMARY KEY,
        name text NOT NULL,
        keywords text NOT NULL,
        body text NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'hosted',
    up: `
      CREATE TABLE sync_devices (
        device_id text PRIMARY KEY,
        cursor bigint NOT NULL,
        updated_at text NOT NULL
      );
      CREATE TABLE devices (
        id text PRIMARY KEY,
        name text NOT NULL,
        created_at text NOT NULL,
        revoked_at text
      );
      CREATE TABLE pairing_requests (
        device_code_hash text PRIMARY KEY,
        user_code text NOT NULL UNIQUE,
        name text NOT NULL,
        created_at text NOT NULL,
        expires_at text COLLATE "C" NOT NULL,
        device_id text,
        claimed boolean NOT NULL DEFAULT false
      );
      CREATE TABLE audio_chunks (
        session_id text COLLATE "C" NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        chunk_seq integer NOT NULL,
        track text NOT NULL,
        bytes integer NOT NULL,
        sha256 text NOT NULL,
        blob_key text NOT NULL,
        received_at text NOT NULL,
        PRIMARY KEY (session_id, chunk_seq)
      );
    `,
  },
]

const LOCK_KEY = 0x676e6f6d // 'gnom'

export type PgMigrationResult = { from: number; to: number; applied: number[] }

// biome-ignore lint/suspicious/noExplicitAny: migrations run before any typed schema exists
type Untyped = Kysely<any>

export async function migratePg(
  db: Untyped,
  list: readonly Migration[] = pgMigrations,
  now: () => Date = () => new Date(),
): Promise<PgMigrationResult> {
  list.forEach((m, i) => {
    if (m.version !== i + 1) throw new SchemaError(`migration ${m.name}: expected version ${i + 1}`)
  })
  return db.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(${sql.lit(LOCK_KEY)})`.execute(trx)
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at text NOT NULL
    )`.execute(trx)
    const applied = (
      await sql<{
        version: number
        name: string
      }>`SELECT version, name FROM schema_migrations ORDER BY version`.execute(trx)
    ).rows
    applied.forEach((row, i) => {
      if (Number(row.version) !== i + 1)
        throw new SchemaError(`schema_migrations is not contiguous at ${row.version}`)
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
    for (const m of list.slice(from)) {
      await sql.raw(m.up).execute(trx)
      await sql`INSERT INTO schema_migrations (version, name, applied_at) VALUES (${m.version}, ${m.name}, ${now().toISOString()})`.execute(
        trx,
      )
      done.push(m.version)
    }
    return { from, to: list.length, applied: done }
  })
}

export async function pgSchemaVersion(db: Untyped): Promise<number> {
  const r = await sql<{ v: number | null }>`SELECT max(version) AS v FROM schema_migrations`.execute(db)
  return Number(r.rows[0]?.v ?? 0)
}
