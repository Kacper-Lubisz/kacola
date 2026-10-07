// @kacola/store/pg — the Postgres dialect of the store (H-1). Importable without better-sqlite3 (the
// Vercel bundle uses only this entry point) and without PGlite (only a type import; tests pass one in).
import type { PGlite } from '@electric-sql/pglite'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { pgliteDialect } from './pglite-dialect.ts'
import { PgStore, type PgStoreOptions } from './store.ts'

export type * from '../api.ts'
export { StoreError } from '../errors.ts'
export { migratePg, pgMigrations, pgSchemaVersion } from './migrations.ts'
export { pgliteDialect } from './pglite-dialect.ts'
export { PgStore, type PgStoreOptions } from './store.ts'

// pg returns int8 as a string by default (it can exceed 2^53). seq and counts are bigint; the store
// converts with Number() where it reads them, so the default parser is left alone.

export type PostgresOptions = PgStoreOptions & {
  /** Pool size. Serverless functions want few connections each (Neon pools server-side). */
  max?: number
  ssl?: boolean
}

/** A store on a real Postgres server (Neon, or the int tier's podman container). */
export async function openPostgres(connectionString: string, opts: PostgresOptions = {}): Promise<PgStore> {
  const ssl = opts.ssl ?? /sslmode=require|neon\.tech/.test(connectionString)
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 5,
    ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  })
  return PgStore.open(new Kysely({ dialect: new PostgresDialect({ pool }) }), opts)
}

/** A store on an embedded PGlite instance (tests; closes the instance when the store closes). */
export async function openPglite(instance: PGlite, opts: PgStoreOptions = {}): Promise<PgStore> {
  return PgStore.open(new Kysely({ dialect: pgliteDialect(instance) }), opts)
}
