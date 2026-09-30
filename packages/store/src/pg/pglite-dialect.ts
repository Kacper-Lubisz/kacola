import type { PGlite } from '@electric-sql/pglite'
import {
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
} from 'kysely'

// A kysely dialect over PGlite (embedded Postgres in WASM): real Postgres semantics — the same parser,
// planner, tsvector, locking — in-process, so the Postgres build is tested in `pnpm check` without a
// server. PGlite is one session, so connections are handed out one at a time; a transaction holds the
// only connection until it ends, which is exactly the isolation a single-session database can offer.
//
// Only a type import of PGlite: the caller constructs it, and the Vercel bundle never includes it.

class Mutex {
  private tail: Promise<void> = Promise.resolve()
  lock(): Promise<() => void> {
    let release!: () => void
    const next = new Promise<void>((r) => {
      release = r
    })
    const prev = this.tail
    this.tail = prev.then(() => next)
    return prev.then(() => release)
  }
}

class PgliteConnection implements DatabaseConnection {
  private readonly pg: PGlite
  constructor(pg: PGlite) {
    this.pg = pg
  }

  async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
    // Parameterless multi-statement text (migrations) needs the simple-query protocol: exec().
    if (q.parameters.length === 0 && q.sql.includes(';')) {
      const results = await this.pg.exec(q.sql)
      const last = results.at(-1)
      return { rows: (last?.rows ?? []) as R[] }
    }
    const r = await this.pg.query<R>(q.sql, [...q.parameters])
    return {
      rows: r.rows,
      ...(r.affectedRows !== undefined ? { numAffectedRows: BigInt(r.affectedRows) } : {}),
    }
  }

  // biome-ignore lint/correctness/useYield: streaming is not supported, and never used by the store
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('PGlite dialect does not support streaming queries')
  }
}

class PgliteDriver implements Driver {
  private readonly pg: PGlite
  private readonly mutex = new Mutex()
  private readonly releases = new Map<DatabaseConnection, () => void>()
  private readonly ownsInstance: boolean

  constructor(pg: PGlite, ownsInstance: boolean) {
    this.pg = pg
    this.ownsInstance = ownsInstance
  }

  async init(): Promise<void> {
    await this.pg.waitReady
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const release = await this.mutex.lock()
    const conn = new PgliteConnection(this.pg)
    this.releases.set(conn, release)
    return conn
  }

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await (conn as PgliteConnection).executeQuery({
      sql: 'BEGIN',
      parameters: [],
    } as unknown as CompiledQuery)
  }
  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await (conn as PgliteConnection).executeQuery({
      sql: 'COMMIT',
      parameters: [],
    } as unknown as CompiledQuery)
  }
  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await (conn as PgliteConnection).executeQuery({
      sql: 'ROLLBACK',
      parameters: [],
    } as unknown as CompiledQuery)
  }

  async releaseConnection(conn: DatabaseConnection): Promise<void> {
    const release = this.releases.get(conn)
    this.releases.delete(conn)
    release?.()
  }

  async destroy(): Promise<void> {
    if (this.ownsInstance && !this.pg.closed) await this.pg.close()
  }
}

export function pgliteDialect(pg: PGlite, opts: { closeOnDestroy?: boolean } = {}): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new PgliteDriver(pg, opts.closeOnDestroy ?? true),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  }
}
