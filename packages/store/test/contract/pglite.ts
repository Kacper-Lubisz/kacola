import { PGlite } from '@electric-sql/pglite'
import { Kysely } from 'kysely'
import { migratePg, openPglite, type PgStore, pgliteDialect } from '../../src/pg/index.ts'

// PGlite takes ~1 s to boot and migrate, but ~0.2 s to clone from a data-dir snapshot, so every test
// gets a fresh, already-migrated Postgres cloned from one template.
let template: Promise<Blob> | null = null

async function makeTemplate(): Promise<Blob> {
  const pg = new PGlite()
  const db = new Kysely({ dialect: pgliteDialect(pg) })
  await migratePg(db)
  const dump = await pg.dumpDataDir('none')
  await db.destroy()
  return dump
}

export async function freshPglite(): Promise<PGlite> {
  template ??= makeTemplate()
  const pg = new PGlite({ loadDataDir: await template })
  await pg.waitReady
  return pg
}

export async function pgliteStore(opts: { now?: () => Date } = {}): Promise<PgStore> {
  return openPglite(await freshPglite(), opts)
}
